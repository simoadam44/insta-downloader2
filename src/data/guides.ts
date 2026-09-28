import { GuideArticle, LanguageCode, MediaType } from '../types';

export const GUIDES_STORAGE_KEY = 'sss_guide_articles';

export const DEFAULT_GUIDES: GuideArticle[] = [
  {
    id: 'gd-ar-reels-iphone',
    slug: 'تحميل-ريلز-انستقرام-للايفون-بدون-برامج',
    lang: 'ar',
    keyword: 'تحميل ريلز انستقرام للايفون',
    tool: 'reels',
    title: 'تحميل ريلز انستقرام للايفون بدون برامج (2026) - خطوة بخطوة',
    metaDescription:
      'شرح تحميل ريلز انستقرام للايفون بدون برامج: انسخ الرابط من التطبيق، الصقه في IGSAVEGO، واحفظ الريل بجودة HD في صورك مباشرة.',
    h1: 'تحميل ريلز انستقرام للايفون بدون برامج',
    excerpt: 'دليل سريع لحفظ أي ريل على الايفون (Safari) بدون تثبيت تطبيقات: نسخ، لصق، تحميل.',
    sections: [
      {
        heading: '1. انسخ رابط الريل من تطبيق انستقرام',
        body: 'افتح الريل في تطبيق انستقرام على الايفون، اضغط زر المشاركة (السهم) ثم اختر "نسخ الرابط". تأكد أن الحساب عام لأن الريلز الخاصة لا يمكن تحميلها.',
      },
      {
        heading: '2. الصق الرابط في متصفح Safari',
        body: 'افتح موقع IGSAVEGO في Safari والصق الرابط في مربع البحث ثم اضغط زر التحميل. ستظهر معاينة الريل مع زر حفظ بجودة 1080p خلال ثوانٍ.',
      },
      {
        heading: '3. احفظ الريل في تطبيق الصور',
        body: 'اضغط "تحميل"، وعند انتهاء التنزيل اختر "حفظ في الصور" من قائمة المشاركة. ستجد الريل في ألبوم الكاميرا بجودته الأصلية وبدون علامة مائية.',
      },
    ],
    faqs: [
      {
        question: 'هل أحتاج تطبيقاً لتحميل ريلز انستقرام على الايفون؟',
        answer: 'لا. متصفح Safari مع موقع IGSAVEGO يكفي تماماً: نسخ الرابط ثم لصقه ثم التحميل، بدون تثبيت أي شيء.',
      },
      {
        question: 'أين يُحفظ الريل بعد التحميل على الايفون؟',
        answer: 'يُنزّل الملف أولاً إلى تطبيق "الملفات"، ومن قائمة المشاركة اختر "حفظ الفيديو" لينتقل إلى مكتبة الصور.',
      },
      {
        question: 'هل تحميل الريلز بهذه الطريقة آمن للحساب؟',
        answer: 'نعم، لا تدخل أي بيانات ولا تسجل الدخول. التحميل مجهول تماماً ولا يصل أي إشعار لصاحب الريل.',
      },
    ],
    relatedSlugs: ['حفظ-ستوري-انستقرام-بدون-ما-يدري', 'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية'],
    enabled: true,
  },
  {
    id: 'gd-ar-story-anon',
    slug: 'حفظ-ستوري-انستقرام-بدون-ما-يدري',
    lang: 'ar',
    keyword: 'حفظ ستوري انستقرام بدون ما يدري',
    tool: 'story',
    title: 'حفظ ستوري انستقرام بدون ما يدري صاحبها (مجهول 100%)',
    metaDescription:
      'طريقة حفظ ستوري انستقرام بدون ما يدري صاحب الحساب: أدخل اسم المستخدم، حمّل الستوري صوراً وفيديو بجودة عالية وبشكل مجهول تماماً.',
    h1: 'حفظ ستوري انستقرام بدون ما يدري',
    excerpt: 'احفظ أي ستوري عام بدون ظهور اسمك في قائمة المشاهدين: أدخل اليوزر وحمّل مباشرة.',
    sections: [
      {
        heading: 'لماذا لا يظهر اسمك؟',
        body: 'عند التحميل عبر IGSAVEGO لا تفتح الستوري من حسابك أصلاً. السيرفر يجلب نسخة عامة من ملفات انستقرام، فلا تُسجَّل مشاهدة باسمك أبداً ولا يصل أي إشعار لصاحب الحساب.',
      },
      {
        heading: 'خطوات حفظ الستوري',
        body: 'اختر تبويب Story من الأعلى، اكتب اسم المستخدم (username) بدون @، ثم اضغط تحميل. ستظهر الستوريات النشطة للحساب العام مع أزرار حفظ للصور والفيديو.',
      },
      {
        heading: 'شروط مهمة',
        body: 'الطريقة تعمل فقط مع الحسابات العامة. الحسابات الخاصة والستوريات المنتهية (بعد 24 ساعة) لا يمكن الوصول إليها احتراماً للخصوصية.',
      },
    ],
    faqs: [
      {
        question: 'هل يعرف صاحب الحساب أني حفظت الستوري؟',
        answer: 'لا. لا تظهر في قائمة المشاهدين ولا يصله أي تنبيه، لأن المشاهدة لا تتم من حسابك.',
      },
      {
        question: 'هل يمكن حفظ ستوري حساب خاص؟',
        answer: 'لا، وهذه حماية مقصودة للخصوصية. الأداة تدعم الحسابات العامة فقط.',
      },
      {
        question: 'بأي صيغة تُحفظ الستوري؟',
        answer: 'الصور بصيغة JPG والفيديو بصيغة MP4 بجودة تصل إلى 1080p.',
      },
    ],
    relatedSlugs: ['تحميل-ريلز-انستقرام-للايفون-بدون-برامج', 'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية'],
    enabled: true,
  },
  {
    id: 'gd-ar-android-video',
    slug: 'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية',
    lang: 'ar',
    keyword: 'تحميل فيديو انستا للاندرويد',
    tool: 'video',
    title: 'تحميل فيديو انستا للاندرويد بجودة عالية MP4 (شرح مصور)',
    metaDescription:
      'شرح تحميل فيديو انستا للاندرويد بجودة 1080p: انسخ رابط الفيديو من التطبيق، الصقه في IGSAVEGO بمتصفح كروم، واحفظه في مجلد التنزيلات.',
    h1: 'تحميل فيديو انستا للاندرويد بجودة عالية',
    excerpt: 'احفظ أي فيديو عام على هاتفك الأندرويد بمتصفح كروم فقط: نسخ، لصق، تحميل MP4.',
    sections: [
      {
        heading: '1. نسخ رابط الفيديو',
        body: 'من تطبيق انستقرام افتح الفيديو، اضغط النقاط الثلاث أو زر المشاركة ثم "نسخ الرابط". يعمل هذا مع المنشورات والريلز على حد سواء.',
      },
      {
        heading: '2. التحميل من متصفح كروم',
        body: 'افتح IGSAVEGO في كروم والصق الرابط ثم اضغط تحميل. اختر جودة 1080p Full HD وسيبدأ التنزيل فوراً إلى مجلد Downloads في هاتفك.',
      },
      {
        heading: '3. تشغيل الفيديو بدون إنترنت',
        body: 'بعد اكتمال التحميل شغّل الملف بأي مشغّل فيديو. الملف بصيغة MP4 القياسية يعمل على كل الأجهزة ويمكن مشاركته عبر واتساب وتليجرام.',
      },
    ],
    faqs: [
      {
        question: 'أين أجد الفيديو بعد تحميله على الأندرويد؟',
        answer: 'في مجلد "التنزيلات" (Downloads) أو في تطبيق "ملفاتي"، ويمكنك نقله إلى الاستوديو.',
      },
      {
        question: 'هل يوجد حد لعدد الفيديوهات؟',
        answer: 'لا، التحميل غير محدود ومجاني بالكامل بدون حساب أو اشتراك.',
      },
      {
        question: 'لماذا يظهر الفيديو أحياناً كصورة؟',
        answer: 'بعض المنشورات لا يعرض إنستقرام لها رابط فيديو علناً، فيظهر الغلاف فقط. جرّب رابطاً آخر أو أعد المحاولة لاحقاً.',
      },
    ],
    relatedSlugs: ['تحميل-ريلز-انستقرام-للايفون-بدون-برامج', 'حفظ-ستوري-انستقرام-بدون-ما-يدري'],
    enabled: true,
  },
  {
    id: 'gd-en-reels-iphone',
    slug: 'download-instagram-reels-on-iphone-without-app',
    lang: 'en',
    keyword: 'download instagram reels on iPhone',
    tool: 'reels',
    title: 'How to Download Instagram Reels on iPhone Without an App (2026)',
    metaDescription:
      'Download Instagram Reels on iPhone without any app: copy the reel link, paste it into IGSAVEGO in Safari, and save it in HD to your Photos.',
    h1: 'Download Instagram Reels on iPhone Without an App',
    excerpt: 'Save any public reel on iPhone with Safari only: copy, paste, download in 1080p.',
    sections: [
      {
        heading: '1. Copy the reel link',
        body: 'Open the reel in the Instagram app, tap Share, then "Copy Link". The account must be public — private reels cannot be downloaded.',
      },
      {
        heading: '2. Paste it in Safari',
        body: 'Open IGSAVEGO in Safari, paste the link into the search box and hit Download. A preview appears within seconds with an HD save button.',
      },
      {
        heading: '3. Save to Photos',
        body: 'Tap Download, then use the share sheet to "Save Video". The reel lands in your camera roll in original quality with no watermark.',
      },
    ],
    faqs: [
      {
        question: 'Do I need an app to download reels on iPhone?',
        answer: 'No. Safari plus IGSAVEGO is enough — no installs, no sign-ups, no watermarks.',
      },
      {
        question: 'Where do downloaded reels go on iPhone?',
        answer: 'First to the Files app, then move them to Photos via the share sheet "Save Video" option.',
      },
      {
        question: 'Is it anonymous?',
        answer: 'Yes. No login is required and the reel owner is never notified.',
      },
    ],
    relatedSlugs: ['save-instagram-story-anonymously', 'download-instagram-photos-to-android-gallery'],
    enabled: true,
  },
  {
    id: 'gd-en-story-anon',
    slug: 'save-instagram-story-anonymously',
    lang: 'en',
    keyword: 'save instagram story anonymously',
    tool: 'story',
    title: 'How to Save an Instagram Story Anonymously (Viewer List Free)',
    metaDescription:
      'Save Instagram Stories anonymously without appearing on the viewer list: enter the username in IGSAVEGO and download story photos and videos in HD.',
    h1: 'Save Instagram Story Anonymously',
    excerpt: 'Download any public story without your name on the viewer list: just the username.',
    sections: [
      {
        heading: 'Why you stay invisible',
        body: 'You never open the story from your account. Our server fetches a public copy of the media files, so no view is registered under your name and the owner gets no notification.',
      },
      {
        heading: 'Steps to save a story',
        body: 'Switch to the Story tab, type the username without @, and hit download. Active stories of public accounts appear with save buttons for photos (JPG) and videos (MP4).',
      },
      {
        heading: 'Limitations',
        body: 'Only public accounts work. Private accounts and stories older than 24 hours are inaccessible by design, to respect privacy.',
      },
    ],
    faqs: [
      {
        question: 'Will they know I saved their story?',
        answer: 'No. You never appear on the viewer list and no notification is sent.',
      },
      {
        question: 'Can I save stories from private accounts?',
        answer: 'No — only public accounts are supported, as a deliberate privacy protection.',
      },
      {
        question: 'What format are saved stories?',
        answer: 'Photos as JPG and videos as MP4 in up to 1080p quality.',
      },
    ],
    relatedSlugs: ['download-instagram-reels-on-iphone-without-app', 'download-instagram-photos-to-android-gallery'],
    enabled: true,
  },
  {
    id: 'gd-en-photo-android',
    slug: 'download-instagram-photos-to-android-gallery',
    lang: 'en',
    keyword: 'download instagram photos to gallery',
    tool: 'photo',
    title: 'How to Download Instagram Photos to Your Android Gallery (HD)',
    metaDescription:
      'Download Instagram photos to your Android gallery in original HD quality: copy the post link, paste it into IGSAVEGO in Chrome, and save the JPG.',
    h1: 'Download Instagram Photos to Android Gallery',
    excerpt: 'Save any public photo or carousel to your Android phone with Chrome only.',
    sections: [
      {
        heading: '1. Copy the photo link',
        body: 'Open the post in Instagram, tap the three dots or Share, then "Copy Link". Works for single photos and multi-slide carousels.',
      },
      {
        heading: '2. Download in Chrome',
        body: 'Paste the link into IGSAVEGO, hit Download, and save each slide in original resolution JPG. Carousels are detected automatically with per-slide buttons.',
      },
      {
        heading: '3. Find it in your gallery',
        body: 'Files land in the Downloads folder. Move them to your gallery or DCIM folder, or open them directly with any gallery app.',
      },
    ],
    faqs: [
      {
        question: 'Can I download all carousel slides?',
        answer: 'Yes. Carousels are detected with individual HD download buttons per slide.',
      },
      {
        question: 'What quality are the photos?',
        answer: 'Original uploaded resolution in JPG, typically 1080px and up.',
      },
      {
        question: 'Is there a download limit?',
        answer: 'No limits — free and unlimited without an account.',
      },
    ],
    relatedSlugs: ['download-instagram-reels-on-iphone-without-app', 'save-instagram-story-anonymously'],
    enabled: true,
  },
];

