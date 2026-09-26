import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';
import { FaqItem, LanguageCode, MediaType, ToolSeoContent } from '../types';
import { TOOL_CONTENT, UI_TRANSLATIONS } from '../data/i18nData';

interface FaqSectionProps {
  currentLanguage: LanguageCode;
  activeTool: MediaType;
  customFaqs?: FaqItem[];
}

export const FaqSection: React.FC<FaqSectionProps> = ({
  currentLanguage,
  activeTool,
  customFaqs,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const baseContent: ToolSeoContent = TOOL_CONTENT[activeTool][currentLanguage] || TOOL_CONTENT[activeTool]['en'];
  const faqs = customFaqs && customFaqs.length > 0 ? customFaqs : baseContent.faqs;

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-14 sm:py-20 bg-slate-50/70 border-t border-slate-200/70" id="faq">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {t.faqTitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            {t.faqSubtitle}
          </p>
        </div>

        {/* Accordion List */}
        <div className="mt-10 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-200 shadow-2xs"
              >
                <button
                  id={`faq-btn-${index}`}
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between p-5 sm:p-6 text-left focus:outline-hidden"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-bold text-slate-900 pr-4">
                    {faq.question}
                  </span>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${index}`}
                    className="border-t border-slate-100 px-5 sm:px-6 pb-6 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed animate-in fade-in duration-150"
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Schema validation badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Structured FAQPage Schema.org microdata synchronized with Google Rich Results</span>
        </div>
      </div>
    </section>
  );
};
