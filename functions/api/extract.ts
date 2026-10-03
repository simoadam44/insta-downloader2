import { CfContext, checkRateLimit, getEnv, json } from '../_lib/cf';

// Instagram media extractor (free-provider chain, no key required).
// Accepts GET ?url= and POST { url } — same contract as the Vercel/Express
// versions. Proxied download links point at /api/proxy-media (same origin).
function extractShortcode(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const shareSub = trimmed.match(/\/share\/(?:p|r|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
  if (shareSub?.[1]) return shareSub[1];
  const shareGen = trimmed.match(/\/share\/([a-zA-Z0-9_-]{5,35})/i);
  if (shareGen?.[1] && !['p', 'r', 'reel', 'reels', 'tv'].includes(shareGen[1].toLowerCase())) return shareGen[1];
  const std = trimmed.match(/\/(p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
  if (std?.[2]) return std[2];
  if (/^[a-zA-Z0-9_-]{6,35}$/.test(trimmed)) return trimmed;
  return null;
}

function cleanUrl(s: string | null | undefined): string {
  if (!s) return '';
  let out = s.trim();
  try {
    out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  } catch {}
  out = out.replace(/\\u0026/gi, '&').replace(/\\u002F/gi, '/');
  out = out.replace(/\\+\//g, '/').replace(/\\"/g, '"').replace(/\\/g, '');
  return out;
}

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const BOT_UA = 'TelegramBot (like TwitterBot)';
const KK_HOSTS = ['kkinstagram.com', 'kkclip.com'];

async function fetchViaKkMirror(
  shortcode: string,
  timeoutMs = 12000
): Promise<{ url: string; isVideo: boolean } | null> {
  const targets: string[] = [];
  for (const host of KK_HOSTS) {
    for (const p of [`/reel/${shortcode}/`, `/p/${shortcode}/`]) targets.push(`https://${host}${p}`);
  }
  const attempt = async (url: string) => {
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': BOT_UA, Accept: '*/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (r.status !== 301 && r.status !== 302) return null;
    const loc = r.headers.get('location') || '';
    if (!loc) return null;
    const low = loc.toLowerCase();
    if (!low.includes('cdninstagram.com') && !low.includes('fbcdn.net')) return null;
    return { url: loc, isVideo: /\.mp4/i.test(loc.split('?')[0]) };
  };
  const results = await Promise.allSettled(targets.map((t) => attempt(t).catch(() => null)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.isVideo) return r.value;
  }
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

async function fetchOEmbed(postUrl: string, timeoutMs = 8000) {
  const attempt = async (base: string) => {
    const r = await fetch(base + encodeURIComponent(postUrl), {
      headers: { 'User-Agent': DESKTOP_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    return (await r.json()) as any;
  };
  const bases = [
    'https://www.instagram.com/api/v1/oembed/?url=',
    'https://i.instagram.com/api/v1/oembed?url=',
  ];
  const results = await Promise.allSettled(bases.map((b) => attempt(b).catch(() => null)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

async function fetchEmbedHtml(shortcode: string, env: Record<string, string | undefined>, timeoutMs = 10000): Promise<string | null> {
  const sessionId = getEnv(env, 'IG_SESSIONID');
  const dsUser = getEnv(env, 'IG_DS_USER_ID');
  const csrftoken = getEnv(env, 'IG_CSRFTOKEN');
  const headers: Record<string, string> = {
    'User-Agent': DESKTOP_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.instagram.com/',
  };
  if (sessionId) {
    let cookie = `sessionid=${sessionId};`;
    if (dsUser) cookie += ` ds_user_id=${dsUser};`;
    if (csrftoken) cookie += ` csrftoken=${csrftoken};`;
    headers['Cookie'] = cookie;
    headers['X-CSRFToken'] = csrftoken || sessionId.slice(0, 32);
  }
  const attempt = async (u: string): Promise<string | null> => {
    const r = await fetch(u, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const html = await r.text();
    if (html.includes('video_url') || html.includes('display_url') || html.includes('og:video') || html.includes('og:image')) {
      return html;
    }
    return null;
  };
  const urls = [
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
  ];
  const results = await Promise.allSettled(urls.map((u) => attempt(u).catch(() => null)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

function parseEmbedHtml(html: string) {
  let video: string | null = null;
  let image: string | null = null;
  let username: string | null = null;
  const vPats = [
    /\\"video_url\\":\\"([^"]+)\\"/, /"video_url":"([^"]+)"/,
    /<meta\s+property="og:video(?::secure_url)?"\s+content="([^"]+)"/i,
    /(https?:\\?\/\\?\/[^\s"<>]+\.mp4[^\s"<>]*)/i, /(https:\/\/[^\s"<>]+\.mp4[^\s"<>]*)/i,
  ];
  for (const p of vPats) {
    const m = html.match(p);
    if (m?.[1]) { video = cleanUrl(m[1]); break; }
  }
  const iPats = [
    /\\"display_url\\":\\"([^"]+)\\"/, /"display_url":"([^"]+)"/,
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
  ];
  for (const p of iPats) {
    const m = html.match(p);
    if (m?.[1]) { image = cleanUrl(m[1]); break; }
  }
  const u = html.match(/\\"username\\":\\"([^"\\]+)\\"/) || html.match(/"username":"([^"\\]+)"/);
  if (u?.[1]) username = u[1].trim();
  return { video, image, username };
}

async function fetchViaRapidApi(postUrl: string, env: Record<string, string | undefined>) {
  const key = getEnv(env, 'RAPIDAPI_KEY');
  if (!key) return null;
  const host = getEnv(env, 'RAPIDAPI_HOST') || 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com';
  try {
    const r = await fetch(`https://${host}/api?url=${encodeURIComponent(postUrl)}`, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchViaCobalt(postUrl: string, env: Record<string, string | undefined>) {
  const base = getEnv(env, 'COBALT_API_URL').replace(/\/+$/, '');
  if (!base) return null;
  try {
    const r = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: postUrl, videoQuality: '1080', filenameStyle: 'basic' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'extract', 60, 60 * 1000)) {
    return json({ error: 'Too many requests. Please wait a minute.' }, 429, noCache);
  }

  let rawUrl = new URL(request.url).searchParams.get('url') || '';
  if (!rawUrl && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as any;
    rawUrl = (typeof body?.url === 'string' ? body.url : '').trim();
  } else {
    rawUrl = rawUrl.trim();
  }
  if (!rawUrl) return json({ error: 'Please enter an Instagram URL.' }, 400, noCache);
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  const shortcode = extractShortcode(rawUrl);
  if (!shortcode) {
    return json(
      { error: 'Invalid Instagram URL. Use a Post / Reel link like https://www.instagram.com/p/... or /reel/...' },
      400,
      noCache
    );
  }
  const canonical = `https://www.instagram.com/p/${shortcode}/`;

  // Short parallel race (edge isolates bill wall-time): free providers first.
  const FAST_MS = 6000;
  const [kkSettled, oeSettled, emSettled] = await Promise.allSettled([
    fetchViaKkMirror(shortcode, FAST_MS),
    fetchOEmbed(canonical, FAST_MS),
    fetchEmbedHtml(shortcode, env, FAST_MS),
  ]);
  const kkResult = kkSettled.status === 'fulfilled' ? kkSettled.value : null;
  const oembedEarly: any = oeSettled.status === 'fulfilled' ? oeSettled.value : null;
  const embedEarly: string | null = emSettled.status === 'fulfilled' ? emSettled.value : null;

  const oembedAuthor: string = oembedEarly?.author_name || 'instagram_user';
  const oembedTitle: string = oembedEarly?.title || `Instagram post by ${oembedAuthor}`;
  const oembedThumb: string = oembedEarly?.thumbnail_url || '';

  const proxied = (mediaUrl: string, filename: string) =>
    `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;

  const kkImageFallback = kkResult && !kkResult.isVideo ? kkResult : null;
  {
    const kk = kkResult && kkResult.isVideo ? kkResult : null;
    if (kk) {
      const file = `igsavego_${shortcode}_${oembedAuthor}.mp4`;
      const px = proxied(kk.url, file);
      return json(
        {
          id: shortcode,
          mediaType: rawUrl.includes('/reel') ? 'reels' : 'video',
          originalUrl: rawUrl,
          author: { username: oembedAuthor, fullName: oembedTitle, avatar: '', isVerified: false },
          caption: oembedTitle,
          provider: 'free-auto',
          items: [
            {
              id: `item_${shortcode}_1`,
              type: 'video',
              url: px,
              downloadUrl: px,
              thumbnail: oembedThumb || kk.url,
              quality: '1080p Full HD',
              format: 'mp4',
              availableQualities: [],
            },
          ],
        },
        200,
        noCache
      );
    }
  }

  try {
    const rap = await fetchViaRapidApi(rawUrl, env);
    const mediaUrl: string | undefined =
      (rap as any)?.media || (rap as any)?.download_url || (rap as any)?.result?.[0]?.url || (rap as any)?.links?.[0]?.url;
    if (mediaUrl) {
      const isVideo = /\.mp4/i.test(mediaUrl) || (rap as any)?.type === 'video';
      const user = (rap as any)?.author || (rap as any)?.username || 'instagram_user';
      const file = `igsavego_${shortcode}_${user}.${isVideo ? 'mp4' : 'jpg'}`;
      const item = {
        id: `item_${shortcode}_1`,
        type: isVideo ? 'video' : 'photo',
        url: `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(file)}`,
        downloadUrl: `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(file)}`,
        thumbnail: (rap as any)?.thumbnail || mediaUrl,
        quality: isVideo ? '1080p Full HD' : '1080p Ultra HD',
        format: isVideo ? 'mp4' : 'jpg',
        availableQualities: [],
      };
      return json(
        {
          id: shortcode,
          mediaType: isVideo ? 'video' : 'photo',
          originalUrl: rawUrl,
          author: { username: user, fullName: user, avatar: '', isVerified: false },
          caption: (rap as any)?.title || `Instagram post by @${user}`,
          items: [item],
        },
        200,
        noCache
      );
    }
  } catch {}

  try {
    const cob = (await fetchViaCobalt(rawUrl, env)) as any;
    const mediaUrl: string | undefined = cob?.url;
    if (mediaUrl) {
      const isVideo = !/\.(jpg|jpeg|png|webp)/i.test(mediaUrl);
      const file = `igsavego_${shortcode}.${isVideo ? 'mp4' : 'jpg'}`;
      const item = {
        id: `item_${shortcode}_1`,
        type: isVideo ? 'video' : 'photo',
        url: `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(file)}`,
        downloadUrl: `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(file)}`,
        thumbnail: cob?.picker?.[0]?.thumb || mediaUrl,
        quality: isVideo ? '1080p Full HD' : '1080p Ultra HD',
        format: isVideo ? 'mp4' : 'jpg',
        availableQualities: [],
      };
      return json(
        {
          id: shortcode,
          mediaType: isVideo ? 'video' : 'photo',
          originalUrl: rawUrl,
          author: { username: 'instagram_user', fullName: 'Instagram User', avatar: '', isVerified: false },
          caption: 'Instagram media',
          items: [item],
        },
        200,
        noCache
      );
    }
  } catch {}

  {
    const html = embedEarly;
    if (html) {
      const { video, image, username } = parseEmbedHtml(html);
      const user = username || 'instagram_user';
      if (video) {
        const file = `igsavego_${shortcode}_${user}.mp4`;
        const px = `/api/proxy-media?url=${encodeURIComponent(video)}&filename=${encodeURIComponent(file)}`;
        return json(
          {
            id: shortcode,
            mediaType: rawUrl.includes('/reel') ? 'reels' : 'video',
            originalUrl: rawUrl,
            author: { username: user, fullName: user, avatar: '', isVerified: false },
            caption: `Instagram video by @${user}`,
            items: [
              {
                id: `item_${shortcode}_1`,
                type: 'video',
                url: px,
                downloadUrl: px,
                thumbnail: image || '',
                quality: '1080p Full HD',
                format: 'mp4',
                availableQualities: [],
              },
            ],
          },
          200,
          noCache
        );
      }
      if (image) {
        const file = `igsavego_${shortcode}_${user}.jpg`;
        const px = `/api/proxy-media?url=${encodeURIComponent(image)}&filename=${encodeURIComponent(file)}`;
        return json(
          {
            id: shortcode,
            mediaType: 'photo',
            originalUrl: rawUrl,
            author: { username: user, fullName: user, avatar: '', isVerified: false },
            caption: `Instagram photo by @${user}`,
            items: [
              {
                id: `item_${shortcode}_1`,
                type: 'photo',
                url: px,
                downloadUrl: px,
                thumbnail: image,
                quality: '1080p Ultra HD',
                format: 'jpg',
                availableQualities: [],
              },
            ],
          },
          200,
          noCache
        );
      }
    }
  }

  const oembed = oembedEarly;
  if (!oembed && !kkImageFallback) {
    return json(
      {
        error: 'Media not found. The post is private, deleted, or all free providers are busy — please try again in a minute.',
        shortcode,
      },
      404,
      noCache
    );
  }
  const thumb: string = (oembed as any)?.thumbnail_url || kkImageFallback?.url || '';
  const author: string = (oembed as any)?.author_name || oembedAuthor;
  if (thumb) {
    const file = `igsavego_${shortcode}_${author}.jpg`;
    const px = `/api/proxy-media?url=${encodeURIComponent(thumb)}&filename=${encodeURIComponent(file)}`;
    const wantsVideo = /\/reel|\/reels|\/tv|\/p\//i.test(rawUrl);
    return json(
      {
        id: shortcode,
        mediaType: 'photo',
        originalUrl: rawUrl,
        author: { username: author, fullName: (oembed as any)?.title || author, avatar: '', isVerified: false },
        caption: (oembed as any)?.title || `Instagram post by ${author}`,
        note: wantsVideo
          ? 'Instagram did not expose a video stream for this post (cover image shown). Try another post, or retry later.'
          : 'Showing full-quality cover image — the video stream was busy, please retry for the MP4.',
        items: [
          {
            id: `item_${shortcode}_1`,
            type: 'photo',
            url: px,
            downloadUrl: px,
            thumbnail: thumb,
            quality: 'Original quality',
            format: 'jpg',
            availableQualities: [],
          },
        ],
      },
      200,
      noCache
    );
  }
  return json({ error: 'Media not found. The post might be private, deleted, or restricted.', shortcode }, 404, noCache);
}
