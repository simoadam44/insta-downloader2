import React from 'react';
import {
  Globe,
  FileText,
  Shield,
  AlertTriangle,
  FileCode,
  Lock,
  ArrowUp,
} from 'lucide-react';
import { LanguageCode, MediaType, SiteBrandingSettings } from '../types';
import { SUPPORTED_LANGUAGES, TOOL_SLUGS, UI_TRANSLATIONS } from '../data/i18nData';

interface FooterProps {
  currentLanguage: LanguageCode;
  activeTool: MediaType;
  branding?: SiteBrandingSettings;
  onSelectTool: (tool: MediaType) => void;
  onSelectLanguage: (lang: LanguageCode) => void;
  onOpenLegal: (type: 'terms' | 'privacy' | 'disclaimer') => void;
  onOpenSitemap: () => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  currentLanguage,
  activeTool: _activeTool,
  branding,
  onSelectTool,
  onSelectLanguage,
  onOpenLegal,
  onOpenSitemap,
  onOpenAdmin,
}) => {
  const siteName = branding?.siteName || 'IGSaveGo';
  const siteTagline = branding?.siteTagline || 'Fast & HD Media Saver';
  const customLogoUrl = branding?.customLogoUrl;
  const logoType = branding?.logoType || 'default';
  const copyrightText = branding?.copyrightText || `© ${new Date().getFullYear()} ${siteName}. All rights reserved. Ultra-Fast Free Instagram Downloader.`;
  const contactEmail = branding?.contactEmail || 'support@igsavego.com';

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toolsList: { type: MediaType; label: string }[] = [
    { type: 'video', label: t.navVideo + ' Downloader' },
    { type: 'reels', label: t.navReels + ' Downloader' },
    { type: 'photo', label: t.navPhoto + ' Downloader' },
    { type: 'story', label: t.navStory + ' Saver' },
    { type: 'highlights', label: t.navHighlights + ' Downloader' },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {logoType === 'image' && customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt={siteName}
                  className="h-9 max-w-[140px] object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white font-bold">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                </div>
              )}
              <div className="text-xl font-black text-slate-900">
                {siteName.length > 3 && siteName.toLowerCase().startsWith('sss') ? (
                  <>
                    <span>SSS</span>
                    <span className="text-rose-500">{siteName.slice(3)}</span>
                  </>
                ) : (
                  <span>{siteName}</span>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {siteName} is the leading free web tool designed to help you download Instagram videos, photos, reels, and stories in high definition without watermarks.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Lock className="h-3.5 w-3.5 text-amber-500" />
                <span>Admin Portal</span>
              </button>
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline"
                >
                  {contactEmail}
                </a>
              )}
            </div>
          </div>

          {/* Media Tools Col */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Instagram Tools
            </h4>
            <ul className="space-y-2 text-xs">
              {toolsList.map((item) => (
                <li key={item.type}>
                  <button
                    onClick={() => {
                      onSelectTool(item.type);
                      scrollToTop();
                    }}
                    className="hover:text-rose-600 transition-colors text-left"
                  >
                    Instagram {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Multi-Language Links Col */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-rose-500" />
              <span>International Languages</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onSelectLanguage(lang.code);
                    scrollToTop();
                  }}
                  className={`flex items-center gap-1.5 py-1 text-left rounded-md px-1 transition-colors ${
                    currentLanguage === lang.code
                      ? 'text-rose-600 font-bold bg-rose-50'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Legal & Compliance Col */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Legal & SEO
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onOpenLegal('terms')}
                  className="flex items-center gap-1.5 hover:text-rose-600 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{t.terms}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal('privacy')}
                  className="flex items-center gap-1.5 hover:text-rose-600 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  <span>{t.privacy}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal('disclaimer')}
                  className="flex items-center gap-1.5 hover:text-rose-600 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  <span>{t.disclaimer}</span>
                </button>
              </li>
              <li>
                <button
                  id="btn-open-sitemap"
                  onClick={onOpenSitemap}
                  className="flex items-center gap-1.5 text-rose-600 font-semibold hover:underline"
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>{t.sitemap} (SEO Engine)</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-400 space-y-3">
          <p className="max-w-3xl mx-auto leading-relaxed">
            <strong>Disclaimer:</strong> {siteName} is an independent educational and utility web tool. We do not host, store, or archive copyrighted media files on our servers. All video and photo streams are fetched directly from Instagram’s public CDN. Instagram™ and Meta™ are registered trademarks of Meta Platforms, Inc. This application is not affiliated with, endorsed by, or sponsored by Instagram or Meta.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div>
              {copyrightText}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Vercel Edge Ready
              </span>
              <button
                onClick={scrollToTop}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <ArrowUp className="h-3 w-3" />
                <span>Top</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
