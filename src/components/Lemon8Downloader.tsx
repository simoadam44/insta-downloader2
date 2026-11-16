import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Clipboard,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { ExtractedMedia } from '../types';
import { MediaResultCard } from './MediaResultCard';
import { detectLemon8Url, extractLemon8Media } from '../services/lemon8Service';

/**
 * Interactive downloader embedded in the /lemon8-downloader page.
 *
 * Lemon8 posts are one of two things: a single video, or a gallery of images.
 * Both come back in the shared result card — the gallery simply fills its
 * carousel with every image, each with its own download button.
 */
export const Lemon8Downloader: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedMedia | null>(null);
  const [lastUrl, setLastUrl] = useState('');

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
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
    document.getElementById('input-lemon8-url')?.focus();
    showNotice('Press Ctrl+V (or ⌘+V) to paste your Lemon8 link.');
  };

  const runExtraction = async (rawUrl: string) => {
    const check = detectLemon8Url(rawUrl);
    if (!check.isValid) {
      setError(check.error || 'Paste a Lemon8 post link.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLastUrl(rawUrl);

    try {
      const media = await extractLemon8Media(rawUrl);
      setResult(media);
      window.setTimeout(() => {
        document.getElementById('lemon8-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Could not read that Lemon8 post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlInput.trim()) {
      document.getElementById('input-lemon8-url')?.focus();
      showNotice('Please paste or type a Lemon8 post link first.');
      return;
    }
    void runExtraction(urlInput.trim());
  };

  return (
    <section
      aria-label="Lemon8 downloader"
      className="relative overflow-hidden bg-gradient-to-b from-amber-50/70 via-white to-slate-50 py-10 sm:py-14"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-tr from-amber-400/20 via-rose-300/15 to-yellow-200/20 blur-3xl" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-900 shadow-2xs">
            <Zap className="h-3.5 w-3.5 fill-amber-700 text-amber-700" aria-hidden="true" />
            Free · No login · Original file
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Paste a Lemon8 post link
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Works with public Lemon8 posts that contain a video or a photo gallery. The tool reads the
            post&apos;s public page and hands over the MP4 or images Lemon8 itself serves — not a screen
            recording.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60 sm:flex-row sm:items-center">
            <label htmlFor="input-lemon8-url" className="sr-only">
              Lemon8 post URL
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
              <Sparkles className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                id="input-lemon8-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://www.lemon8-app.com/@name/7012345678901234567"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60 sm:flex-none cursor-pointer"
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
              <span className="flex-1">{error}</span>
            </div>
          )}
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600">
            Supported: /@name/&lt;post id&gt; links with an optional ?region=
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            No password or API key needed
          </span>
        </div>

        {result && (
          <div id="lemon8-result">
            <MediaResultCard
              media={result}
              currentLanguage="en"
              source="lemon8"
              onReset={() => {
                setResult(null);
                setError(null);
                setUrlInput('');
              }}
            />
            {lastUrl && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Fetched from a public Lemon8 post. Use the file within the rights the author granted.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