// ---------- cache (localStorage) + Supabase sync, mirrors keywordPages.ts ----------
export function loadGuides(): GuideArticle[] {
  try {
    if (typeof window === 'undefined') return DEFAULT_GUIDES;
    const stored = localStorage.getItem(GUIDES_STORAGE_KEY);
    if (!stored) return DEFAULT_GUIDES;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_GUIDES;
    const byId = new Map<string, GuideArticle>();
    DEFAULT_GUIDES.forEach((g) => byId.set(g.id, g));
    parsed.forEach((g: GuideArticle) => {
      if (g && typeof g.id === 'string') byId.set(g.id, { ...byId.get(g.id), ...g } as GuideArticle);
    });
    return Array.from(byId.values());
  } catch {
    return DEFAULT_GUIDES;
  }
}

export function saveGuides(guides: GuideArticle[]): void {
  try {
    localStorage.setItem(GUIDES_STORAGE_KEY, JSON.stringify(guides));
  } catch {}
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

export async function refreshGuides(): Promise<GuideArticle[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.guides) || data.guides.length === 0) return null;
    saveGuides(data.guides);
    return data.guides as GuideArticle[];
  } catch {
    return null;
  }
}

export async function apiFetchAllGuides(): Promise<GuideArticle[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides?all=1`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${getAdminToken()}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.guides)) return null;
    return data.guides as GuideArticle[];
  } catch {
    return null;
  }
}

export async function apiUpsertGuide(guide: GuideArticle): Promise<'ok' | 'no-db' | 'error'> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(guide),
    });
    if (res.ok) return 'ok';
    const data = await res.json().catch(() => null);
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'error';
  } catch {
    return 'error';
  }
}

export async function apiDeleteGuide(id: string): Promise<'ok' | 'no-db' | 'error'> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides?id=${encodeURIComponent(id)}`, {
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

export function findGuide(slug: string, guides?: GuideArticle[]): GuideArticle | null {
  const list = guides || loadGuides();
  let s = (slug || '').trim();
  try {
    s = decodeURIComponent(s);
  } catch {}
  s = s.toLowerCase();
  const found = list.find((g) => g.enabled && g.slug.toLowerCase() === s);
  return found || null;
}

export function guidesByLang(lang: LanguageCode, guides?: GuideArticle[]): GuideArticle[] {
  const list = guides || loadGuides();
  const filtered = list.filter((g) => g.enabled && g.lang === lang);
  return filtered.length > 0 ? filtered : list.filter((g) => g.enabled);
}

export function sanitizeGuideSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function emptyGuide(lang: LanguageCode = 'en'): GuideArticle {
  return {
    id: `gd_custom_${Date.now()}`,
    slug: '',
    lang,
    tool: 'video' as MediaType,
    keyword: '',
    title: '',
    metaDescription: '',
    h1: '',
    excerpt: '',
    sections: [{ heading: '', body: '' }],
    faqs: [{ question: '', answer: '' }],
    relatedSlugs: [],
    enabled: true,
  };
}
