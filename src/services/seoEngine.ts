import { AdSettings, GuideArticle, KeywordToolPage, LanguageCode, MediaType, SeoTrackingSettings, SiteBrandingSettings, ToolSeoContent } from '../types';
import { SUPPORTED_LANGUAGES, TOOL_CONTENT, TOOL_SLUGS } from '../data/i18nData';
import { buildKeywordFaqs, loadKeywordPages } from '../data/keywordPages';
import { loadGuides } from '../data/guides';
import type { InfoPage } from '../data/infoPages';
import { INFO_PAGE_SEO } from '../data/infoPages';

// Primary canonical host is https://www.igsavego.com (the apex 301s there).
// Older settings may still store the apex host, so every generated canonical,
// hreflang and schema URL is normalized through this helper.
export function normalizeOrigin(origin: string | undefined): string {
  const raw = (origin || '').trim().replace(/\/+$/, '');
  if (!raw) return 'https://www.igsavego.com';
  if (/^https?:\/\/(www\.)?igsavego\.com$/i.test(raw)) return 'https://www.igsavego.com';
  return raw;
}

function resolveOrigin(tracking?: Partial<SeoTrackingSettings>): string {
  const customOrigin = tracking?.canonicalBaseUrl?.trim();
  if (customOrigin) return normalizeOrigin(customOrigin);
  return normalizeOrigin(typeof window !== 'undefined' ? window.location.origin : 'https://www.igsavego.com');
}

