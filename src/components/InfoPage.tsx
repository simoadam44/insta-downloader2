import React from 'react';
import { ArrowLeft, CalendarDays, Mail, ShieldCheck } from 'lucide-react';
import type { InfoBlock, InfoPage as InfoPageContent } from '../data/infoPages';

interface InfoPageProps {
  page: InfoPageContent;
  /** Configured contact address from branding settings. */
  contactEmail: string;
}

// rose-700 keeps inline links above the 4.5:1 contrast ratio at 14px on the
// near-white backgrounds used by articles and asides (rose-600 measured 4.4:1).
const linkClass =
  'font-semibold text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-800 hover:decoration-rose-400';

/**
 * Renders one informational/legal page.
 *
 * Design decisions:
 * - real <a href> values everywhere, so crawlers and "open in new tab" work
 *   without JavaScript interceptors;
 * - one <h1>, then <h2> per section (and <h3> per FAQ), matching the visible
 *   outline used by the page metadata;
 * - content is plain text in the DOM, not hidden in an accordion, so it is
 *   readable, selectable and indexable.
 */
export const InfoPage: React.FC<InfoPageProps> = ({ page, contactEmail }) => {
  const email = (contactEmail || 'support@igsavego.com').trim();

  const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    const withEmail = text.replace(/\{email\}/g, email);
    const parts = withEmail.split(/(\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
    return parts.map((part, index) => {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!link) return <React.Fragment key={`${keyPrefix}-t-${index}`}>{part}</React.Fragment>;
      const [, label, href] = link;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          key={`${keyPrefix}-l-${index}`}
          href={href}
          className={linkClass}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>
      );
    });
  };

  const renderBlock = (block: InfoBlock, index: number) => {
    const key = `block-${index}`;
    switch (block.type) {
      case 'p':
        return (
          <p key={key} className="text-sm sm:text-[15px] leading-7 text-slate-600">
            {renderInline(block.text, key)}
          </p>
        );
      case 'list':
        return block.ordered ? (
          <ol key={key} className="list-decimal space-y-2 pl-5 text-sm sm:text-[15px] leading-7 text-slate-600 marker:font-semibold marker:text-rose-500">
            {block.items.map((item, i) => (
              <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={key} className="list-disc space-y-2 pl-5 text-sm sm:text-[15px] leading-7 text-slate-600 marker:text-rose-400">
            {block.items.map((item, i) => (
              <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
            ))}
          </ul>
        );
      case 'table':
        return (
          <div key={key} className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {block.head.map((cell) => (
                    <th key={cell} scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={`${key}-r-${r}`} className="border-t border-slate-200 align-top">
                    {row.map((cell, c) => (
                      <td key={`${key}-r-${r}-c-${c}`} className="px-4 py-3 text-slate-600 leading-6">
                        {renderInline(cell, `${key}-r-${r}-c-${c}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'email':
        return (
          <p key={key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3">
            <Mail className="h-4 w-4 text-rose-500" aria-hidden="true" />
            <a href={`mailto:${email}`} className="text-sm sm:text-base font-bold text-rose-700 underline underline-offset-2 hover:text-rose-800">
              {email}
            </a>
            <span className="text-xs text-slate-500">(opens your email application)</span>
          </p>
        );
      case 'note':
        return (
          <aside key={key} className="rounded-2xl border-l-4 border-rose-400 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
            {renderInline(block.text, key)}
          </aside>
        );
      default:
        return null;
    }
  };

  const updatedLabel = new Date(page.updated).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article>
      {/* Hero */}
      <header className="border-b border-slate-100 bg-gradient-to-b from-rose-50/60 via-white to-slate-50 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <li>
                <a href="/" className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Downloader
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-slate-700">
                {page.h1}
              </li>
            </ol>
          </nav>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            IGSaveGo · Information
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{page.h1}</h1>

          <div className="mt-4 space-y-3">
            {page.intro.map((paragraph, index) => (
              <p key={`intro-${index}`} className="text-sm sm:text-base leading-7 text-slate-600">
                {renderInline(paragraph, `intro-${index}`)}
              </p>
            ))}
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Last updated: <time dateTime={page.updated}>{updatedLabel}</time>
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {page.sections.length >= 5 && (
            <nav aria-label="On this page" className="mb-10 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">On this page</h2>
              <ol className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="rounded text-slate-600 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="space-y-10">
            {page.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">{section.heading}</h2>
                <div className="mt-3 space-y-4">{section.blocks.map(renderBlock)}</div>
              </section>
            ))}
          </div>

          {page.faqs && page.faqs.length > 0 && (
            <section id="questions" className="mt-10 scroll-mt-24">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Questions and answers</h2>
              <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">
                {page.faqs.map((faq) => (
                  <div key={faq.question} className="p-5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{renderInline(faq.answer, faq.question)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related pages */}
          <aside className="mt-12 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Related pages</h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {page.related.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={linkClass}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <p className="mt-8 text-sm text-slate-600">
            Something on this page unclear or out of date?{' '}
            <a href="/contact" className={linkClass}>
              Contact IGSaveGo
            </a>{' '}
            and include the page address.
          </p>
        </div>
      </div>
    </article>
  );
};
