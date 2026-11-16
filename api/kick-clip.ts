import type { VercelRequest, VercelResponse } from '@vercel/node';
import http from 'node:http';
import https from 'node:https';

// SELF-CONTAINED Vercel function — zero local-file imports.
// Streams one Kick clip as a single MPEG-TS file by fetching the playlist's
// byterange slices in order. Mirrors functions/api/kick-clip.ts.

const KICK_ORIGIN = 'https://kick.com';
const KICK_API = 'https://kick.com/api/v2';
const FETCH_TIMEOUT_MS = 15000;
const MAX_PLAYLIST_BYTES = 512 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const buckets = new Map<string, { count: number; reset: number }>();

function checkRateLimit(req: VercelRequest, scope: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : (xff || '').split(',')[0];
  const ip = ((first || (req.headers['x-real-ip'] as string) || 'unknown').trim() || 'unknown').substring(0, 45);
  const key = `${scope}:${ip}`;
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

// kick.com rejects Node's global fetch (undici) TLS fingerprint, so the clip
// JSON is read over node:https; the media CDN accepts either.
function nodeGetText(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; text(): Promise<string> }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http:') ? http : https;
    const req = client.get(url, { headers }, (response) => {
      const status = response.statusCode || 0;
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk as Buffer));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Kick request timed out')));
    req.on('error', reject);
  });
}

interface ClipSegment {
  url: string;
  start: number | null;
  length: number | null;
}

function parseClipPlaylist(text: string, baseUrl: string): { segments: ClipSegment[]; bytes: number } {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const segments: ClipSegment[] = [];
  let bytes = 0;
  let pending: { start: number; length: number } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      const [lengthPart, offsetPart] = line.slice('#EXT-X-BYTERANGE:'.length).split('@');
      const length = Number.parseInt(lengthPart, 10);
      const offset = Number.parseInt(offsetPart || '0', 10);
      if (Number.isFinite(length) && length > 0) {
        pending = { start: Number.isFinite(offset) ? offset : 0, length };
      }
      continue;
    }
    if (line.startsWith('#')) continue;

    let url: string;
    try {
      url = new URL(line, baseUrl).toString();
    } catch {
      continue;
    }
    segments.push(pending ? { url, start: pending.start, length: pending.length } : { url, start: null, length: null });
    if (pending) bytes += pending.length;
    pending = null;
  }

  return { segments, bytes };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
  if (checkRateLimit(req, 'kickStream', 20, 60 * 1000)) {
    return res.status(429).send('Rate limit exceeded. Please wait a minute.');
  }

  const clipId = String((req.query.id as string) || '').trim();
  if (!/^clip_[A-Za-z0-9]{8,64}$/.test(clipId)) {
    return res.status(400).send('A valid Kick clip id is required.');
  }

  try {
    const clipRes = await nodeGetText(
      `${KICK_API}/clips/${encodeURIComponent(clipId)}`,
      {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': USER_AGENT,
        Referer: `${KICK_ORIGIN}/`,
      },
      FETCH_TIMEOUT_MS
    );
    if (clipRes.status === 404) return res.status(404).send('Kick did not return this clip. It may be deleted or private.');
    if (!clipRes.ok) return res.status(502).send(`Kick returned HTTP ${clipRes.status}.`);

    const payload: any = JSON.parse(await clipRes.text());
    const clip = payload?.clip;
    const playlistUrl: string = clip?.clip_url || clip?.video_url || clip?.playback_url || '';
    if (!clip || !/^https?:\/\//i.test(playlistUrl)) return res.status(404).send('Kick published no stream for this clip.');

    const playlistRes = await nodeGetText(
      playlistUrl,
      { Accept: '*/*', 'User-Agent': USER_AGENT, Referer: `${KICK_ORIGIN}/` },
      FETCH_TIMEOUT_MS
    );
    if (!playlistRes.ok) return res.status(502).send(`Kick returned HTTP ${playlistRes.status} for this stream.`);
    const playlistText = await playlistRes.text();
    if (playlistText.length > MAX_PLAYLIST_BYTES) return res.status(502).send('Kick returned an unexpected playlist.');

    const playlist = parseClipPlaylist(playlistText, playlistUrl);
    if (playlist.segments.length === 0) return res.status(502).send('Kick listed no video segments for this clip.');

    const author = (clip.channel?.username || clip.channel?.slug || 'kick').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Content-Disposition', `attachment; filename="igsavego_kick_${clipId}_${author.slice(0, 40)}.ts"`);
    if (playlist.bytes > 0) res.setHeader('Content-Length', String(playlist.bytes));
    res.flushHeaders?.();

    for (const segment of playlist.segments) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          Referer: `${KICK_ORIGIN}/`,
        };
        if (segment.start !== null && segment.length !== null) {
          headers.Range = `bytes=${segment.start}-${segment.start + segment.length - 1}`;
        }
        const segmentRes = await fetch(segment.url, { headers });
        if (!segmentRes.ok || !segmentRes.body) continue;
        const reader = segmentRes.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) res.write(Buffer.from(value));
        }
      } catch {
        // A single skipped segment leaves a small gap; the rest still streams.
      }
    }
    res.end();
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    console.error('Kick clip stream error:', error);
    return res.status(502).send('Could not read that Kick clip. Please try again in a minute.');
  }
}
