import React from 'react';
import {
  Globe,
  FileText,
  Shield,
  AlertTriangle,
  FileCode,
  Lock,
  ArrowUp,
  BookOpen,
  Info,
  Mail,
  HelpCircle,
  ListChecks,
} from 'lucide-react';
import { LanguageCode, MediaType, SiteBrandingSettings } from '../types';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS } from '../data/i18nData';

interface FooterProps {
  currentLanguage: LanguageCode;
  activeTool: MediaType;
  branding?: SiteBrandingSettings;
  onSelectTool: (tool: MediaType) => void;
  onSelectLanguage: (lang: LanguageCode) => void;
  onOpenSitemap: () => void;
  onOpenAdmin: () => void;
}

const infoLinks = [
  { href: '/about', label: 'About Us', icon: Info },
  { href: '/how-to-use', label: 'How to Use', icon: ListChecks },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
  { href: '/contact', label: 'Contact Us', icon: Mail },
  { href: '/blog', label: 'Guides & Blog', icon: BookOpen },
];

const legalLinks = [
  { href: '/terms', label: 'Terms of Use', icon: FileText },
  { href: '/privacy', label: 'Privacy Policy', icon: Shield },
  { href: '/disclaimer', label: 'Disclaimer', icon: AlertTriangle },
];

export const Footer: React.FC<FooterProps> = ({
  currentLanguage,
  activeTool: _activeTool,
  branding,
  onSelectTool,
  onSelectLanguage,
  onOpenSitemap,
  onOpenAdmin,
}) => {
  const siteName = branding?.siteName || 'IGSaveGo';
  const siteTagline = branding?.siteTagline || 'Fast & HD Media Saver';
  const customLogoUrl = branding?.customLogoUrl;
  const logoType = branding?.logoType || 'default';
  const copyrightText = branding?.copyrightText || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`;
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

  const linkClass =
    'flex items-center gap-1.5 rounded hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 gap-8 mb-12 sm:grid-cols-2 lg:grid-cols-4">
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
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
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
              {siteName} is a free browser-based tool for saving publicly available Instagram
              videos, Reels, photos and IGTV posts. It is an independent project, not affiliated
              with Instagram or Meta.
            </p>
            <p className="text-xs font-semibold text-slate-500">{siteTagline}</p>
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Lock className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                <span>Admin Portal</span>
              </button>
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-xs text-slate-500 hover:text-slate-700 transition-colors underline underline-offset-2"
                >
                  {contactEmail}
                </a>
              )}
            </div>
          </div>

          {/* Media Tools Col */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Instagram Tools
            </h2>
            <ul className="space-y-2 text-xs">
              {toolsList.map((item) => (
                <li key={item.type}>
                  <button
                    onClick={() => {
                      onSelectTool(item.type);
                      scrollToTop();
                    }}
                    className="hover:text-rose-600 transition-colors text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    Instagram {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Information Col */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Information
            </h2>
            <ul className="space-y-2 text-xs">
              {infoLinks.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <a href={href} className={linkClass}>
                    <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Languages Col */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Legal &amp; Language
            </h2>
            <ul className="space-y-2 text-xs">
              {legalLinks.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <a href={href} className={linkClass}>
                    <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                </li>
              ))}
              <li>
                <button
                  id="btn-open-sitemap"
                  onClick={onOpenSitemap}
                  className="flex items-center gap-1.5 text-rose-700 font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.sitemap} (SEO Engine)</span>
                </button>
              </li>
            </ul>

            <h2 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
              <span>Languages</span>
            </h2>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onSelectLanguage(lang.code);
                    scrollToTop();
                  }}
                  className={`flex items-center gap-1.5 py-1 text-left rounded-md px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                    currentLanguage === lang.code
                      ? 'text-rose-700 font-bold bg-rose-50'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  <span aria-hidden="true">{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-500 space-y-3">
          <p className="max-w-3xl mx-auto leading-relaxed">
            <strong className="text-slate-500">Disclaimer:</strong> {siteName} is an independent
            utility. It does not host or archive media files; files are streamed from Instagram&apos;s
            public CDN or relayed by fallback providers when direct requests fail. Instagram and Meta
            are trademarks of Meta Platforms, Inc. or its affiliates. This site is not affiliated
            with, endorsed by or sponsored by Instagram or Meta.{' '}
            <a href="/disclaimer" className="underline underline-offset-2 hover:text-slate-600">
              Read the full disclaimer
            </a>
            .
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div>{copyrightText}</div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-semibold">
                Independent · No account required
              </span>
              <button
                onClick={scrollToTop}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                <span>Top</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
