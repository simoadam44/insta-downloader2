import React, { useState } from 'react';
import { Smartphone, Bookmark, Sparkles, Check, X, Share2, PlusSquare } from 'lucide-react';
import { LanguageCode } from '../types';
import { UI_TRANSLATIONS } from '../data/i18nData';

interface PwaBannerProps {
  currentLanguage: LanguageCode;
  isOpenModal?: boolean;
  onCloseModal?: () => void;
}

/**
 * "Add to home screen" helper.
 *
 * This is intentionally NOT presented as an app install and never claims that
 * anything was installed: the project ships no web app manifest and no service
 * worker, so there is no real PWA install flow to trigger. The panel only shows
 * the browser's own bookmark/shortcut instructions.
 */
export const PwaBanner: React.FC<PwaBannerProps> = ({
  currentLanguage,
  isOpenModal,
  onCloseModal,
}) => {
  const [showGuide, setShowGuide] = useState(false);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const handleGuideClick = () => {
    setShowGuide(true);
  };

  const content = (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 p-8 sm:p-10 text-white shadow-2xl">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center justify-between gap-8 lg:flex-row">
        <div className="max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-rose-300 backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            <span>Browser shortcut</span>
          </div>

          <h3 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
            Add IGSaveGo to your home screen
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
            Create a shortcut in your mobile browser so the downloader opens in one tap. This
            saves a link to this website — it does not download an app.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-300 lg:justify-start">
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> Opens in one tap
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> No app store, no file
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> Always the current site
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row">
          <button
            id="btn-install-pwa-cta"
            onClick={handleGuideClick}
            className="flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:brightness-110 active:scale-95 sm:text-base"
          >
            <Bookmark className="h-5 w-5" aria-hidden="true" />
            <span>How to add a shortcut</span>
          </button>

          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/5 px-4 py-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 sm:text-sm"
          >
            <Smartphone className="h-4 w-4 text-purple-300" aria-hidden="true" />
            <span>{t.pwaBtn || 'Add to Home Screen'}</span>
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-xs backdrop-blur-md animate-in fade-in sm:text-sm">
          <div className="mb-3 font-bold text-rose-300">How to add a shortcut</div>

          <div className="space-y-3 text-slate-200">
            <div>
              <p className="font-semibold text-white">iPhone &amp; iPad (Safari)</p>
              <ol className="mt-1 list-inside list-decimal space-y-1.5">
                <li>Open this page in Safari.</li>
                <li className="flex items-center gap-1">
                  Tap the <Share2 className="inline h-3.5 w-3.5 text-blue-400" aria-hidden="true" />{' '}
                  <strong>Share</strong> icon in the toolbar.
                </li>
                <li className="flex items-center gap-1">
                  Choose <PlusSquare className="inline h-3.5 w-3.5 text-slate-300" aria-hidden="true" />{' '}
                  <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                </li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-white">Android (Chrome, Edge, Firefox)</p>
              <p className="mt-1">
                Open the browser menu (⋮) and choose <strong>Add to Home screen</strong> or
                <strong> Install</strong> if your browser offers it. The exact label depends on the
                browser version.
              </p>
            </div>

            <div>
              <p className="font-semibold text-white">Desktop (Chrome, Edge)</p>
              <p className="mt-1">
                Use the install icon in the address bar, or the browser menu →{' '}
                <strong>Cast, save and share</strong> → <strong>Install page as app</strong> when
                available.
              </p>
            </div>

            <p className="text-[11px] text-slate-400">
              Availability and wording are controlled by your browser. Nothing is installed unless
              you confirm it there.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (isOpenModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
        <div className="relative w-full max-w-3xl">
          <button
            onClick={onCloseModal}
            className="absolute right-4 top-4 z-20 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            aria-label="Close shortcut instructions"
          >
            <X className="h-5 w-5" />
          </button>
          {content}
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {content}
    </section>
  );
};
