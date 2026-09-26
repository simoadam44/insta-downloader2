import { KeywordToolPage, LanguageCode, MediaType } from '../types';

export const KEYWORD_PAGES_STORAGE_KEY = 'sss_keyword_pages';

export const DEFAULT_KEYWORD_PAGES: KeywordToolPage[] = [
  {
    id: 'kw-en-video-downloader',
    slug: 'instagram-video-downloader',
    badge: 'VIDEO DOWNLOADER',
    targetKeyword: 'Instagram Video Downloader',
    lang: 'en',
    tool: 'video',
    title: 'Instagram Video Downloader - Download IG Videos in HD Free',
    metaDescription:
      'Instagram Video Downloader: download Instagram videos in 1080p MP4 for free. Fast, anonymous, no watermark, no login. Save any public IG video online.',
    h1: 'Instagram Video Downloader',
    subtitle: 'Download any Instagram video in Full HD MP4 quality online - free, fast and without watermark.',
    enabled: true,
  },
  {
    id: 'kw-en-reels',
    slug: 'download-instagram-reels',
    badge: 'REELS SAVER',
    targetKeyword: 'Download Instagram Reels',
    lang: 'en',
    tool: 'reels',
    title: 'Download Instagram Reels - Save Reels Videos in HD Online Free',
    metaDescription:
      'Download Instagram Reels in HD quality free. Save Reels videos to your phone or PC in MP4 without watermark. No app or login required.',
    h1: 'Download Instagram Reels',
    subtitle: 'Save Instagram Reels videos in HD MP4 - download viral reels free with no watermark.',
    enabled: true,
  },
  {
    id: 'kw-en-save-insta',
    slug: 'save-insta-video',
    badge: 'INSTA SAVER',
    targetKeyword: 'Save Insta Video',
    lang: 'en',
    tool: 'video',
    title: 'Save Insta Video - Free Instagram Video Saver Online (HD)',
    metaDescription:
      'Save Insta videos online free in 1080p HD. The fastest Insta video saver - paste the link and download any public Instagram video instantly.',
    h1: 'Save Insta Video',
    subtitle: 'The easiest way to save Insta videos - paste the link and download in HD instantly.',
    enabled: true,
  },
  {
    id: 'kw-en-ig-downloader',
    slug: 'ig-downloader',
    badge: 'IG TOOL',
    targetKeyword: 'IG Downloader',
    lang: 'en',
    tool: 'video',
    title: 'IG Downloader - Download Instagram Videos, Reels & Photos Free',
    metaDescription:
      'IG Downloader: free online tool to download Instagram videos, reels and photos in high quality. Anonymous, unlimited, no watermark.',
    h1: 'IG Downloader',
    subtitle: 'Free IG downloader for videos, reels and photos - HD quality, no login needed.',
    enabled: true,
  },
  {
    id: 'kw-ar-tahmil-video',
    slug: 'تحميل-فيديو-من-انستقرام',
    badge: 'تحميل فيديو',
    targetKeyword: 'تحميل فيديو من انستقرام',
    lang: 'ar',
    tool: 'video',
    title: 'تحميل فيديو من انستقرام - تنزيل فيديوهات انستا بجودة عالية مجانا',
    metaDescription:
      'تحميل فيديو من انستقرام بجودة 1080p MP4 مجانا وبدون علامة مائية. أداة سريعة ومجهولة لحفظ أي فيديو عام من انستقرام بدون تسجيل دخول.',
    h1: 'تحميل فيديو من انستقرام',
    subtitle: 'حمّل أي فيديو انستقرام بجودة Full HD مجانا - سريع، مجهول وبدون علامة مائية.',
    enabled: true,
  },
  {
    id: 'kw-ar-reels',
    slug: 'موقع-تحميل-ريلز-انستقرام',
    badge: 'تحميل ريلز',
    targetKeyword: 'موقع تحميل ريلز انستقرام',
    lang: 'ar',
    tool: 'reels',
    title: 'موقع تحميل ريلز انستقرام - حفظ مقاطع الريلز HD مجانا',
    metaDescription:
      'موقع تحميل ريلز انستقرام: احفظ مقاطع الريلز بجودة عالية MP4 بدون علامة مائية. مجاني، سريع ولا يحتاج تطبيق أو حساب.',
    h1: 'موقع تحميل ريلز انستقرام',
    subtitle: 'احفظ ريلز انستقرام بجودة HD على هاتفك أو حاسوبك مجانا وبدون علامة مائية.',
    enabled: true,
  },
  {
    id: 'kw-ar-hifz',
    slug: 'حفظ-فيديو-انستقرام',
    badge: 'حفظ فيديو',
    targetKeyword: 'حفظ فيديو انستقرام',
    lang: 'ar',
    tool: 'video',
    title: 'حفظ فيديو انستقرام - أداة حفظ فيديوهات انستا أونلاين مجانا',
    metaDescription:
      'حفظ فيديو انستقرام أونلاين بجودة 1080p. الصق الرابط وحمّل أي فيديو عام من انستقرام فورا - مجاني وغير محدود.',
    h1: 'حفظ فيديو انستقرام',
    subtitle: 'أسهل طريقة لحفظ فيديو انستقرام - الصق الرابط وحمّله بجودة عالية فورا.',
    enabled: true,
  },
  {
    id: 'kw-ar-tanzil',
    slug: 'تنزيل-مقاطع-انستقرام',
    badge: 'تنزيل مقاطع',
    targetKeyword: 'تنزيل مقاطع انستقرام',
    lang: 'ar',
    tool: 'video',
    title: 'تنزيل مقاطع انستقرام - حمّل مقاطع انستا MP4 بجودة عالية',
    metaDescription:
      'تنزيل مقاطع انستقرام مجانا بجودة عالية MP4. حمّل المقاطع والفيديوهات العامة بدون تسجيل دخول وبدون حدود يومية.',
    h1: 'تنزيل مقاطع انستقرام',
    subtitle: 'نزّل مقاطع انستقرام المفضلة لديك بجودة عالية - مجاني، سريع وبدون حدود.',
    enabled: true,
  },
];

