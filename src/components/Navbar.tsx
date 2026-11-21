import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Globe,
  ShieldAlert,
  Menu,
  X,
  ChevronDown,
  CloudSun,
  Linkedin,
  Pin,
  MonitorPlay,
  Twitter,
} from 'lucide-react';
import { LanguageCode, MediaType, SiteBrandingSettings } from '../types';
import { SUPPORTED_LANGUAGES, TOOL_SLUGS, UI_TRANSLATIONS } from '../data/i18nData';

interface NavbarProps {
  currentLanguage: LanguageCode;
  activeTool: MediaType;
  branding?: SiteBrandingSettings;
  onSelectTool: (tool: MediaType) => void;
  onSelectLanguage: (lang: LanguageCode) => void;
  onOpenAdmin: () => void;
  onOpenPwaPrompt: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  activeTool,
  branding,
  onSelectTool,
  onSelectLanguage,
  onOpenAdmin,
  onOpenPwaPrompt,
}) => {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [otherMenuOpen, setOtherMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const otherMenuRef = useRef<HTMLDivElement>(null);

  const siteName = branding?.siteName || 'IGSaveGo';
  const siteTagline = branding?.siteTagline || 'Fast & HD Media Saver';
  const customLogoUrl = branding?.customLogoUrl;
  const logoType = branding?.logoType || 'default';

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (otherMenuRef.current && !otherMenuRef.current.contains(event.target as Node)) {
        setOtherMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The header now advertises the site's platforms, not Instagram's media tabs:
  // the Instagram tools (video, photo, reels, story, highlights) live on the
  // home page itself. One list, used by the desktop nav and the mobile drawer,
  // so both stay in sync.
  const platformLinks: {
    id: string;
    href: string;
    label: string;
    icon: React.ElementType;
    iconClass: string;
    mobileClass: string;
  }[] = [
    { id: 'nav-link-bluesky', href: '/bluesky-downloader', label: 'Bluesky', icon: CloudSun, iconClass: 'text-sky-500', mobileClass: 'bg-sky-50 text-sky-800 hover:bg-sky-100' },
    { id: 'nav-link-linkedin', href: '/linkedin-downloader', label: 'LinkedIn', icon: Linkedin, iconClass: 'text-blue-600', mobileClass: 'bg-blue-50 text-blue-800 hover:bg-blue-100' },
    { id: 'nav-link-pinterest', href: '/pinterest-downloader', label: 'Pinterest', icon: Pin, iconClass: 'text-red-600', mobileClass: 'bg-red-50 text-red-800 hover:bg-red-100' },
    { id: 'nav-link-lemon8', href: '/lemon8-downloader', label: 'Lemon8', icon: Sparkles, iconClass: 'text-amber-500', mobileClass: 'bg-amber-50 text-amber-800 hover:bg-amber-100' },
    { id: 'nav-link-loom', href: '/loom-downloader', label: 'Loom', icon: MonitorPlay, iconClass: 'text-sky-600', mobileClass: 'bg-slate-100 text-slate-800 hover:bg-slate-200' },
    { id: 'nav-link-twitter', href: '/twitter-downloader', label: 'X / Twitter', icon: Twitter, iconClass: 'text-slate-900', mobileClass: 'bg-slate-100 text-slate-800 hover:bg-slate-200' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <a
          id="btn-brand-logo"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSelectTool('video');
          }}
          className="group flex items-center gap-2.5 text-left focus:outline-hidden"
        >
          {logoType === 'image' && customLogoUrl ? (
            <img
              src={customLogoUrl}
              alt={siteName}
              className="h-10 max-w-[140px] sm:max-w-[180px] object-contain rounded-lg"
              onError={(e) => {
                // fallback to default if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md shadow-rose-500/20 transition-transform duration-200 group-hover:scale-105">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-white">
                ↓
              </span>
            </div>
          )}

          {logoType !== 'image' || !customLogoUrl ? (
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  {siteName.length > 3 && siteName.toLowerCase().startsWith('sss') ? (
                    <>
                      <span>SSS</span>
                      <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">
                        {siteName.slice(3)}
                      </span>
                    </>
                  ) : (
                    <span className="bg-gradient-to-r from-slate-900 via-rose-600 to-purple-600 bg-clip-text text-transparent">
                      {siteName}
                    </span>
                  )}
                </span>
              </div>
              <span className="hidden text-[10px] font-semibold text-slate-400 sm:block">
                {siteTagline}
              </span>
            </div>
          ) : null}
        </a>

        {/* Desktop Navigation: Instagram stays the hero and the brand entity;
            every other platform lives behind one "Other tools" menu in its own
            /<platform>-downloader path, so each tool can rank for its own
            queries without splitting the homepage's Instagram signal. All real
            <a> elements, so every page stays crawlable. */}
        <nav aria-label="Tools" className="hidden items-center gap-1 md:flex">
          <a
            id="nav-link-instagram"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectTool('video');
            }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-bold whitespace-nowrap text-white transition-colors hover:bg-slate-800"
          >
            <Sparkles className="h-4 w-4 text-rose-400" aria-hidden="true" />
            <span>Instagram</span>
          </a>

          <div className="relative" ref={otherMenuRef}>
            <button
              type="button"
              id="btn-other-tools"
              aria-expanded={otherMenuOpen}
              aria-haspopup="menu"
              onClick={() => setOtherMenuOpen((open) => !open)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <span>Other tools</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${otherMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {otherMenuOpen && (
              <div
                role="menu"
                aria-labelledby="btn-other-tools"
                className="absolute left-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
              >
                <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Downloaders
                </p>
                {platformLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.id}
                      href={link.href}
                      id={link.id}
                      role="menuitem"
                      aria-label={`${link.label} downloader`}
                      title={`${link.label} downloader`}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Icon className={`h-4 w-4 ${link.iconClass}`} aria-hidden="true" />
                      <span>{link.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right Tools: PWA, Language, Admin */}
        <div className="flex items-center gap-2">
          {/* Language Selector Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              id="btn-language-selector"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden"
              aria-label={`Select language — current: ${currentLangObj.nativeName} (${currentLangObj.code.toUpperCase()})`}
            >
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold">{currentLangObj.flag} {currentLangObj.code.toUpperCase()}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Select Language (i18n)
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  /* Real hrefs so the eight translated tools are linked, not
                     only reachable through a click handler. */
                  <a
                    key={lang.code}
                    id={`btn-lang-${lang.code}`}
                    href={`/${lang.code}/${TOOL_SLUGS[activeTool]}`}
                    hrefLang={lang.code}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectLanguage(lang.code);
                      setLangMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors ${
                      currentLanguage === lang.code
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </span>
                    <span className="text-[10px] uppercase text-slate-400 font-mono">
                      {lang.code}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Admin Dashboard shortcut */}
          <button
            id="btn-open-admin-nav"
            onClick={onOpenAdmin}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition-colors"
            title="Open Admin Dashboard"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </button>

          {/* Mobile menu button */}
          <button
            id="btn-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectTool('video');
              setMobileMenuOpen(false);
            }}
            className="mb-2 flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold text-white"
          >
            <Sparkles className="h-4 w-4 text-rose-400" aria-hidden="true" />
            <span>Instagram downloader</span>
          </a>
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Other downloaders
          </p>
          <div className="grid grid-cols-2 gap-2">
            {platformLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${link.mobileClass}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
            <button
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>{t.admin}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
