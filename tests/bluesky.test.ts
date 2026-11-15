// Bluesky (AT Protocol) extractor tests.
//
// No network: globalThis.fetch is replaced with a fixture router for the three
// upstream calls the extractor makes (handle resolution, post thread, PLC DID
// document). The assertions cover the parts that must stay honest — URL
// parsing, the original-file mapping, proxy vs direct links, and the error
// paths for posts without media.
//
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BlueskyError,
  extractBlueskyPost,
  formatBytes,
  formatCount,
  isProxyableBlueskyHost,
  parseBlueskyPostUrl,
} from '../lib/blueskyExtract';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

interface Fixture {
  did: string;
  pds?: string;
  thread: unknown;
}

/** Installs a fetch stub for one test and restores the real one afterwards. */
async function withFetch<T>(fixture: Fixture, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    calls.push(url);

    if (url.includes('/xrpc/com.atproto.identity.resolveHandle')) {
      return json({ did: fixture.did });
    }
    if (url.includes('/xrpc/app.bsky.feed.getPostThread')) {
      return json(fixture.thread);
    }
    if (url.startsWith('https://plc.directory/')) {
      return json({
        service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: fixture.pds }],
      });
    }
    throw new Error(`Unexpected upstream call in test: ${url}`);
  }) as typeof fetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = original;
    // Keep the log observable if a future test needs it.
    void calls;
  }
}

function videoThread(did: string, rkey: string) {
  return {
    thread: {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post: {
        uri: `at://${did}/app.bsky.feed.post/${rkey}`,
        author: {
          handle: 'tester.bsky.social',
          displayName: 'Test Author',
          avatar: 'https://cdn.bsky.app/img/avatar/plain/did/abc',
          verification: { verifiedStatus: 'valid' },
        },
        record: {
          $type: 'app.bsky.feed.post',
          text: 'A video post',
          createdAt: '2026-11-08T12:33:58.545Z',
          embed: {
            $type: 'app.bsky.embed.video',
            video: {
              $type: 'blob',
              ref: { $link: 'bafkreivideocid' },
              mimeType: 'video/mp4',
              size: 18266642,
            },
            aspectRatio: { width: 1170, height: 712 },
          },
        },
        embed: {
          $type: 'app.bsky.embed.video#view',
          thumbnail: 'https://video.bsky.app/watch/thumb.jpg',
          playlist: 'https://video.bsky.app/watch/playlist.m3u8',
        },
        likeCount: 10295,
        replyCount: 370,
      },
    },
  };
}

function imageThread(did: string, rkey: string) {
  return {
    thread: {
      post: {
        uri: `at://${did}/app.bsky.feed.post/${rkey}`,
        author: { handle: 'tester.bsky.social', displayName: 'Test Author' },
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Two images',
          createdAt: '2026-11-09T10:00:00.000Z',
          embed: {
            $type: 'app.bsky.embed.images',
            images: [
              {
                image: { ref: { $link: 'bafkreiimageone' }, mimeType: 'image/jpeg', size: 297645 },
                alt: 'First image',
              },
              {
                image: { ref: { $link: 'bafkreiimagetwo' }, mimeType: 'image/png', size: 120000 },
                alt: 'Second image',
              },
            ],
          },
        },
        embed: {
          $type: 'app.bsky.embed.images#view',
          images: [
            {
              fullsize: 'https://cdn.bsky.app/img/feed_fullsize/plain/did/one',
              thumb: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did/one',
              aspectRatio: { width: 3300, height: 1968 },
            },
            {
              fullsize: 'https://cdn.bsky.app/img/feed_fullsize/plain/did/two',
              thumb: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did/two',
            },
          ],
        },
        likeCount: 12,
        replyCount: 3,
      },
    },
  };
}

