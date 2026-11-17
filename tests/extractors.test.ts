// URL parsing and formatting tests for the LinkedIn, Pinterest, Kick, Lemon8
// and Loom extractors.
//
// No network: every case here is pure input validation plus the shared
// `lib/mediaFormat.ts` helpers. The rule being protected is that the server
// only ever fetches a host it chose itself, so a pasted link is reduced to an
// id and rebuilt — anything else must be rejected.
//
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkedInPostUrl, linkedInPostUrl } from '../lib/linkedinExtract';
import { parsePinterestPinUrl, isProxyablePinterestHost } from '../lib/pinterestExtract';
import { parseLemon8Url } from '../lib/lemon8Extract';
import { parseLoomUrl } from '../lib/loomExtract';
import { formatBytes, formatCount, formatDate, formatIsoDuration } from '../lib/mediaFormat';

test('1. LinkedIn post links reduce to a numeric post id', () => {
  assert.deepEqual(
    parseLinkedInPostUrl(
      'https://www.linkedin.com/posts/name_slug-activity-7419391615682646017-guYT'
    ),
    { type: 'activity', id: '7419391615682646017' }
  );
  assert.deepEqual(
    parseLinkedInPostUrl('https://www.linkedin.com/feed/update/urn:li:activity:7419391615682646017/'),
    { type: 'activity', id: '7419391615682646017' }
  );
  assert.deepEqual(
    parseLinkedInPostUrl('https://m.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7419391615682646017'),
    { type: 'ugcPost', id: '7419391615682646017' }
  );
  // The rebuilt URL is always linkedin.com, never the host from the input.
  assert.equal(
    linkedInPostUrl({ type: 'activity', id: '7419391615682646017' }),
    'https://www.linkedin.com/feed/update/urn:li:activity:7419391615682646017/'
  );
});

test('2. LinkedIn rejects non-post pages and look-alike hosts', () => {
  for (const bad of [
    '',
    'not a url',
    'https://www.linkedin.com/in/someone',
    'https://www.linkedin.com/company/acme',
    'https://www.linkedin.com/learning/some-course',
    'https://linkedin.com.evil.example/posts/x-activity-7419391615682646017-ab',
    'https://www.linkedin.com/posts/x-activity-123-ab',
  ]) {
    assert.equal(parseLinkedInPostUrl(bad), null, bad);
  }
});

test('3. Pinterest pins accept pin URLs and pin.it short links only', () => {
  assert.deepEqual(parsePinterestPinUrl('https://www.pinterest.com/pin/664281013778109217/'), {
    id: '664281013778109217',
  });
  assert.deepEqual(
    parsePinterestPinUrl('https://www.pinterest.co.uk/pin/some-slug--664281013778109217/'),
    { id: '664281013778109217' }
  );
  const short = parsePinterestPinUrl('https://pin.it/4AbCdEf');
  assert.ok(short && short.shortCode, 'pin.it short link should carry a short code');
  assert.equal(parsePinterestPinUrl('https://www.pinterest.com/search/pins/?q=cats'), null);
  assert.equal(parsePinterestPinUrl('https://pinimg.com.evil.example/pin/664281013778109217/'), null);
  // Only the image CDN is proxyable.
  assert.equal(isProxyablePinterestHost('i.pinimg.com'), true);
  assert.equal(isProxyablePinterestHost('evilpinimg.com'), false);
});

test('4. Lemon8 and Loom links must carry a post or recording id', () => {
  const lemon8 = parseLemon8Url('https://www.lemon8-app.com/@someone/7012345678901234567?region=us');
  assert.ok(lemon8, 'a Lemon8 post link should parse');
  assert.equal(lemon8?.postId, '7012345678901234567');
  // A profile link is recognised as Lemon8 but explained, not silently rejected.
  assert.throws(
    () => parseLemon8Url('https://www.lemon8-app.com/@someone'),
    /profile link/i,
    'a Lemon8 profile link should be explained'
  );
  assert.equal(parseLemon8Url('https://lemon8-app.com.evil.example/@a/7012345678901234567'), null);

  const loom = parseLoomUrl('https://www.loom.com/share/44bff3b7cd784946a61686092a353f48');
  assert.equal(loom?.videoId, '44bff3b7cd784946a61686092a353f48');
  assert.equal(parseLoomUrl('https://www.loom.com/share/'), null);
  assert.equal(parseLoomUrl('https://loom.com.evil.example/share/44bff3b7cd784946a61686092a353f48'), null);
});

test('5. Sizes, counts, dates and durations read like a person wrote them', () => {
  assert.equal(formatBytes(310615), '303 KB');
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(null), '');
  assert.equal(formatCount(131), '131');
  assert.equal(formatCount(1643), '1.6K');
  assert.equal(formatCount(2_400_000), '2.4M');
  assert.equal(formatCount(undefined), '');
  assert.equal(formatIsoDuration('PT10S'), '0:10');
  assert.equal(formatIsoDuration('PT1M10S'), '1:10');
  assert.equal(formatIsoDuration('PT1H2M3S'), '1:02:03');
  assert.equal(formatIsoDuration('nonsense'), '');
  assert.match(formatDate('2026-01-20T10:00:00Z'), /^Jan \d{1,2}, 2026$/);
  assert.equal(formatDate('not a date'), '');
});
