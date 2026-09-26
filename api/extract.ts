import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, setSecurityHeaders } from './_security';
import {
  extractShortcode,
  fetchOEmbed,
  fetchEmbedHtml,
  parseEmbedHtml,
  fetchViaRapidApi,
  fetchViaCobalt,
  fetchViaKkMirror,
} from './_instagram';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (checkRateLimit(req, 'extract', 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  const rawUrl = ((req.query.url as string) || (req.body as any)?.url || '').trim();
  if (!rawUrl) return res.status(400).json({ error: 'Please enter an Instagram URL.' });
  if (rawUrl.length > 2048) return res.status(414).json({ error: 'URL is too long.' });

  const shortcode = extractShortcode(rawUrl);
  if (!shortcode) {
    return res.status(400).json({
      error: 'Invalid Instagram URL. Use a Post / Reel link like https://www.instagram.com/p/... or /reel/...',
    });
  }
  const canonical = `https://www.instagram.com/p/${shortcode}/`;

  // Author/title metadata (official free oEmbed — also proves the post is public).
  const oembedEarly = await fetchOEmbed(canonical);
  const oembedAuthor: string =
    (oembedEarly as any)?.author_name || 'instagram_user';
  const oembedTitle: string =
    (oembedEarly as any)?.title || `Instagram post by ${oembedAuthor}`;
  const oembedThumb: string = (oembedEarly as any)?.thumbnail_url || '';

  const proxied = (mediaUrl: string, filename: string) =>
    `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;

  // 0) FREE automatic provider — kkscript mirrors (no key, no login).
  try {
    const kk = await fetchViaKkMirror(shortcode);
    if (kk) {
      const isVideo = kk.isVideo;
      const ext = isVideo ? 'mp4' : 'jpg';
      const file = `sssinstagram_${shortcode}_${oembedAuthor}.${ext}`;
      const px = proxied(kk.url, file);
      return res.status(200).json({
        id: shortcode,
        mediaType: isVideo ? (rawUrl.includes('/reel') ? 'reels' : 'video') : 'photo',
        originalUrl: rawUrl,
        author: { username: oembedAuthor, fullName: oembedTitle, avatar: '', isVerified: false },
        caption: oembedTitle,
        provider: 'free-auto',
        items: [{
          id: `item_${shortcode}_1`,
          type: isVideo ? 'video' : 'photo',
          url: px, downloadUrl: px,
          thumbnail: oembedThumb || kk.url,
          quality: isVideo ? '1080p Full HD' : 'Original quality',
          format: ext, availableQualities: [],
        }],
      });
    }
  } catch {}

  // 1) RapidAPI (optional paid/key provider — only if configured)
  try {
    const rap = await fetchViaRapidApi(rawUrl);
    const mediaUrl: string | undefined =
      (rap as any)?.media || (rap as any)?.download_url || (rap as any)?.result?.[0]?.url || (rap as any)?.links?.[0]?.url;
    if (mediaUrl) {
      const isVideo = /\.mp4/i.test(mediaUrl) || (rap as any)?.type === 'video';
      const user = (rap as any)?.author || (rap as any)?.username || 'instagram_user';
      const file = `sssinstagram_${shortcode}_${user}.${isVideo ? 'mp4' : 'jpg'}`;
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
      return res.status(200).json({
        id: shortcode, mediaType: isVideo ? 'video' : 'photo', originalUrl: rawUrl,
        author: { username: user, fullName: user, avatar: '', isVerified: false },
        caption: (rap as any)?.title || `Instagram post by @${user}`, items: [item],
      });
    }
  } catch {}

  // 2) Cobalt instance
  try {
    const cob = (await fetchViaCobalt(rawUrl)) as any;
    const mediaUrl: string | undefined = cob?.url;
    if (mediaUrl) {
      const isVideo = !/\.(jpg|jpeg|png|webp)/i.test(mediaUrl);
      const file = `sssinstagram_${shortcode}.${isVideo ? 'mp4' : 'jpg'}`;
      const item = {
        id: `item_${shortcode}_1`, type: isVideo ? 'video' : 'photo',
        url: `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(file)}`,
        downloadUrl: `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(file)}`,
        thumbnail: cob?.picker?.[0]?.thumb || mediaUrl,
        quality: isVideo ? '1080p Full HD' : '1080p Ultra HD', format: isVideo ? 'mp4' : 'jpg',
        availableQualities: [],
      };
      return res.status(200).json({
        id: shortcode, mediaType: isVideo ? 'video' : 'photo', originalUrl: rawUrl,
        author: { username: 'instagram_user', fullName: 'Instagram User', avatar: '', isVerified: false },
        caption: 'Instagram media', items: [item],
      });
    }
  } catch {}

  // 3) Direct embed scrape (works locally / with IG_SESSIONID, usually blocked on Vercel IPs)
  try {
    const html = await fetchEmbedHtml(shortcode);
    if (html) {
      const { video, image, username } = parseEmbedHtml(html);
      const user = username || 'instagram_user';
      if (video) {
        const file = `sssinstagram_${shortcode}_${user}.mp4`;
        const px = `/api/proxy-media?url=${encodeURIComponent(video)}&filename=${encodeURIComponent(file)}`;
        return res.status(200).json({
          id: shortcode, mediaType: rawUrl.includes('/reel') ? 'reels' : 'video', originalUrl: rawUrl,
          author: { username: user, fullName: user, avatar: '', isVerified: false },
          caption: `Instagram video by @${user}`, items: [{
            id: `item_${shortcode}_1`, type: 'video', url: px, downloadUrl: px,
            thumbnail: image || '', quality: '1080p Full HD', format: 'mp4', availableQualities: [],
          }],
        });
      }
      if (image) {
        const file = `sssinstagram_${shortcode}_${user}.jpg`;
        const px = `/api/proxy-media?url=${encodeURIComponent(image)}&filename=${encodeURIComponent(file)}`;
        return res.status(200).json({
          id: shortcode, mediaType: 'photo', originalUrl: rawUrl,
          author: { username: user, fullName: user, avatar: '', isVerified: false },
          caption: `Instagram photo by @${user}`, items: [{
            id: `item_${shortcode}_1`, type: 'photo', url: px, downloadUrl: px,
            thumbnail: image, quality: '1080p Ultra HD', format: 'jpg', availableQualities: [],
          }],
        });
      }
    }
  } catch {}

  // 4) oEmbed — tells public vs private/deleted apart (reuses the early lookup)
  const oembed = oembedEarly;
  if (!oembed) {
    return res.status(404).json({
      error:
        'Media not found. The post is private, deleted, or all free providers are busy — please try again in a minute.',
      shortcode,
    });
  }
  // Public post confirmed, but only a thumbnail is available without a media provider
  const thumb: string = (oembed as any).thumbnail_url || '';
  const author: string = (oembed as any).author_name || 'instagram_user';
  if (thumb) {
    const file = `sssinstagram_${shortcode}_${author}.jpg`;
    const px = `/api/proxy-media?url=${encodeURIComponent(thumb)}&filename=${encodeURIComponent(file)}`;
    return res.status(200).json({
      id: shortcode, mediaType: 'photo', originalUrl: rawUrl,
      author: { username: author, fullName: (oembed as any).title || author, avatar: '', isVerified: false },
      caption: (oembed as any).title || `Instagram post by ${author}`,
      note: 'HD video needs RAPIDAPI_KEY / COBALT_API_URL configured — showing full-quality cover image for now.',
      items: [{
        id: `item_${shortcode}_1`, type: 'photo', url: px, downloadUrl: px,
        thumbnail: thumb, quality: 'Original quality', format: 'jpg', availableQualities: [],
      }],
    });
  }
  return res.status(404).json({ error: 'Media not found. The post might be private, deleted, or restricted.', shortcode });
}
