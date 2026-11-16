import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Clipboard,
  HelpCircle,
  Loader2,
  Pin,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { ExtractedMedia } from '../types';
import { MediaResultCard } from './MediaResultCard';
import {
  PINTEREST_DEMO_URL,
  detectPinterestPinUrl,
  extractPinterestMedia,
} from '../services/pinterestService';

/**
 * Interactive downloader embedded in the /pinterest-downloader page.
 *
 * Deliberately separate from the Instagram hero: a Pinterest pin carries one
 * video or one image, so there are no tabs here. The result card is the shared
 * one with source="pinterest", so it shows the file's real format and size
 * instead of an invented resolution.
 */
export const PinterestDownloader: React.FC = () => {
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
    document.getElementById('input-pinterest-url')?.focus();
    showNotice('Press Ctrl+V (or ⌘+V) to paste your Pinterest link.');
  };

  const runExtraction = async (rawUrl: string) => {
    const check = detectPinterestPinUrl(rawUrl);
    if (!check.isValid) {
      setError(check.error || 'Paste a Pinterest pin link.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLastUrl(rawUrl);

    try {
      const media = await extractPinterestMedia(rawUrl);
      setResult(media);
      window.setTimeout(() => {
        document.getElementById('pinterest-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Could not read that Pinterest pin. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlInput.trim()) {
      document.getElementById('input-pinterest-url')?.focus();
      showNotice('Please paste or type a Pinterest pin link first.');
      return;
    }
    void runExtraction(urlInput.trim());
  };

  return (
    <section
      aria-label="Pinterest downloader"
      className="relative overflow-hidden bg-gradient-to-b from-red-50/70 via-white to-slate-50 py-10 sm:py-14"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-tr from-red-400/15 via-rose-400/10 to-amber-300/15 blur-3xl" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200/80 bg-red-50 px-3.5 py-1 text-xs font-semibold text-red-700 shadow-2xs">
            <Zap className="h-3.5 w-3.5 fill-red-600 text-red-600" aria-hidden="true" />
            Free · No login · Original file
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Paste a Pinterest pin link
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Works with public pins that contain a video or an image. The tool reads the pin&apos;s
            public page and downloads the MP4 or image Pinterest publishes — not a screen recording.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60 sm:flex-row sm:items-center">
            <label htmlFor="input-pinterest-url" className="sr-only">
              Pinterest pin URL
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
              <Pin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                id="input-pinterest-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://www.pinterest.com/pin/664281013778109217/"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60 sm:flex-none cursor-pointer"
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
          <button
            type="button"
            onClick={() => {
              setUrlInput(PINTEREST_DEMO_URL);
              void runExtraction(PINTEREST_DEMO_URL);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 hover:border-red-300 hover:text-red-700 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
            Try an example pin
          </button>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            No password or API key needed
          </span>
        </div>

        {result && (
          <div id="pinterest-result">
            <MediaResultCard
              media={result}
              currentLanguage="en"
              source="pinterest"
              onReset={() => {
                setResult(null);
                setError(null);
                setUrlInput('');
              }}
            />
            {lastUrl && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Fetched from a public Pinterest pin. Use the file within the rights the author granted.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