function textThread(did: string, rkey: string) {
  return {
    thread: {
      post: {
        uri: `at://${did}/app.bsky.feed.post/${rkey}`,
        author: { handle: 'tester.bsky.social' },
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Just words, no media',
          createdAt: '2026-11-10T10:00:00.000Z',
        },
        likeCount: 1,
        replyCount: 0,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 1. URL parsing
// ---------------------------------------------------------------------------

test('1. parseBlueskyPostUrl accepts canonical post links and AT URIs', () => {
  assert.deepEqual(
    parseBlueskyPostUrl('https://bsky.app/profile/name.bsky.social/post/3kabc123xyz'),
    { actor: 'name.bsky.social', rkey: '3kabc123xyz' }
  );
  assert.deepEqual(
    parseBlueskyPostUrl('https://www.bsky.app/profile/name.bsky.social/post/3kabc123xyz/'),
    { actor: 'name.bsky.social', rkey: '3kabc123xyz' }
  );
  assert.deepEqual(
    parseBlueskyPostUrl('bsky.app/profile/name.bsky.social/post/3kabc123xyz'),
    { actor: 'name.bsky.social', rkey: '3kabc123xyz' }
  );
  assert.deepEqual(
    parseBlueskyPostUrl('at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kabc123xyz'),
    { actor: 'did:plc:z72i7hdynmk6r22z27h6tvur', rkey: '3kabc123xyz' }
  );
});

test('2. parseBlueskyPostUrl rejects everything that is not a post', () => {
  for (const bad of [
    '',
    '   ',
    'https://bsky.app/profile/name.bsky.social',
    'https://bsky.app/search?q=bluesky',
    'https://bsky.app/profile/name.bsky.social/feed/abc',
    'https://example.com/profile/name/post/3kabc',
    'https://bsky.app.evil.example/profile/name/post/3kabc',
    'at://did:plc:abc/app.bsky.feed.like/3kabc',
    'not a url',
  ]) {
    assert.equal(parseBlueskyPostUrl(bad), null, bad);
  }
});

// ---------------------------------------------------------------------------
// 3. Small formatters
// ---------------------------------------------------------------------------

test('3. formatBytes and formatCount never invent a size', () => {
  assert.equal(formatBytes(null), '');
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(18266642), '17.4 MB');
  assert.equal(formatBytes(297645), '291 KB');

  assert.equal(formatCount(undefined), '');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1500), '1.5K');
  assert.equal(formatCount(10295), '10K');
  assert.equal(formatCount(2500000), '2.5M');
});

test('4. only Bluesky-owned hosts are proxied', () => {
  for (const host of [
    'bsky.app',
    'www.bsky.app',
    'cdn.bsky.app',
    'lionsmane.us-east.host.bsky.network',
    'bsky.social',
  ]) {
    assert.equal(isProxyableBlueskyHost(host), true, host);
  }
  for (const host of ['example.com', 'pds.example.com', 'bsky.app.evil.example', 'notbsky.network']) {
    assert.equal(isProxyableBlueskyHost(host), false, host);
  }
});

// ---------------------------------------------------------------------------
// 5. Video mapping (hosted by Bluesky -> proxied through /api/proxy-media)
// ---------------------------------------------------------------------------

test('5. video posts return the original MP4 with real metadata', async () => {
  const did = 'did:plc:videotest';
  const fixture: Fixture = {
    did,
    pds: 'https://lionsmane.us-east.host.bsky.network',
    thread: videoThread(did, '3kvideo'),
  };

  const result = await withFetch(fixture, () =>
    extractBlueskyPost('https://bsky.app/profile/tester.bsky.social/post/3kvideo')
  );

  assert.equal(result.id, '3kvideo');
  assert.equal(result.mediaType, 'video');
  assert.equal(result.provider, 'bluesky-atproto');
  assert.equal(result.author.username, 'tester.bsky.social');
  assert.equal(result.author.isVerified, true);
  assert.equal(result.likes, '10K');
  assert.equal(result.comments, '370');
  assert.equal(result.note, undefined);

  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.equal(item.type, 'video');
  assert.equal(item.format, 'mp4');
  assert.equal(item.dimensions, '1170:712');
  assert.equal(item.fileSize, '17.4 MB');
  assert.equal(item.thumbnail, 'https://video.bsky.app/watch/thumb.jpg');
  assert.ok(item.downloadUrl.startsWith('/api/proxy-media?url='), item.downloadUrl);
  assert.ok(item.downloadUrl.includes('com.atproto.sync.getBlob'), 'must use the blob endpoint');

  assert.equal(item.availableQualities.length, 1);
  const quality = item.availableQualities[0];
  assert.equal(quality.quality, 'original');
  assert.equal(quality.format, 'mp4');
  assert.equal(quality.fileSize, '17.4 MB');
  assert.doesNotMatch(quality.label, /1080|720|full hd/i);
});

