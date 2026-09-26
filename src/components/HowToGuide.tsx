import React from 'react';
import { Copy, ArrowRight, Download, CheckCircle2 } from 'lucide-react';
import { LanguageCode, MediaType, ToolSeoContent } from '../types';
import { TOOL_CONTENT, UI_TRANSLATIONS } from '../data/i18nData';

interface HowToGuideProps {
  currentLanguage: LanguageCode;
  activeTool: MediaType;
  customContent?: Partial<ToolSeoContent>;
}

export const HowToGuide: React.FC<HowToGuideProps> = ({
  currentLanguage,
  activeTool,
  customContent,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const baseContent = TOOL_CONTENT[activeTool][currentLanguage] || TOOL_CONTENT[activeTool]['en'];
  const content = { ...baseContent, ...customContent };

  const stepIcons = [Copy, ArrowRight, Download];

  return (
    <section className="py-14 sm:py-20 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Simple 3-Step Guide</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {content.h1 ? `How to Download with ${content.h1}?` : t.howToTitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            {t.howToSubtitle}
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {content.steps.map((stepItem, idx) => {
            const Icon = stepIcons[idx] || Download;
            return (
              <div
                key={stepItem.step}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 sm:p-8 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:border-rose-200 transition-all duration-200"
              >
                {/* Step badge and icon */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-purple-600 text-white font-black text-lg shadow-md shadow-rose-500/20">
                      0{stepItem.step}
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs group-hover:text-rose-600 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mt-6 text-lg font-bold text-slate-900">
                    {stepItem.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {stepItem.description}
                  </p>
                </div>

                {/* Bottom graphical cue */}
                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>Step {stepItem.step} of 3</span>
                  <span className="text-rose-500 font-bold">100% Free</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
