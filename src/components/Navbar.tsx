import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Image as ImageIcon,
  Sparkles,
  CircleDot,
  FolderHeart,
  Globe,
  DownloadCloud,
  ShieldAlert,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { LanguageCode, MediaType, SiteBrandingSettings } from '../types';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS } from '../data/i18nData';

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
  const langMenuRef = useRef<HTMLDivElement>(null);

  const siteName = branding?.siteName || 'SSSInstagram';
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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { type: MediaType; label: string; icon: React.ElementType }[] = [
    { type: 'video', label: t.navVideo, icon: Video },
    { type: 'photo', label: t.navPhoto, icon: ImageIcon },
    { type: 'reels', label: t.navReels, icon: Sparkles },
    { type: 'story', label: t.navStory, icon: CircleDot },
    { type: 'highlights', label: t.navHighlights, icon: FolderHeart },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <button
          id="btn-brand-logo"
          onClick={() => onSelectTool('video')}
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
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.type;
            return (
              <button
                key={item.type}
                id={`nav-link-${item.type}`}
                onClick={() => onSelectTool(item.type)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-rose-50 text-rose-600 font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-2 left-3 right-3 h-0.5 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Tools: PWA, Language, Admin */}
        <div className="flex items-center gap-2">
          {/* PWA App Install Button */}
          <button
            id="btn-install-app-nav"
            onClick={onOpenPwaPrompt}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 transition-colors lg:flex"
            title="Install Web App for 1-click downloads"
          >
            <DownloadCloud className="h-3.5 w-3.5 text-rose-500" />
            <span>{t.installApp}</span>
          </button>

          {/* Language Selector Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              id="btn-language-selector"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden"
              aria-label="Select Language"
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
                  <button
                    key={lang.code}
                    id={`btn-lang-${lang.code}`}
                    onClick={() => {
                      onSelectLanguage(lang.code);
                      setLangMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors ${
                      currentLanguage === lang.code
                        ? 'bg-rose-50 text-rose-600 font-bold'
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
                  </button>
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
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTool === item.type;
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    onSelectTool(item.type);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                onOpenPwaPrompt();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"
            >
              <DownloadCloud className="h-4 w-4" />
              <span>{t.installApp}</span>
            </button>
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
