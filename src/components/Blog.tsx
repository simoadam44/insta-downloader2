import React from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronRight, Download, Tag } from 'lucide-react';
import { GuideArticle, LanguageCode, MediaType } from '../types';
import { TOOL_SLUGS } from '../data/i18nData';

interface BlogHubProps {
  guides: GuideArticle[];
  lang: LanguageCode;
  siteName: string;
  onOpenArticle: (slug: string) => void;
  onOpenTool: (tool: MediaType) => void;
}

export const BlogHub: React.FC<BlogHubProps> = ({ guides, lang, siteName, onOpenArticle, onOpenTool }) => {
  const isArabic = lang === 'ar';
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{isArabic ? 'دليل التحميل' : 'Download Guides'}</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {isArabic ? `مدونة ${siteName} — شروحات تحميل انستقرام` : `${siteName} Blog — Instagram Download Guides`}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-600">
          {isArabic
            ? 'شروحات خطوة بخطوة لحفظ الفيديو والريلز والستوري والصور بجودة عالية، بدون برامج وبدون حساب.'
            : 'Step-by-step tutorials to save videos, reels, stories and photos in HD — no apps, no login.'}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {guides.map((g) => (
          <article
            key={g.id}
            className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-rose-200 transition-all cursor-pointer"
            onClick={() => onOpenArticle(g.slug)}
          >
            {/* Stretched link: the whole card is clickable and the article gets a
                real href instead of being reachable only through JS. */}
            <a
              href={`/blog/${g.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onOpenArticle(g.slug);
              }}
              className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={g.h1}
            />
            <div className="flex items-center gap-2 text-[11px] font-semibold text-rose-600">
              <Tag className="h-3.5 w-3.5" />
              <span className="truncate">{g.keyword}</span>
            </div>
            <h2 className="mt-2 text-base sm:text-lg font-bold text-slate-900 group-hover:text-rose-700 transition-colors leading-snug">
              {g.h1}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">{g.excerpt}</p>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTool(g.tool);
                }}
                className="relative z-10 flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-rose-100 hover:text-rose-700 transition-colors"
              >
                <Download className="h-3 w-3" />
                <span>{isArabic ? 'جرّب الأداة' : 'Try the tool'}</span>
              </button>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                <span>{isArabic ? 'اقرأ الشرح' : 'Read guide'}</span>
                {isArabic ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
              </span>
            </div>
          </article>
        ))}
        {guides.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-500 py-10">
            {isArabic ? 'لا توجد مقالات بعد.' : 'No guides yet.'}
          </p>
        )}
      </div>
    </section>
  );
};

interface InlineToolBoxProps {
  lang: LanguageCode;
  tool: MediaType;
  keyword: string;
  onOpenTool: (tool: MediaType) => void;
}

/**
 * The downloader embedded in the article itself (top and middle).
 *
 * A reader arrives from a search for a specific problem; without this they
 * would read, leave, and open the site again from the homepage. Submitting a
 * link carries it into the tool page via sessionStorage, so the download starts
 * in one step and the visit stays on the site.
 */
const InlineToolBox: React.FC<InlineToolBoxProps> = ({ lang, tool, keyword, onOpenTool }) => {
  const isArabic = lang === 'ar';
  const [value, setValue] = React.useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = value.trim();
      if (url) sessionStorage.setItem('igsg_pending_url', url);
    } catch {}
    onOpenTool(tool);
  };

  return (
    <form
      onSubmit={submit}
      className="mt-5 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-purple-50 p-4 sm:p-5"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <p className="text-xs sm:text-sm font-extrabold text-slate-900">
        {isArabic ? `جرّب ${keyword} الآن` : `Try the ${keyword} tool now`}
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`inline-tool-input-${tool}`} className="sr-only">
          {isArabic ? 'رابط انستقرام' : 'Instagram link'}
        </label>
        <input
          id={`inline-tool-input-${tool}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="url"
          dir="ltr"
          placeholder={isArabic ? 'الصق رابط انستقرام هنا…' : 'Paste an Instagram link here…'}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-rose-500/25 hover:brightness-105 transition-all"
        >
          <Download className="h-4 w-4" />
          <span>{isArabic ? 'تحميل' : 'Download'}</span>
        </button>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-slate-500">
        {isArabic ? 'مجاني · بدون تسجيل دخول · بدون علامة مائية' : 'Free · No login · No watermark'}
      </p>
    </form>
  );
};

interface ArticlePageProps {
  guide: GuideArticle;
  related: GuideArticle[];
  lang: LanguageCode;
  siteName: string;
  onOpenArticle: (slug: string) => void;
  onOpenTool: (tool: MediaType) => void;
  onBackToBlog: () => void;
}

export const ArticlePage: React.FC<ArticlePageProps> = ({
  guide,
  related,
  lang,
  siteName,
  onOpenArticle,
  onOpenTool,
  onBackToBlog,
}) => {
  const isArabic = guide.lang === 'ar';
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const toolSlug = TOOL_SLUGS[guide.tool] || TOOL_SLUGS.video;
  const toolPath = `/${guide.lang}/${toolSlug}`;

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500" aria-label="Breadcrumb">
        <a
          href="/blog"
          onClick={(e) => {
            e.preventDefault();
            onBackToBlog();
          }}
          className="hover:text-rose-600 transition-colors"
        >
          {isArabic ? 'المدونة' : 'Blog'}
        </a>
        <ChevronRight className={`h-3 w-3 ${isArabic ? 'rotate-180' : ''}`} />
        <span className="text-slate-800 truncate max-w-[220px] sm:max-w-none">{guide.h1}</span>
      </nav>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200/70 px-3 py-1 text-[11px] font-bold text-rose-700">
        <Tag className="h-3 w-3" />
        <span>{guide.keyword}</span>
      </div>

      <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
        {guide.h1}
      </h1>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {guide.updatedAt ? guide.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0]}
        </span>
        <span>• {siteName}</span>
      </div>

      {/* CTA to the tool (internal link powerhouse) */}
      <a
        href={toolPath}
        onClick={(e) => {
          e.preventDefault();
          onOpenTool(guide.tool);
        }}
        className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-md shadow-rose-500/30 hover:brightness-105 transition-all"
      >
        <Download className="h-5 w-5" />
        <span>
          {isArabic ? `جرّب أداة ${guide.keyword} الآن مجاناً` : `Try the ${guide.keyword} tool now — free`}
        </span>
      </a>

      <InlineToolBox lang={guide.lang} tool={guide.tool} keyword={guide.keyword} onOpenTool={onOpenTool} />

      {/* Sections */}
      <div className="mt-8 space-y-6">
        {guide.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{s.heading}</h2>
            <p className="mt-2 text-sm sm:text-[15px] text-slate-700 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      {/* Second widget mid-article: the reader is convinced here, not at the top. */}
      <InlineToolBox lang={guide.lang} tool={guide.tool} keyword={guide.keyword} onOpenTool={onOpenTool} />

      {/* FAQs */}
      {guide.faqs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {isArabic ? 'أسئلة شائعة' : 'Frequently asked questions'}
          </h2>
          <div className="mt-3 space-y-2">
            {guide.faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-start text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>{f.question}</span>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openFaq === i ? 'rotate-90' : ''} ${isArabic ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <p className="px-4 pb-3 text-xs sm:text-sm text-slate-600 leading-relaxed">{f.answer}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related guides (internal linking) */}
      {related.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            {isArabic ? 'شروحات ذات صلة' : 'Related guides'}
          </h2>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <a
                  href={`/blog/${r.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenArticle(r.slug);
                  }}
                  className="text-start text-xs sm:text-sm font-semibold text-rose-700 hover:underline cursor-pointer"
                >
                  {r.h1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
};
