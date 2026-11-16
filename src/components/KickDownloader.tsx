import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  Clipboard,
  Clock,
  Copy,
  Eye,
  Gamepad2,
  Heart,
  HelpCircle,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
  X,
  Zap,
} from 'lucide-react';
import {
  KICK_CLIP_DEMO_URL,
  KICK_VOD_DEMO_URL,
  KickResult,
  detectKickUrl,
  extractKickMedia,
  fetchKickVodStatus,
  kickVodFileUrl,
  startKickVodDownload,
} from '../services/kickService';

/**
 * Interactive downloader embedded in the /kick-downloader page.
 *
 * A Kick clip resolves to one file that this site assembles and streams (see
 * /api/kick-clip), so it gets a real download button. A Kick VOD is a
 * multi-gigabyte HLS stream, so the panel shows its real variant playlists and
 * a ready yt-dlp command instead of a button that could not deliver an MP4.
 */
export const KickDownloader: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<KickResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [vodJob, setVodJob] = useState<{ percent: number; state: string; label: string } | null>(null);
  /** True once the host answered that it cannot build a VOD (no Node server). */
  const [vodUnavailable, setVodUnavailable] = useState(false);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const copyToClipboard = async (value: string, tag: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(tag);
      showNotice(message);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      showNotice('Copy failed — select the text and copy it manually.');
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setUrlInput(text.trim());
          showNotice('Pasted from clipboard.');
          return;
        }
      }
    } catch {
      // Clipboard permission denied — focus the field and let the user paste.
    }
    document.getElementById('input-kick-url')?.focus();
    showNotice('Press Ctrl+V (or ⌘+V) to paste your Kick link.');
  };

  const runExtraction = async (rawUrl: string) => {
    const check = detectKickUrl(rawUrl);
    if (!check.isValid) {
      setError(check.error || 'Paste a Kick clip or VOD link.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setVodUnavailable(false);

    try {
      const media = await extractKickMedia(rawUrl);
      setResult(media);
      window.setTimeout(() => {
        document.getElementById('kick-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Could not read that Kick link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlInput.trim()) {
      document.getElementById('input-kick-url')?.focus();
      showNotice('Please paste or type a Kick link first.');
      return;
    }
    void runExtraction(urlInput.trim());
  };

  // Builds the whole VOD on the server (ffmpeg remux), polling real progress and
  // then handing the browser a normal file with an exact size and percentage.
  const beginVodDownload = async (quality: string) => {
    if (result?.kind !== 'vod' || vodJob) return;
    setError(null);
    setVodJob({ percent: 0, state: 'preparing', label: quality });

    try {
      const id = await startKickVodDownload(result.pageUrl, quality);
      const timer = window.setInterval(async () => {
        try {
          const status = await fetchKickVodStatus(id);
          setVodJob({ percent: status.percent, state: status.state, label: status.label || quality });
          if (status.state === 'done') {
            window.clearInterval(timer);
            window.location.href = kickVodFileUrl(id);
            window.setTimeout(() => setVodJob(null), 5000);
          } else if (status.state === 'error') {
            window.clearInterval(timer);
            setVodJob(null);
            setError(status.error || 'The download failed. Please try again.');
          }
        } catch {
          window.clearInterval(timer);
          setVodJob(null);
          setError('Lost contact with the download. Please try again.');
        }
      }, 1000);
    } catch (err: any) {
      setVodJob(null);
      const message = err?.message || 'Could not start the download.';
      if (message.includes('needs the Node server build')) setVodUnavailable(true);
      setError(message);
    }
  };

  // The smallest quality is the practical default: a whole VOD is many GB.
  const lowestVariant =
    result?.kind === 'vod'
      ? result.variants.reduce((a, b) =>
          (parseInt(a.bitrate.replace(/[^0-9]/g, ''), 10) || 0) <=
          (parseInt(b.bitrate.replace(/[^0-9]/g, ''), 10) || 0)
            ? a
            : b
        )
      : null;

  return (
    <section
      aria-label="Kick downloader"
      className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-slate-50 py-10 sm:py-14"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-400/15 via-lime-300/10 to-teal-300/15 blur-3xl" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
            <Zap className="h-3.5 w-3.5 fill-emerald-600 text-emerald-600" aria-hidden="true" />
            Free · No login · No watermark
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Paste a Kick clip or VOD link
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Clips are rebuilt from Kick&apos;s own segments into one file you can download. VODs are
            several gigabytes of live stream, so this page hands you their real quality playlists
            and a ready yt-dlp command instead.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60 sm:flex-row sm:items-center">
            <label htmlFor="input-kick-url" className="sr-only">
              Kick clip or VOD URL
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
              <Gamepad2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                id="input-kick-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://kick.com/xqc?clip=clip_01H811MXG4FBR62FXPE1AXABDH"
                className="w-full border-0 bg-transparent py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput('')}
                  aria-label="Clear the input"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Clipboard className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                Paste
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60 sm:flex-none cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Fetching…
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                    Get media
                  </>
                )}
              </button>
            </div>
          </div>

          {notice && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {notice}
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 leading-relaxed"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 whitespace-pre-line">{error}</span>
            </div>
          )}
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setUrlInput(KICK_CLIP_DEMO_URL);
              void runExtraction(KICK_CLIP_DEMO_URL);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Try an example clip
          </button>
          <button
            type="button"
            onClick={() => {
              setUrlInput(KICK_VOD_DEMO_URL);
              void runExtraction(KICK_VOD_DEMO_URL);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Try an example VOD
          </button>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            No password or API key needed
          </span>
        </div>

        {result?.kind === 'clip' && (
          <div
            id="kick-result"
            className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-900 sm:h-32 sm:w-44">
                {result.thumbnailUrl ? (
                  <img
                    src={result.thumbnailUrl}
                    alt={`Thumbnail for the Kick clip by ${result.channel}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  CLIP
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  {result.channel ? `@${result.channel}` : 'Kick clip'}
                  {result.category ? <span className="text-slate-400">· {result.category}</span> : null}
                </div>
                <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-900">{result.title}</h3>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  {result.duration && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      {result.duration}
                    </span>
                  )}
                  {result.fileSize && <span>{result.fileSize}</span>}
                  {result.views && (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                      {result.views}
                    </span>
                  )}
                  {result.likes && (
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
                      {result.likes}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={result.downloadUrl}
                    download={result.filename}
                    id="btn-download-kick-clip"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/25 hover:brightness-105 transition-all"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                    Download clip {result.fileSize ? `(${result.fileSize})` : ''}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.downloadUrl, 'clip', 'Clip link copied.')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {copied === 'clip' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    )}
                    Copy clip link
                  </button>
                  {result.thumbnailDownload && (
                    <a
                      href={result.thumbnailDownload}
                      download
                      title="Saves the clip artwork as a .webp image, not the clip itself."
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Thumbnail (.webp)
                    </a>
                  )}
                </div>
              </div>
            </div>

            <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] leading-relaxed text-slate-600 sm:px-5">
              {result.note}
            </p>
          </div>
        )}

        {result?.kind === 'vod' && (
          <div
            id="kick-result"
            className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-900 sm:h-32 sm:w-44">
                {result.thumbnail ? (
                  // Kick's VOD artwork is a 5x5 sprite sheet of 16:9 frames, so
                  // the sheet is scaled to 5x the box and pinned to the corner:
                  // the card then shows one real frame instead of the mosaic.
                  <div
                    role="img"
                    aria-label={`Thumbnail for the Kick VOD by ${result.channel.name}`}
                    className="h-full w-full bg-slate-900"
                    style={{
                      backgroundImage: `url(${result.thumbnail})`,
                      backgroundSize: '500% 500%',
                      backgroundPosition: 'top left',
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                ) : null}
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  VOD
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  {result.channel.name ? `@${result.channel.name}` : 'Kick VOD'}
                  {result.category ? <span className="text-slate-400">· {result.category}</span> : null}
                </div>
                <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-900">{result.title}</h3>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  {result.duration && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      {result.duration}
                    </span>
                  )}
                  {result.views && (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                      {result.views}
                    </span>
                  )}
                  {result.startedAt && <span className="truncate">{result.startedAt.slice(0, 10)}</span>}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {vodUnavailable ? (
                    <p className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      A whole VOD cannot be joined into one MP4 on this deployment. Open one of the
                      quality playlists below in VLC or MPV, or copy the yt-dlp command to save it as
                      an MP4 on your computer.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void beginVodDownload(lowestVariant?.label || '')}
                      disabled={Boolean(vodJob)}
                      id="btn-download-kick-vod"
                      title="The whole VOD as one MP4 at the lowest quality. The server builds the file first, so the browser shows a real percentage."
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/25 hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-progress cursor-pointer"
                    >
                      {vodJob ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {vodJob
                        ? `${vodJob.state === 'preparing' ? 'Preparing' : 'Building MP4'} ${vodJob.percent}%`
                        : `Download video (MP4${lowestVariant ? ` · ${lowestVariant.label}` : ''})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.ytdlp, 'ytdlp', 'yt-dlp command copied.')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {copied === 'ytdlp' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Terminal className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    )}
                    Copy yt-dlp command
                  </button>
                  {result.thumbnailDownload && (
                    <a
                      href={result.thumbnailDownload}
                      download
                      title="Saves the VOD artwork as a .webp image, not the video itself."
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Download thumbnail (.webp)
                    </a>
                  )}
                </div>

                {vodJob && (
                  <div className="mt-3 max-w-sm">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>
                        {vodJob.state === 'preparing'
                          ? 'Reading the stream…'
                          : `Downloading ${vodJob.label || 'MP4'} on the server`}
                      </span>
                      <span>{vodJob.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(3, vodJob.percent)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      The browser download starts at 100% with a normal progress bar.
                    </p>
                  </div>
                )}

                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  A VOD of {result.duration || 'this length'} is one HLS stream of thousands of
                  segments ({result.variants.length} qualities, several gigabytes). The MP4 button
                  builds a whole quality track here first, then hands it to your browser with an
                  exact size, so you get a normal percentage and can pause or resume.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quality playlists</p>
              <div className="mt-2 space-y-1.5">
                {result.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-slate-800">
                      {variant.label}
                      {variant.resolution ? <span className="ml-1.5 text-slate-500">{variant.resolution}</span> : null}
                      {variant.bitrate ? <span className="ml-1.5 text-slate-400">· {variant.bitrate}</span> : null}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void beginVodDownload(variant.label)}
                        disabled={Boolean(vodJob)}
                        title={`Download the whole VOD as one MP4 at ${variant.label}.`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <ArrowDownToLine className="h-3 w-3" aria-hidden="true" />
                        MP4
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(variant.url, `variant-${variant.id}`, `${variant.label} playlist copied.`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {copied === `variant-${variant.id}` ? (
                          <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-500" aria-hidden="true" />
                        )}
                        Copy playlist
                      </button>
                      <a
                        href={variant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{result.note}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