export function updateDocumentSeo(
  language: LanguageCode,
  tool: MediaType,
  overrideContent?: Partial<ToolSeoContent>,
  branding?: Partial<SiteBrandingSettings>,
  tracking?: Partial<SeoTrackingSettings>,
  canonicalPath?: string
): void {
  const defaultContent = TOOL_CONTENT[tool][language] || TOOL_CONTENT[tool]['en'];
  const content = { ...defaultContent, ...overrideContent };
  const siteName = branding?.siteName?.trim() || 'IGSaveGo';
  const origin = resolveOrigin(tracking);
  const slug = TOOL_SLUGS[tool];
  const canonicalUrl = canonicalPath
    ? `${origin}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
    : `${origin}/${language}/${slug}`;

  // Replace default brand name if custom siteName is set
  let dynamicTitle = content.title;
  if (siteName !== 'IGSaveGo') {
    dynamicTitle = dynamicTitle.replace(/IGSaveGo/gi, siteName);
  }
  let dynamicDesc = content.metaDescription;
  if (siteName !== 'IGSaveGo') {
    dynamicDesc = dynamicDesc.replace(/IGSaveGo/gi, siteName);
  }

  // 1. Update Title & Meta Description
  document.title = dynamicTitle;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', dynamicDesc);

  // 2. OpenGraph & Twitter tags
  const ogTags: Record<string, string> = {
    'og:title': dynamicTitle,
    'og:description': dynamicDesc,
    'og:url': canonicalUrl,
    'og:type': 'website',
    'og:site_name': siteName,
    'twitter:title': dynamicTitle,
    'twitter:description': dynamicDesc,
  };

  if (branding?.customLogoUrl) {
    ogTags['og:image'] = branding.customLogoUrl;
    ogTags['twitter:image'] = branding.customLogoUrl;
  }

  Object.entries(ogTags).forEach(([prop, val]) => {
    let tag = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      if (prop.startsWith('og:')) {
        tag.setAttribute('property', prop);
      } else {
        tag.setAttribute('name', prop);
      }
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  });

  // 3. Update Favicon if provided
  if (branding?.faviconUrl) {
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (faviconLink) {
      faviconLink.href = branding.faviconUrl;
    }
  }

  // 4. Canonical Link Tag
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 5. Multi-language Hreflang Tags
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());

  SUPPORTED_LANGUAGES.forEach((lang) => {
    const hreflangLink = document.createElement('link');
    hreflangLink.setAttribute('rel', 'alternate');
    hreflangLink.setAttribute('hreflang', lang.code);
    hreflangLink.setAttribute('href', `${origin}/${lang.code}/${slug}`);
    document.head.appendChild(hreflangLink);
  });

  const xDefault = document.createElement('link');
  xDefault.setAttribute('rel', 'alternate');
  xDefault.setAttribute('hreflang', 'x-default');
  xDefault.setAttribute('href', `${origin}/en/${slug}`);
  document.head.appendChild(xDefault);

  // 6. Update HTML lang & dir
  const currentLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  document.documentElement.lang = language;
  document.documentElement.dir = currentLangInfo?.dir || 'ltr';

  // 7. Schema.org Structured Data
  updateStructuredDataSchemas(language, tool, content, canonicalUrl, siteName);
}

// SEO for a keyword landing page (Keywords & Tools Engine): unique title,
// description, canonical /{slug}, hreflang=self, and WebApplication + FAQ schemas.
export function updateKeywordPageSeo(
  page: KeywordToolPage,
  branding?: Partial<SiteBrandingSettings>,
  tracking?: Partial<SeoTrackingSettings>
): void {
  if (typeof document === 'undefined') return;
  const siteName = branding?.siteName?.trim() || 'IGSaveGo';
  const origin = resolveOrigin(tracking);
  const canonicalUrl = `${origin}/${page.slug}`;

  document.title = page.title;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', page.metaDescription);

  // Keywords meta (minor signal, harmless) + robots
  let metaKw = document.querySelector('meta[name="keywords"]');
  if (!metaKw) {
    metaKw = document.createElement('meta');
    metaKw.setAttribute('name', 'keywords');
    document.head.appendChild(metaKw);
  }
  metaKw.setAttribute('content', `${page.targetKeyword}, download ${page.targetKeyword}, ${page.targetKeyword} online free`);

  const ogTags: Record<string, string> = {
    'og:title': page.title,
    'og:description': page.metaDescription,
    'og:url': canonicalUrl,
    'og:type': 'website',
    'og:site_name': siteName,
    'twitter:title': page.title,
    'twitter:description': page.metaDescription,
  };
  if (branding?.customLogoUrl) {
    ogTags['og:image'] = branding.customLogoUrl;
    ogTags['twitter:image'] = branding.customLogoUrl;
  }
  Object.entries(ogTags).forEach(([prop, val]) => {
    let tag = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(prop.startsWith('og:') ? 'property' : 'name', prop);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  });

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // hreflang self-reference
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  const selfLang = document.createElement('link');
  selfLang.setAttribute('rel', 'alternate');
  selfLang.setAttribute('hreflang', page.lang);
  selfLang.setAttribute('href', canonicalUrl);
  document.head.appendChild(selfLang);

  const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === page.lang);
  document.documentElement.lang = page.lang;
  document.documentElement.dir = langInfo?.dir || 'ltr';

  // Structured data: WebApplication + FAQPage
  document.querySelectorAll('script[data-schema-type]').forEach((el) => el.remove());
  const faqs = buildKeywordFaqs(page);
  const schemas = [
    {
      type: 'WebApplication',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': `${canonicalUrl}#webapp`,
        name: `${siteName} - ${page.h1}`,
        url: canonicalUrl,
        inLanguage: page.lang,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'All (iOS, Android, Windows, macOS, Linux, Mobile)',
        description: page.metaDescription,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      },
    },
    {
      type: 'FAQPage',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: page.lang,
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    },
  ];
  schemas.forEach(({ type, schema }) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema-type', type);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

// SEO for a guide article (Blog engine): unique title/description,
// canonical /blog/{slug}, hreflang=self, Article + FAQPage + BreadcrumbList.
export function updateGuideSeo(
  guide: GuideArticle,
  branding?: Partial<SiteBrandingSettings>,
  tracking?: Partial<SeoTrackingSettings>
): void {
  if (typeof document === 'undefined') return;
  const siteName = branding?.siteName?.trim() || 'IGSaveGo';
  const origin = resolveOrigin(tracking);
  const canonicalUrl = `${origin}/blog/${guide.slug}`;

  document.title = guide.title;

  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  setMeta('name', 'description', guide.metaDescription);
  setMeta('name', 'keywords', `${guide.keyword}, ${guide.keyword} guide, how to ${guide.keyword}`);
  setMeta('property', 'og:title', guide.title);
  setMeta('property', 'og:description', guide.metaDescription);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:type', 'article');
  setMeta('property', 'og:site_name', siteName);
  setMeta('name', 'twitter:title', guide.title);
  setMeta('name', 'twitter:description', guide.metaDescription);
  if (branding?.customLogoUrl) {
    setMeta('property', 'og:image', branding.customLogoUrl);
    setMeta('name', 'twitter:image', branding.customLogoUrl);
  }

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  const selfLang = document.createElement('link');
  selfLang.setAttribute('rel', 'alternate');
  selfLang.setAttribute('hreflang', guide.lang);
  selfLang.setAttribute('href', canonicalUrl);
  document.head.appendChild(selfLang);

  const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === guide.lang);
  document.documentElement.lang = guide.lang;
  document.documentElement.dir = langInfo?.dir || 'ltr';

  document.querySelectorAll('script[data-schema-type]').forEach((el) => el.remove());
  const isoDate = guide.updatedAt || new Date().toISOString();
  const schemas = [
    {
      type: 'Article',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        headline: guide.h1,
        description: guide.metaDescription,
        url: canonicalUrl,
        inLanguage: guide.lang,
        datePublished: isoDate,
        dateModified: isoDate,
        author: { '@type': 'Organization', name: siteName, url: origin },
        publisher: { '@type': 'Organization', name: siteName },
      },
    },
    {
      type: 'FAQPage',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: guide.lang,
        mainEntity: guide.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    },
    {
      type: 'BreadcrumbList',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: origin },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${origin}/blog` },
          { '@type': 'ListItem', position: 3, name: guide.h1, item: canonicalUrl },
        ],
      },
    },
  ];
  schemas.forEach(({ type, schema }) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema-type', type);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

// SEO for the static informational/legal pages (/about, /contact, /privacy,
// /terms, /disclaimer, /how-to-use, /faq). One canonical per page on the www
// origin, self hreflang, WebPage + BreadcrumbList, plus FAQPage on /faq where
// the visible content actually is a Q&A list.
export function updateInfoPageSeo(
  page: InfoPage,
  branding?: Partial<SiteBrandingSettings>,
  tracking?: Partial<SeoTrackingSettings>
): void {
  if (typeof document === 'undefined') return;
  const siteName = branding?.siteName?.trim() || 'IGSaveGo';
  const origin = resolveOrigin(tracking);
  const canonicalUrl = `${origin}${page.path}`;

  document.title = page.title;

  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  setMeta('name', 'description', page.description);
  setMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  setMeta('property', 'og:title', page.title);
  setMeta('property', 'og:description', page.description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', siteName);
  setMeta('name', 'twitter:title', page.title);
  setMeta('name', 'twitter:description', page.description);
  if (branding?.customLogoUrl) {
    setMeta('property', 'og:image', branding.customLogoUrl);
    setMeta('name', 'twitter:image', branding.customLogoUrl);
  }

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // These pages are English-only and are not translated into the tool locales,
  // so they declare a single self-referencing hreflang instead of the full set.
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  const selfLang = document.createElement('link');
  selfLang.setAttribute('rel', 'alternate');
  selfLang.setAttribute('hreflang', 'en');
  selfLang.setAttribute('href', canonicalUrl);
  document.head.appendChild(selfLang);
  const xDefault = document.createElement('link');
  xDefault.setAttribute('rel', 'alternate');
  xDefault.setAttribute('hreflang', 'x-default');
  xDefault.setAttribute('href', canonicalUrl);
  document.head.appendChild(xDefault);

  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';

  document.querySelectorAll('script[data-schema-type]').forEach((el) => el.remove());
  const schemas: { type: string; schema: Record<string, unknown> }[] = [
    {
      type: 'WebPage',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: page.title,
        description: page.description,
        inLanguage: 'en',
        dateModified: page.updated,
        isPartOf: { '@type': 'WebSite', name: siteName, url: origin },
        publisher: { '@type': 'Organization', name: siteName, url: origin },
      },
    },
    {
      type: 'BreadcrumbList',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: origin },
          { '@type': 'ListItem', position: 2, name: page.h1, item: canonicalUrl },
        ],
      },
    },
  ];

  if (page.faqs && page.faqs.length > 0) {
    schemas.push({
      type: 'FAQPage',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: 'en',
        mainEntity: page.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    });
  }

  schemas.forEach(({ type, schema }) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema-type', type);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

// SEO for the /blog hub page.
export function updateBlogHubSeo(
  lang: LanguageCode,
  branding?: Partial<SiteBrandingSettings>,
  tracking?: Partial<SeoTrackingSettings>
): void {
  if (typeof document === 'undefined') return;
  const siteName = branding?.siteName?.trim() || 'IGSaveGo';
  const origin = resolveOrigin(tracking);
  const canonicalUrl = `${origin}/blog`;
  const isArabic = lang === 'ar';
  const title = isArabic
    ? `مدونة ${siteName} — شروحات تحميل انستقرام خطوة بخطوة`
    : `${siteName} Blog — Step-by-Step Instagram Download Guides`;
  const desc = isArabic
    ? 'شروحات تحميل فيديو وريلز وستوري وصور انستقرام بجودة عالية: أدلة خطوة بخطوة بدون برامج وبدون حساب.'
    : 'Step-by-step Instagram video, reels, story and photo download guides in HD — no apps, no login.';

  document.title = title;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', desc);

  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:type', 'website');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', desc);

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  document.querySelectorAll('script[data-schema-type]').forEach((el) => el.remove());
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-schema-type', 'CollectionPage');
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: canonicalUrl,
    inLanguage: lang,
    description: desc,
  });
  document.head.appendChild(script);

  const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = langInfo?.dir || 'ltr';
}

// Inject Analytics, Verification Meta Tags, AdSense, and Custom Scripts
export function applySeoAndTrackingScripts(
  tracking: SeoTrackingSettings,
  ads: AdSettings,
  branding?: SiteBrandingSettings
): void {
  if (typeof document === 'undefined') return;

  // 0. Update Favicon if provided in branding
  if (branding?.faviconUrl) {
    let iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'shortcut icon';
      document.head.appendChild(iconLink);
    }
    iconLink.href = branding.faviconUrl;
  }

  // 1. Google Search Console Verification
  const gscCode = tracking.googleSearchConsoleCode?.trim();
  let gscMeta = document.querySelector('meta[name="google-site-verification"]');
  if (gscCode) {
    if (!gscMeta) {
      gscMeta = document.createElement('meta');
      gscMeta.setAttribute('name', 'google-site-verification');
      document.head.appendChild(gscMeta);
    }
    // Extract token if user pasted full HTML tag
    const match = gscCode.match(/content=["']([^"']+)["']/i);
    gscMeta.setAttribute('content', match ? match[1] : gscCode);
  } else if (gscMeta) {
    gscMeta.remove();
  }

  // 2. Bing Webmaster Verification
  const bingCode = tracking.bingWebmasterCode?.trim();
  let bingMeta = document.querySelector('meta[name="msvalidate.01"]');
  if (bingCode) {
    if (!bingMeta) {
      bingMeta = document.createElement('meta');
      bingMeta.setAttribute('name', 'msvalidate.01');
      document.head.appendChild(bingMeta);
    }
    const match = bingCode.match(/content=["']([^"']+)["']/i);
    bingMeta.setAttribute('content', match ? match[1] : bingCode);
  } else if (bingMeta) {
    bingMeta.remove();
  }

  // 3. Robots Meta Tag
  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute(
    'content',
    tracking.enableRobotsIndex !== false
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, nofollow'
  );

  // 4. Google Analytics (GA4 / gtag.js)
  // Only touch the tags when an ID is actually configured. Removing the static
  // GA4 tags and then bailing out on an empty ID would silently disable the
  // property that already ships in index.html.
  const gaId = tracking.googleAnalyticsId?.trim();
  if (gaId) {
    document.querySelectorAll('script[data-tracking="google-analytics"]').forEach((el) => el.remove());
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    gaScript.setAttribute('data-tracking', 'google-analytics');
    document.head.appendChild(gaScript);

    const gaInline = document.createElement('script');
    gaInline.setAttribute('data-tracking', 'google-analytics');
    gaInline.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}');
    `;
    document.head.appendChild(gaInline);
  }

  // 5. Facebook / Meta Pixel
  const fbPixelId = tracking.facebookPixelId?.trim();
  document.querySelectorAll('script[data-tracking="fb-pixel"]').forEach((el) => el.remove());
  if (fbPixelId) {
    const fbScript = document.createElement('script');
    fbScript.setAttribute('data-tracking', 'fb-pixel');
    fbScript.textContent = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${fbPixelId}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(fbScript);
  }

  // 6. Google AdSense Auto Ads
  const autoAdsEnabled = ads.autoAdsEnabled;
  const adClientId = (ads.autoAdsClientId || ads.headerBanner?.adClient || '').trim();
  document.querySelectorAll('script[data-adsense="auto-ads"]').forEach((el) => el.remove());
  if (autoAdsEnabled && adClientId) {
    const adsenseScript = document.createElement('script');
    adsenseScript.async = true;
    adsenseScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adClientId)}`;
    adsenseScript.crossOrigin = 'anonymous';
    adsenseScript.setAttribute('data-adsense', 'auto-ads');
    document.head.appendChild(adsenseScript);
  }

  // 7. Custom <head> Code Injection
  document.querySelectorAll('div[data-custom-head-container]').forEach((el) => el.remove());
  if (tracking.customHeadCode && tracking.customHeadCode.trim()) {
    const headContainer = document.createElement('div');
    headContainer.setAttribute('data-custom-head-container', 'true');
    headContainer.innerHTML = tracking.customHeadCode;
    // Execute any script tags inside customHeadCode
    headContainer.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr: Attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      document.head.appendChild(newScript);
    });
  }

  // 8. Custom <body> Code Injection
  document.querySelectorAll('div[data-custom-body-container]').forEach((el) => el.remove());
  if (tracking.customBodyCode && tracking.customBodyCode.trim()) {
    const bodyContainer = document.createElement('div');
    bodyContainer.setAttribute('data-custom-body-container', 'true');
    bodyContainer.innerHTML = tracking.customBodyCode;
    bodyContainer.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      document.body.appendChild(newScript);
    });
  }
}

function updateStructuredDataSchemas(
  language: LanguageCode,
  tool: MediaType,
  content: ToolSeoContent,
  canonicalUrl: string,
  siteName: string = 'IGSaveGo'
): void {
  // Remove previously injected schemas
  document.querySelectorAll('script[data-schema-type]').forEach((el) => el.remove());

  // 1. WebApplication Schema
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${canonicalUrl}#webapp`,
    name: `${siteName} ${content.h1}`,
    url: canonicalUrl,
    inLanguage: language,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All (iOS, Android, Windows, macOS, Linux, Mobile)',
    description: content.metaDescription,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };

  // 2. HowTo Schema (3-step guide)
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${canonicalUrl}#howto`,
    name: `How to Download with ${siteName} ${content.h1}`,
    description: `Step-by-step tutorial to download Instagram ${tool} online in HD for free using ${siteName}.`,
    inLanguage: language,
    totalTime: 'PT1M',
    step: content.steps.map((s) => ({
      '@type': 'HowToStep',
      position: s.step,
      name: s.title,
      text: s.description,
      url: `${canonicalUrl}#step-${s.step}`,
    })),
  };

  // 3. FAQPage Schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#faq`,
    inLanguage: language,
    mainEntity: content.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  // Append schemas to document head
  [
    { type: 'WebApplication', schema: webAppSchema },
    { type: 'HowTo', schema: howToSchema },
    { type: 'FAQPage', schema: faqSchema },
  ].forEach(({ type, schema }) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema-type', type);
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  });
}

