import React from 'react';
import { ArrowRight, Infinity, ShieldCheck, Zap, UserCheck, ServerOff } from 'lucide-react';
import { LanguageCode } from '../types';
import { UI_TRANSLATIONS } from '../data/i18nData';

interface WhyChooseUsProps {
  currentLanguage: LanguageCode;
}

export const WhyChooseUs: React.FC<WhyChooseUsProps> = ({ currentLanguage }) => {
  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  // Every statement below is checkable against the code:
  // - no account: the app has no sign-in flow for visitors;
  // - public links only: extractShortcode() has no story/highlight support;
  // - rate limits: checkRateLimit() in functions/_lib/cf.ts (60/min extract);
  // - media streaming: functions/api/proxy-media.ts sets Cache-Control 86400.
  const cards = [
    {
      title: 'No account, no Instagram login',
      description:
        'Paste a public link and download. IGSaveGo never asks for your Instagram username, password or session cookie, and there is no sign-up form.',
      icon: UserCheck,
      badge: 'No sign-up',
      gradient: 'from-blue-600 to-indigo-600',
    },
    {
      title: 'Public content only',
      description:
        'The tool resolves post, Reel and IGTV links that are visible without logging in. Private accounts, story links and highlights are not supported.',
      icon: ShieldCheck,
      badge: 'Privacy-respecting',
      gradient: 'from-rose-500 to-pink-600',
    },
    {
      title: 'Honest about limits',
      description:
        'Per-IP rate limits keep the service available for everyone, and link availability depends on Instagram. No countdown timers and no fake progress bars.',
      icon: Infinity,
      badge: 'Clear limits',
      gradient: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Simple by design</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {t.whyChooseTitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            A focused downloader with no account, no app install, and no exaggerated promises.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-slate-50/40 p-8 shadow-xs hover:shadow-xl hover:shadow-slate-200/50 hover:bg-white transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr ${card.gradient} text-white shadow-md`}>
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="rounded-full bg-slate-200/70 px-3 py-1 text-[11px] font-bold text-slate-700">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{card.description}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <ServerOff className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span>No media library; files stream to your device</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold">
          <a href="/how-to-use" className="inline-flex items-center gap-1 text-rose-600 hover:underline">
            Read the step-by-step guide <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <a href="/privacy" className="text-slate-500 hover:text-slate-700 hover:underline">
            What data is processed
          </a>
          <a href="/faq" className="text-slate-500 hover:text-slate-700 hover:underline">
            Frequently asked questions
          </a>
        </div>
      </div>
    </section>
  );
};