// ---------------------------------------------------------------------------
// 6. Image carousel mapping, including a non-JPEG format
// ---------------------------------------------------------------------------

test('6. image posts keep every attachment and its original format', async () => {
  const did = 'did:plc:imagetest';
  const fixture: Fixture = {
    did,
    pds: 'https://puffball.us-east.host.bsky.network',
    thread: imageThread(did, '3kimages'),
  };

  const result = await withFetch(fixture, () =>
    extractBlueskyPost('https://bsky.app/profile/did:plc:imagetest/post/3kimages')
  );

  assert.equal(result.mediaType, 'photo');
  assert.equal(result.items.length, 2);
  assert.deepEqual(
    result.items.map((item) => item.format),
    ['jpg', 'png']
  );
  assert.deepEqual(
    result.items.map((item) => item.fileSize),
    ['291 KB', '117 KB']
  );
  assert.equal(result.items[0].url, 'https://cdn.bsky.app/img/feed_fullsize/plain/did/one');
  assert.equal(result.items[0].thumbnail, 'https://cdn.bsky.app/img/feed_thumbnail/plain/did/one');
  assert.equal(result.items[0].dimensions, '3300:1968');
  assert.equal(result.items[0].availableQualities[0].label, 'Original image (JPG)');
  assert.equal(result.items[0].availableQualities[0].resolution, 'Aspect ratio 3300:1968');
  assert.equal(result.items[1].availableQualities[0].label, 'Original image (PNG)');
  for (const item of result.items) {
    assert.ok(item.downloadUrl.startsWith('/api/proxy-media?url='), item.downloadUrl);
  }
});

// ---------------------------------------------------------------------------
// 7. Independent PDS -> direct link plus an honest note
// ---------------------------------------------------------------------------

test('7. an account on a third-party PDS is linked directly and explained', async () => {
  const did = 'did:plc:pdstest';
  const fixture: Fixture = {
    did,
    pds: 'https://pds.example.com',
    thread: videoThread(did, '3kpds'),
  };

  const result = await withFetch(fixture, () =>
    extractBlueskyPost('https://bsky.app/profile/did:plc:pdstest/post/3kpds')
  );

  assert.match(result.note || '', /third-party PDS/i);
  const item = result.items[0];
  assert.ok(item.downloadUrl.startsWith('https://pds.example.com/xrpc/com.atproto.sync.getBlob?'));
  assert.doesNotMatch(item.downloadUrl, /\/api\/proxy-media/);
});

// ---------------------------------------------------------------------------
// 8. Posts with no media are rejected instead of faked
// ---------------------------------------------------------------------------

test('8. a text-only post raises a clear 404 instead of empty media', async () => {
  const did = 'did:plc:texttest';
  const fixture: Fixture = {
    did,
    pds: 'https://lionsmane.us-east.host.bsky.network',
    thread: textThread(did, '3ktext'),
  };

  await assert.rejects(
    () =>
      withFetch(fixture, () =>
        extractBlueskyPost('https://bsky.app/profile/did:plc:texttest/post/3ktext')
      ),
    (error: unknown) => {
      assert.ok(error instanceof BlueskyError);
      assert.equal((error as BlueskyError).status, 404);
      assert.match((error as Error).message, /no video or images/i);
      return true;
    }
  );
});

test('9. invalid input fails before any network call', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('should not be called');
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => extractBlueskyPost('https://example.com/profile/a/post/b'),
      (error: unknown) => {
        assert.ok(error instanceof BlueskyError);
        assert.equal((error as BlueskyError).status, 400);
        return true;
      }
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});