// Generate dynamic sitemap.xml string for all tools and languages
export function generateDynamicSitemapXml(origin: string = 'https://www.igsavego.com'): string {
  origin = normalizeOrigin(origin);
  const today = new Date().toISOString().split('T')[0];
  const tools: MediaType[] = ['video', 'photo', 'reels', 'story', 'highlights'];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // Root / Home
  xml += `  <url>\n`;
  xml += `    <loc>${origin}/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  SUPPORTED_LANGUAGES.forEach((lang) => {
    xml += `    <xhtml:link rel="alternate" hreflang="${lang.code}" href="${origin}/${lang.code}/video-downloader"/>\n`;
  });
  xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en/video-downloader"/>\n`;
  xml += `  </url>\n`;

  // Each language and each tool
  SUPPORTED_LANGUAGES.forEach((lang) => {
    tools.forEach((tool) => {
      const slug = TOOL_SLUGS[tool];
      const pageUrl = `${origin}/${lang.code}/${slug}`;
      const priority = tool === 'video' || tool === 'reels' ? '0.9' : '0.8';

      xml += `  <url>\n`;
      xml += `    <loc>${pageUrl}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;

      // hreflang alternates
      SUPPORTED_LANGUAGES.forEach((altLang) => {
        xml += `    <xhtml:link rel="alternate" hreflang="${altLang.code}" href="${origin}/${altLang.code}/${slug}"/>\n`;
      });
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en/${slug}"/>\n`;

      xml += `  </url>\n`;
    });
  });

  // Keyword landing pages (Keywords & Tools Engine) — high-intent SEO pages
  try {
    loadKeywordPages()
      .filter((p) => p.enabled && p.slug)
      .forEach((p) => {
        xml += `  <url>\n`;
        xml += `    <loc>${origin}/${p.slug}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>daily</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;
        xml += `  </url>\n`;
      });
  } catch {
    // localStorage unavailable (SSR) — skip keyword pages
  }

  // Blog hub + guide articles (Blog engine) — long-tail SEO pages
  try {
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/blog</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
    loadGuides()
      .filter((g) => g.enabled && g.slug)
      .forEach((g) => {
        const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : today;
        xml += `  <url>\n`;
        xml += `    <loc>${origin}/blog/${g.slug}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      });
  } catch {
    // localStorage unavailable (SSR) — skip guides
  }

  // Informational and legal pages — static, English-only, own lastmod.
  INFO_PAGE_SEO.forEach((page) => {
    const path = page.path.replace(/^\//, '');
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/${path}</loc>\n`;
    xml += `    <lastmod>${page.updated}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.6</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
}
