import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Clipboard,
  HelpCircle,
  Loader2,
  MonitorPlay,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { ExtractedMedia } from '../types';
import { MediaResultCard } from './MediaResultCard';
import { detectLoomUrl, extractLoomMedia } from '../services/loomService';

/**
 * Interactive downloader embedded in the /loom-downloader page.
 *
 * A Loom recording is a single video with an optional thumbnail, so there are no
 * tabs here: paste the share link, get the MP4 Loom itself serves.
 */
export const LoomDownloader: React.FC = () => {
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
    document.getElementById('input-loom-url')?.focus();
    showNotice('Press Ctrl+V (or ⌘+V) to paste your Loom link.');
  };

  const runExtraction = async (rawUrl: string) => {
    const check = detectLoomUrl(rawUrl);
    if (!check.isValid) {
      setError(check.error || 'Paste a Loom video link.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLastUrl(rawUrl);

    try {
      const media = await extractLoomMedia(rawUrl);
      setResult(media);
      window.setTimeout(() => {
        document.getElementById('loom-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err: any) {
      setError(err?.message || 'Could not read that Loom recording. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlInput.trim()) {
      document.getElementById('input-loom-url')?.focus();
      showNotice('Please paste or type a Loom video link first.');
      return;
    }
    void runExtraction(urlInput.trim());
  };

  return (
    <section
      aria-label="Loom video downloader"
      className="relative overflow-hidden bg-gradient-to-b from-sky-50/70 via-white to-slate-50 py-10 sm:py-14"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-400/20 via-violet-300/15 to-cyan-200/20 blur-3xl" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50 px-3.5 py-1 text-xs font-semibold text-sky-900 shadow-2xs">
            <Zap className="h-3.5 w-3.5 fill-sky-700 text-sky-700" aria-hidden="true" />
            Free · No login · Original file
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Paste a Loom video link
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Works with public Loom recordings. The tool asks Loom&apos;s own public API for the recording and
            hands over the MP4 Loom serves, plus its thumbnail — no screen recording, no watermark.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60 sm:flex-row sm:items-center">
            <label htmlFor="input-loom-url" className="sr-only">
              Loom video URL
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
              <MonitorPlay className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                id="input-loom-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://www.loom.com/share/44bff3b7cd784946a61686092a353f48"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60 sm:flex-none cursor-pointer"
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
            Supported: /share/&lt;id&gt;, /embed/&lt;id&gt; and a bare recording id
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            No password or API key needed
          </span>
        </div>

        {result && (
          <div id="loom-result">
            <MediaResultCard
              media={result}
              currentLanguage="en"
              source="loom"
              onReset={() => {
                setResult(null);
                setError(null);
                setUrlInput('');
              }}
            />
            {lastUrl && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Fetched from a public Loom recording. Use the file within the rights the author granted.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
