import React, { useState } from 'react';
import {
  Video,
  Image as ImageIcon,
  Sparkles,
  CircleDot,
  FolderHeart,
  Clipboard,
  X,
  ArrowDownToLine,
  Loader2,
  ShieldCheck,
  Zap,
  Lock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { LanguageCode, MediaType, ToolSeoContent } from '../types';
import { TOOL_CONTENT, UI_TRANSLATIONS } from '../data/i18nData';
import { DEMO_URLS } from '../services/extractorService';

interface HeroSectionProps {
  currentLanguage: LanguageCode;
  activeTool: MediaType;
  customContent?: Partial<ToolSeoContent>;
  onSelectTool: (tool: MediaType) => void;
  onExtract: (url: string) => void;
  isLoading: boolean;
  errorMessage?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentLanguage,
  activeTool,
  customContent,
  onSelectTool,
  onExtract,
  isLoading,
  errorMessage,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const baseContent = TOOL_CONTENT[activeTool][currentLanguage] || TOOL_CONTENT[activeTool]['en'];
  const content = { ...baseContent, ...customContent };

  const tabs: { type: MediaType; label: string; icon: React.ElementType }[] = [
    { type: 'video', label: t.navVideo, icon: Video },
    { type: 'photo', label: t.navPhoto, icon: ImageIcon },
    { type: 'reels', label: t.navReels, icon: Sparkles },
    { type: 'story', label: t.navStory, icon: CircleDot },
    { type: 'highlights', label: t.navHighlights, icon: FolderHeart },
  ];

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setUrlInput(text.trim());
          setPasteNotice('Pasted from clipboard!');
          setTimeout(() => setPasteNotice(null), 2500);
          return;
        }
      }
    } catch {
      // Clipboard access denied or blocked by browser/iframe policy
    }
    // Inform user cleanly without forced mock data injection
    const inputEl = document.getElementById('input-instagram-url');
    if (inputEl) inputEl.focus();
    setPasteNotice('Press Ctrl+V (or ⌘+V) to paste your Instagram link.');
    setTimeout(() => setPasteNotice(null), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      const inputEl = document.getElementById('input-instagram-url');
      if (inputEl) inputEl.focus();
      setPasteNotice('Please paste or type an Instagram URL first.');
      setTimeout(() => setPasteNotice(null), 2500);
      return;
    }
    onExtract(urlInput.trim());
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-rose-50/50 via-white to-slate-50 py-10 sm:py-16">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-tr from-rose-400/15 via-pink-500/10 to-amber-300/15 blur-3xl" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Tool Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700 shadow-2xs">
          <Zap className="h-3.5 w-3.5 text-rose-600 fill-rose-600" />
          <span>{content.badge}</span>
        </div>

        {/* Dynamic H1 Heading */}
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-5xl">
          {content.h1}
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
          {content.subtitle}
        </p>

        {/* Tab Switcher Menu */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-md shadow-slate-200/60 border border-slate-200/80">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTool === tab.type;
              return (
                <button
                  key={tab.type}
                  id={`tab-btn-${tab.type}`}
                  onClick={() => onSelectTool(tab.type)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 text-white shadow-sm shadow-rose-500/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Floating URL Input Bar */}
        <div className="mx-auto mt-6 max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="relative flex flex-col sm:flex-row items-stretch rounded-2xl bg-white p-2 shadow-xl shadow-slate-200/70 border border-slate-200 focus-within:border-rose-400 focus-within:ring-4 focus-within:ring-rose-500/15 transition-all"
          >
            {/* Input field */}
            <div className="relative flex flex-1 items-center px-3 py-1">
              <input
                id="input-instagram-url"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden pr-16"
                disabled={isLoading}
              />

              {/* Action buttons inside input: Clear & Paste */}
              <div className="absolute right-2 flex items-center gap-1">
                {urlInput && (
                  <button
                    type="button"
                    id="btn-clear-url"
                    onClick={() => setUrlInput('')}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title={t.clearBtn}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  id="btn-paste-url"
                  onClick={handlePaste}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Paste link from clipboard"
                >
                  <Clipboard className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">{t.pasteBtn}</span>
                </button>
              </div>
            </div>

            {/* Vibrant Download CTA Button */}
            <button
              type="submit"
              id="btn-submit-download"
              disabled={isLoading}
              className="mt-2 sm:mt-0 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-md shadow-rose-500/30 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-75 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{t.processingBtn}</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="h-5 w-5" />
                  <span>{t.downloadBtn}</span>
                </>
              )}
            </button>
          </form>

          {/* Paste Notification */}
          {pasteNotice && (
            <div className="mt-2 text-xs font-semibold text-emerald-600 animate-in fade-in">
              ✓ {pasteNotice}
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div
              id="error-banner"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs sm:text-sm text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-800">{errorMessage}</div>
                  <div className="text-[11px] text-rose-600/90 mt-0.5">
                    تأكد من نسخ رابط المنشور العام (Public) بشكل صحيح وحاول مرة أخرى.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onExtract(urlInput || 'https://www.instagram.com/p/DdPm6hxgjC9/')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          )}

          {/* Sample Demo URL Pills */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-400">{t.demoUrlsTitle}</span>
            {DEMO_URLS.map((demo) => (
              <button
                key={demo.type}
                type="button"
                id={`btn-sample-${demo.type}`}
                onClick={() => {
                  onSelectTool(demo.type);
                  setUrlInput(demo.url);
                  onExtract(demo.url);
                }}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-600 transition-colors"
              >
                {demo.label}
              </button>
            ))}
          </div>

          {/* Trust Guarantees */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500 sm:gap-8">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>100% Free & Anonymous</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-blue-500" />
              <span>No Login Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Ultra-Fast Cloud CDN</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