// Load pages: localStorage cache merged over defaults (synchronous —
// used for first paint and sitemap generation).
export function loadKeywordPages(): KeywordToolPage[] {
  try {
    if (typeof window === 'undefined') return DEFAULT_KEYWORD_PAGES;
    const stored = localStorage.getItem(KEYWORD_PAGES_STORAGE_KEY);
    if (!stored) return DEFAULT_KEYWORD_PAGES;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_KEYWORD_PAGES;
    const byId = new Map<string, KeywordToolPage>();
    DEFAULT_KEYWORD_PAGES.forEach((p) => byId.set(p.id, p));
    parsed.forEach((p: KeywordToolPage) => {
      if (p && typeof p.id === 'string') byId.set(p.id, { ...byId.get(p.id), ...p } as KeywordToolPage);
    });
    return Array.from(byId.values());
  } catch {
    return DEFAULT_KEYWORD_PAGES;
  }
}

export function saveKeywordPages(pages: KeywordToolPage[]): void {
  try {
    localStorage.setItem(KEYWORD_PAGES_STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // storage full or unavailable — keep in-memory only
  }
}

function getApiBase(): string {
  try {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
  } catch {}
  return '';
}

function getAdminToken(): string {
  try {
    return localStorage.getItem('sss_admin_token') || '';
  } catch {
    return '';
  }
}

// Fetch the public list from the backend (Supabase). On success the shared
// cache is replaced so ALL visitors see the same pages. Returns null when
// the backend/DB is not configured (caller falls back to local cache).
export async function refreshKeywordPages(): Promise<KeywordToolPage[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/keyword-pages`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.pages) || data.pages.length === 0) return null;
    saveKeywordPages(data.pages);
    return data.pages as KeywordToolPage[];
  } catch {
    return null;
  }
}

// Admin: full list including hidden pages (requires login).
export async function apiFetchAllKeywordPages(): Promise<KeywordToolPage[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/keyword-pages?all=1`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${getAdminToken()}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.pages)) return null;
    return data.pages as KeywordToolPage[];
  } catch {
    return null;
  }
}

