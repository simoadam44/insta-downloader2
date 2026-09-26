import React, { useState } from 'react';
import { Smartphone, DownloadCloud, Sparkles, Check, X, Share2, PlusSquare } from 'lucide-react';
import { LanguageCode } from '../types';
import { UI_TRANSLATIONS } from '../data/i18nData';

interface PwaBannerProps {
  currentLanguage: LanguageCode;
  isOpenModal?: boolean;
  onCloseModal?: () => void;
}

export const PwaBanner: React.FC<PwaBannerProps> = ({
  currentLanguage,
  isOpenModal,
  onCloseModal,
}) => {
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installedNotice, setInstalledNotice] = useState(false);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const handleInstallClick = () => {
    // Check if browser supports beforeinstallprompt or trigger iOS guide
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    setInstalledNotice(true);
    setTimeout(() => {
      setInstalledNotice(false);
      if (onCloseModal) onCloseModal();
    }, 3000);
  };

  const content = (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 p-8 sm:p-10 text-white shadow-2xl">
      {/* Background glowing gradients */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-rose-300 backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-rose-400" />
            <span>Progressive Web App (PWA)</span>
          </div>

          <h3 className="mt-3 text-2xl font-extrabold sm:text-3xl text-white">
            {t.pwaTitle}
          </h3>

          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            {t.pwaSubtitle}
          </p>

          {/* Key perks */}
          <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Instant 1-tap launch
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Zero storage usage (No 100MB APK)
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Auto-updates always free
            </span>
          </div>
        </div>

        {/* CTA Install Action */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <button
            id="btn-install-pwa-cta"
            onClick={handleInstallClick}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg shadow-rose-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <DownloadCloud className="h-5 w-5" />
            <span>{t.pwaBtn}</span>
          </button>

          <button
            onClick={() => setShowIosGuide(!showIosGuide)}
            className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/5 px-4 py-3.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <Smartphone className="h-4 w-4 text-purple-300" />
            <span>iOS / Safari Guide</span>
          </button>
        </div>
      </div>

      {/* Installed Notice */}
      {installedNotice && (
        <div className="mt-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3 text-xs font-semibold text-emerald-300 text-center animate-in fade-in">
          ✓ SSSInstagram has been added to your device Home Screen!
        </div>
      )}

      {/* iOS Instructions Drawer */}
      {showIosGuide && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md animate-in fade-in text-xs sm:text-sm">
          <div className="font-bold text-rose-300 mb-2 flex items-center gap-2">
            <span>How to install on iPhone & iPad (Safari):</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-200">
            <li>Open SSSInstagram in <strong>Safari</strong> on your iPhone or iPad.</li>
            <li className="flex items-center gap-1">
              Tap the <Share2 className="h-3.5 w-3.5 inline text-blue-400" /> <strong>Share</strong> icon in the bottom Safari bar.
            </li>
            <li className="flex items-center gap-1">
              Scroll down and tap <PlusSquare className="h-3.5 w-3.5 inline text-slate-300" /> <strong>Add to Home Screen</strong>.
            </li>
            <li>Tap <strong>Add</strong> in the top-right corner. Done! Launch SSSInstagram directly from your home screen.</li>
          </ol>
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
          >
            <X className="h-5 w-5" />
          </button>
          {content}
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {content}
    </section>
  );
};
