import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { MediaResultCard } from './components/MediaResultCard';
import { AdBanner } from './components/AdBanner';
import { HowToGuide } from './components/HowToGuide';
import { PwaBanner } from './components/PwaBanner';
import { FeaturesSection } from './components/FeaturesSection';
import { WhyChooseUs } from './components/WhyChooseUs';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { LegalModal } from './components/LegalModals';
import { DynamicSitemapModal } from './components/DynamicSitemapModal';
import { AdminDashboard } from './components/AdminDashboard';
import {
  AdSettings,
  ApiSettings,
  ExtractedMedia,
  LanguageCode,
  MediaType,
  SeoTrackingSettings,
  SiteBrandingSettings,
  ToolSeoContent,
} from './types';
import { SLUG_TO_TOOL, SUPPORTED_LANGUAGES, TOOL_SLUGS } from './data/i18nData';
import { buildKeywordFaqs, findKeywordPage, refreshKeywordPages } from './data/keywordPages';
import { applySeoAndTrackingScripts, updateDocumentSeo, updateKeywordPageSeo } from './services/seoEngine';
import { extractInstagramMedia } from './services/extractorService';

const DEFAULT_BRANDING_SETTINGS: SiteBrandingSettings = {
  siteName: 'IGSaveGo',
  siteTagline: 'Fast & HD Instagram Media Saver',
  logoType: 'default',
  customLogoUrl: '',
  faviconUrl: '/icon.svg',
  accentColor: '#f43f5e',
  contactEmail: 'support@igsavego.com',
  copyrightText: `© ${new Date().getFullYear()} IGSaveGo.com. All rights reserved. Ultra-Fast Free Instagram Downloader.`,
};

const DEFAULT_SEO_TRACKING: SeoTrackingSettings = {
  googleAnalyticsId: '',
  googleSearchConsoleCode: '',
  bingWebmasterCode: '',
  facebookPixelId: '',
  customHeadCode: '',
  customBodyCode: '',
  enableRobotsIndex: true,
  canonicalBaseUrl: 'https://www.igsavego.com',
};

const DEFAULT_AD_SETTINGS: AdSettings = {
  autoAdsEnabled: false,
  autoAdsClientId: 'ca-pub-9920194819284102',
  headerBanner: {
    enabled: true,
    type: 'banner',
    title: 'Private Cloud VPN & Media Safe',
    adClient: 'ca-pub-9920194819284102',
    adSlot: '8491028401',
  },
  belowInput: {
    enabled: true,
    type: 'native',
    title: 'High-Speed Unlimited File Storage',
    adClient: 'ca-pub-9920194819284102',
    adSlot: '1920491829',
  },
  aboveResult: {
    enabled: true,
    type: 'banner',
    title: 'Fast Cloud Media Player Pro',
    adClient: 'ca-pub-9920194819284102',
    adSlot: '3940192841',
  },
  inContentBanner: {
    enabled: true,
    type: 'banner',
    title: 'Cloud Security Shield & Anti-Malware',
    adClient: 'ca-pub-9920194819284102',
    adSlot: '4920194821',
  },
  footerBanner: {
    enabled: false,
    type: 'banner',
    title: 'Privacy Guard Online',
    adClient: 'ca-pub-9920194819284102',
    adSlot: '5920194812',
  },
  stickyFooterBanner: {
    enabled: true,
    type: 'banner',
    title: 'Download Unlimited HD Videos at 10x Speed',
    adClient: 'ca-pub-9920194819284102',
    adSlot: '6920194833',
  },
  customPopunderCode: '',
};

const DEFAULT_API_SETTINGS: ApiSettings = {
  primaryEndpoint: '/api/extract',
  backupEndpoint: '/api/extract',
  rapidApiKey: '',
  timeoutMs: 15000,
  rateLimitPerMin: 50,
  enableRotatingProxies: false,
  proxyPool: [],
};