// Admin: create/update a page in Supabase. Returns 'ok' | 'no-db' | 'error'.
export async function apiUpsertKeywordPage(page: KeywordToolPage): Promise<'ok' | 'no-db' | 'error'> {
  try {
    const res = await fetch(`${getApiBase()}/api/keyword-pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(page),
    });
    if (res.ok) return 'ok';
    const data = await res.json().catch(() => null);
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'error';
  } catch {
    return 'error';
  }
}

// Admin: delete a page in Supabase.
export async function apiDeleteKeywordPage(id: string): Promise<'ok' | 'no-db' | 'error'> {
  try {
    const res = await fetch(`${getApiBase()}/api/keyword-pages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${getAdminToken()}` },
    });
    if (res.ok) return 'ok';
    const data = await res.json().catch(() => null);
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'error';
  } catch {
    return 'error';
  }
}

export function findKeywordPage(slug: string, pages?: KeywordToolPage[]): KeywordToolPage | null {
  const list = pages || loadKeywordPages();
  let s = (slug || '').trim();
  try {
    s = decodeURIComponent(s);
  } catch {}
  s = s.toLowerCase();
  const found = list.find((p) => p.enabled && p.slug.toLowerCase() === s);
  return found || null;
}

// Unique FAQs per landing page (templated around the target keyword).
export function buildKeywordFaqs(page: KeywordToolPage): import('../types').FaqItem[] {
  const kw = page.targetKeyword;
  if (page.lang === 'ar') {
    return [
      {
        question: `هل ${kw} مجاني؟`,
        answer: `نعم، ${kw} مجاني 100% وبدون حدود يومية أو اشتراكات خفية.`,
      },
      {
        question: `كيف يتم ${kw}؟`,
        answer: `انسخ رابط المنشور العام من انستقرام، الصقه في مربع البحث أعلاه ثم اضغط زر التحميل لحفظ الملف بجودة عالية.`,
      },
      {
        question: `هل أحتاج حساب انستقرام من أجل ${kw}؟`,
        answer: `لا، لا حاجة لتسجيل الدخول أو إدخال أي بيانات. التحميل مجهول تماما للمنشورات العامة.`,
      },
      {
        question: `ما جودة الملف عند ${kw}؟`,
        answer: `يتم حفظ الفيديو بصيغة MP4 بجودة Full HD (1080p) بدون علامة مائية.`,
      },
    ];
  }
  return [
    {
      question: `Is ${kw} free?`,
      answer: `Yes, ${kw} is 100% free with no daily limits or hidden subscriptions.`,
    },
    {
      question: `How do I use ${kw}?`,
      answer: `Copy the link of the public Instagram post, paste it in the search box above and hit Download to save the file in high quality.`,
    },
    {
      question: `Do I need an Instagram account for ${kw}?`,
      answer: `No. No login or personal data is required - downloads from public posts are fully anonymous.`,
    },
    {
      question: `What quality will I get with ${kw}?`,
      answer: `Videos are saved as MP4 in Full HD (1080p) quality with no watermark.`,
    },
  ];
}

export function sanitizeSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function emptyKeywordPage(): KeywordToolPage {
  const id = `kw_custom_${Date.now()}`;
  return {
    id,
    slug: '',
    badge: 'NEW TOOL',
    targetKeyword: '',
    lang: 'en' as LanguageCode,
    tool: 'video' as MediaType,
    title: '',
    metaDescription: '',
    h1: '',
    subtitle: '',
    enabled: true,
  };
}