export default function App() {
  // Parse initial route from location
  const parseRoute = (): { lang: LanguageCode; tool: MediaType; isAdmin: boolean; keywordSlug: string | null } => {
    if (typeof window === 'undefined') {
      return { lang: 'en', tool: 'video', isAdmin: false, keywordSlug: null };
    }
    const path = window.location.pathname.toLowerCase().replace(/^\/|\/$/g, '');
    const segments = path.split('/');

    if (segments[0] === 'admin') {
      return { lang: 'en', tool: 'video', isAdmin: true, keywordSlug: null };
    }

    // Keyword landing page: /{slug} (Keywords & Tools Engine)
    if (segments.length === 1 && segments[0] && !SUPPORTED_LANGUAGES.some((l) => l.code === segments[0]) && !SLUG_TO_TOOL[segments[0]]) {
      const rawSeg = window.location.pathname.replace(/^\/|\/$/g, '').split('/')[0];
      const kwPage = findKeywordPage(rawSeg);
      if (kwPage) {
        return { lang: kwPage.lang, tool: kwPage.tool, isAdmin: false, keywordSlug: kwPage.slug };
      }
    }

    let detectedLang: LanguageCode = 'en';
    let detectedTool: MediaType = 'video';

    if (segments.length >= 2) {
      if (SUPPORTED_LANGUAGES.some((l) => l.code === segments[0])) {
        detectedLang = segments[0] as LanguageCode;
        if (SLUG_TO_TOOL[segments[1]]) {
          detectedTool = SLUG_TO_TOOL[segments[1]];
        }
      }
    } else if (segments.length === 1) {
      if (SUPPORTED_LANGUAGES.some((l) => l.code === segments[0])) {
        detectedLang = segments[0] as LanguageCode;
      } else if (SLUG_TO_TOOL[segments[0]]) {
        detectedTool = SLUG_TO_TOOL[segments[0]];
      }
    }

    return { lang: detectedLang, tool: detectedTool, isAdmin: false, keywordSlug: null };
  };

  const initialRoute = parseRoute();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(initialRoute.lang);
  const [activeTool, setActiveTool] = useState<MediaType>(initialRoute.tool);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(initialRoute.isAdmin);
  const [keywordSlug, setKeywordSlug] = useState<string | null>(initialRoute.keywordSlug);
  // Becomes true when the shared keyword list (Supabase) arrives, so landing
  // pages + their SEO resolve for every visitor — not just the admin's browser.
  const [sharedKwReady, setSharedKwReady] = useState(false);
  useEffect(() => {
    refreshKeywordPages().then((remote) => {
      if (remote) setSharedKwReady(true);
    });
  }, []);
  const keywordPage = keywordSlug ? findKeywordPage(keywordSlug) : null;

  // Dynamic Brand & Logo State
  const [brandingSettings, setBrandingSettings] = useState<SiteBrandingSettings>(() => {
    try {
      const stored = localStorage.getItem('sss_branding_settings');
      return stored ? { ...DEFAULT_BRANDING_SETTINGS, ...JSON.parse(stored) } : DEFAULT_BRANDING_SETTINGS;
    } catch {
      return DEFAULT_BRANDING_SETTINGS;
    }
  });

  // SEO & Webmaster Tracking State
  const [seoTrackingSettings, setSeoTrackingSettings] = useState<SeoTrackingSettings>(() => {
    try {
      const stored = localStorage.getItem('sss_seo_tracking_settings');
      return stored ? { ...DEFAULT_SEO_TRACKING, ...JSON.parse(stored) } : DEFAULT_SEO_TRACKING;
    } catch {
      return DEFAULT_SEO_TRACKING;
    }
  });

  // SEO overrides from Admin stored in localStorage
  const [seoOverrides, setSeoOverrides] = useState<Record<string, ToolSeoContent>>(() => {
    try {
      const stored = localStorage.getItem('sss_seo_overrides');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Ads Settings
  const [adSettings, setAdSettings] = useState<AdSettings>(() => {
    try {
      const stored = localStorage.getItem('sss_ad_settings');
      return stored ? { ...DEFAULT_AD_SETTINGS, ...JSON.parse(stored) } : DEFAULT_AD_SETTINGS;
    } catch {
      return DEFAULT_AD_SETTINGS;
    }
  });

  // API Settings
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    try {
      const stored = localStorage.getItem('sss_api_settings');
      return stored ? { ...DEFAULT_API_SETTINGS, ...JSON.parse(stored) } : DEFAULT_API_SETTINGS;
    } catch {
      return DEFAULT_API_SETTINGS;
    }
  });

  // Media Extraction State
  const [extractedMedia, setExtractedMedia] = useState<ExtractedMedia | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Last submitted URL — reused to mint fresh CDN links when a preview expires.
  const [lastExtractedUrl, setLastExtractedUrl] = useState<string | null>(null);

  // Modals
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | 'disclaimer' | null>(null);
  const [isSitemapOpen, setIsSitemapOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  // Synchronize dynamic script injection (Analytics, Search Console, Bing, Pixel, Custom scripts)
  useEffect(() => {
    applySeoAndTrackingScripts(seoTrackingSettings, adSettings, brandingSettings);
  }, [seoTrackingSettings, adSettings, brandingSettings]);

  // Synchronize SEO tags and browser history
  const syncRouteAndSeo = useCallback((lang: LanguageCode, tool: MediaType, pushHistory = true) => {
    const slug = TOOL_SLUGS[tool];
    const key = `${tool}_${lang}`;
    const customContent = seoOverrides[key];

    // Update metadata, canonical, and Schema.org with dynamic brand name
    updateDocumentSeo(lang, tool, customContent, brandingSettings);

    if (pushHistory && typeof window !== 'undefined') {
      const newPath = `/${lang}/${slug}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  }, [seoOverrides, brandingSettings]);

  // Initial SEO sync on mount (keyword landing pages use their own SEO)
  useEffect(() => {
    if (isAdminOpen) return;
    if (keywordPage) {
      updateKeywordPageSeo(keywordPage, brandingSettings, seoTrackingSettings);
      return;
    }
    syncRouteAndSeo(currentLanguage, activeTool, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage, activeTool, isAdminOpen, keywordSlug, sharedKwReady, syncRouteAndSeo]);

  // Browser back/forward navigation support
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRoute();
      setIsAdminOpen(route.isAdmin);
      setCurrentLanguage(route.lang);
      setActiveTool(route.tool);
      setKeywordSlug(route.keywordSlug);
      if (route.keywordSlug) {
        const kw = findKeywordPage(route.keywordSlug);
        if (kw) updateKeywordPageSeo(kw);
      } else {
        syncRouteAndSeo(route.lang, route.tool, false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncRouteAndSeo]);

  // Language switch handler
  const handleSelectLanguage = (newLang: LanguageCode) => {
    setKeywordSlug(null);
    setCurrentLanguage(newLang);
    syncRouteAndSeo(newLang, activeTool, true);
  };

  // Tool switch handler
  const handleSelectTool = (newTool: MediaType) => {
    setKeywordSlug(null);
    setActiveTool(newTool);
    setExtractedMedia(null);
    setErrorMessage(null);
    syncRouteAndSeo(currentLanguage, newTool, true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Instagram extraction caller
  const handleExtractMedia = async (url: string) => {
    setIsExtracting(true);
    setErrorMessage(null);
    setLastExtractedUrl(url);

    try {
      const result = await extractInstagramMedia(url, activeTool);
      setExtractedMedia(result);

      // Scroll to media result card smoothly
      setTimeout(() => {
        const el = document.getElementById('media-result-container');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Could not extract media. Please verify that the post is public and try again.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // Admin handlers
  const handleUpdateBrandingSettings = (newSettings: SiteBrandingSettings) => {
    setBrandingSettings(newSettings);
    localStorage.setItem('sss_branding_settings', JSON.stringify(newSettings));
    syncRouteAndSeo(currentLanguage, activeTool, false);
  };

  const handleUpdateSeoTrackingSettings = (newSettings: SeoTrackingSettings) => {
    setSeoTrackingSettings(newSettings);
    localStorage.setItem('sss_seo_tracking_settings', JSON.stringify(newSettings));
  };

  const handleUpdateSeoContent = (tool: MediaType, lang: LanguageCode, content: ToolSeoContent) => {
    const key = `${tool}_${lang}`;
    const updated = { ...seoOverrides, [key]: content };
    setSeoOverrides(updated);
    localStorage.setItem('sss_seo_overrides', JSON.stringify(updated));
    if (tool === activeTool && lang === currentLanguage) {
      updateDocumentSeo(lang, tool, content, brandingSettings);
    }
  };

  const handleUpdateAdSettings = (newSettings: AdSettings) => {
    setAdSettings(newSettings);
    localStorage.setItem('sss_ad_settings', JSON.stringify(newSettings));
  };

  const handleUpdateApiSettings = (newSettings: ApiSettings) => {
    setApiSettings(newSettings);
    localStorage.setItem('sss_api_settings', JSON.stringify(newSettings));
  };

  // Open / Close Admin
  const handleOpenAdmin = () => {
    setIsAdminOpen(true);
    if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
  };

  const handleCloseAdmin = () => {
    setIsAdminOpen(false);
    syncRouteAndSeo(currentLanguage, activeTool, true);
  };

  // If Admin Panel is requested
  if (isAdminOpen) {
    return (
      <AdminDashboard
        onClose={handleCloseAdmin}
        brandingSettings={brandingSettings}
        onUpdateBrandingSettings={handleUpdateBrandingSettings}
        seoTrackingSettings={seoTrackingSettings}
        onUpdateSeoTrackingSettings={handleUpdateSeoTrackingSettings}
        adSettings={adSettings}
        onUpdateAdSettings={handleUpdateAdSettings}
        apiSettings={apiSettings}
        onUpdateApiSettings={handleUpdateApiSettings}
        onUpdateSeoContent={handleUpdateSeoContent}
        currentLanguage={currentLanguage}
        activeTool={activeTool}
      />
    );
  }

  const currentSeoKey = `${activeTool}_${currentLanguage}`;
  const customToolSeo = seoOverrides[currentSeoKey];
  // Keyword landing page overrides hero content + FAQs with unique SEO copy
  const heroCustomContent = keywordPage
    ? { h1: keywordPage.h1, subtitle: keywordPage.subtitle, badge: keywordPage.badge }
    : customToolSeo;
  const faqCustomFaqs = keywordPage ? buildKeywordFaqs(keywordPage) : customToolSeo?.faqs;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 selection:bg-rose-500 selection:text-white">
      {/* 1. Header Navigation */}
      <Navbar
        currentLanguage={currentLanguage}
        activeTool={activeTool}
        branding={brandingSettings}
        onSelectTool={handleSelectTool}
        onSelectLanguage={handleSelectLanguage}
        onOpenAdmin={handleOpenAdmin}
        onOpenPwaPrompt={() => setIsPwaModalOpen(true)}
      />

      {/* Optional Top Ad Leaderboard */}
      <AdBanner slot="headerBanner" config={adSettings.headerBanner} />

      {/* 2. Main Hero Section */}
      <main className="flex-1">
        <HeroSection
          currentLanguage={currentLanguage}
          activeTool={activeTool}
          customContent={heroCustomContent}
          onSelectTool={handleSelectTool}
          onExtract={handleExtractMedia}
          isLoading={isExtracting}
          errorMessage={errorMessage || undefined}
        />

        {/* Optional Below-Input Ad Slot */}
        <AdBanner slot="belowInput" config={adSettings.belowInput} />

        {/* 3. Media Result Card (Rendered when extraction is ready) */}
        {extractedMedia && (
          <>
            <AdBanner slot="aboveResult" config={adSettings.aboveResult} />
            <MediaResultCard
              media={extractedMedia}
              currentLanguage={currentLanguage}
              onRefresh={lastExtractedUrl ? () => handleExtractMedia(lastExtractedUrl) : undefined}
              isRefreshing={isExtracting}
              onReset={() => {
                setExtractedMedia(null);
                setErrorMessage(null);
              }}
            />
          </>
        )}

        {/* 4. 3-Step Visual How-To Guide */}
        <HowToGuide
          currentLanguage={currentLanguage}
          activeTool={activeTool}
          customContent={customToolSeo}
        />

        {/* Optional Mid-Page In-Content Ad */}
        <AdBanner slot="inContentBanner" config={adSettings.inContentBanner} />

        {/* 5. Mobile App / PWA Banner */}
        <PwaBanner currentLanguage={currentLanguage} />

        {/* 6. Feature Highlights Section */}
        <FeaturesSection
          currentLanguage={currentLanguage}
          onSelectTool={handleSelectTool}
        />

        {/* 7. Why Choose Us 3-Column Grid */}
        <WhyChooseUs currentLanguage={currentLanguage} />

        {/* 8. FAQ Accordion Section with Schema.org */}
        <FaqSection
          currentLanguage={currentLanguage}
          activeTool={activeTool}
          customFaqs={faqCustomFaqs}
        />

        {/* Optional Footer Ad Banner */}
        <AdBanner slot="footerBanner" config={adSettings.footerBanner} />
      </main>

      {/* 9. Comprehensive Footer */}
      <Footer
        currentLanguage={currentLanguage}
        activeTool={activeTool}
        branding={brandingSettings}
        onSelectTool={handleSelectTool}
        onSelectLanguage={handleSelectLanguage}
        onOpenLegal={(type) => setActiveLegalModal(type)}
        onOpenSitemap={() => setIsSitemapOpen(true)}
        onOpenAdmin={handleOpenAdmin}
      />

      {/* 10. Sticky Floating Footer Ad Banner */}
      <AdBanner slot="stickyFooterBanner" config={adSettings.stickyFooterBanner} />

      {/* 11. Modals: Legal, Sitemap, PWA Guide */}
      <LegalModal
        type={activeLegalModal}
        onClose={() => setActiveLegalModal(null)}
      />

      <DynamicSitemapModal
        isOpen={isSitemapOpen}
        onClose={() => setIsSitemapOpen(false)}
      />

      {isPwaModalOpen && (
        <PwaBanner
          currentLanguage={currentLanguage}
          isOpenModal={true}
          onCloseModal={() => setIsPwaModalOpen(false)}
        />
      )}
    </div>
  );
}
