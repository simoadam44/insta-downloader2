import React from 'react';
import { Infinity, UserCheck, Zap, ShieldCheck, HeartHandshake, Award } from 'lucide-react';
import { LanguageCode } from '../types';
import { UI_TRANSLATIONS } from '../data/i18nData';

interface WhyChooseUsProps {
  currentLanguage: LanguageCode;
}

export const WhyChooseUs: React.FC<WhyChooseUsProps> = ({ currentLanguage }) => {
  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const cards = [
    {
      title: 'Unlimited Downloads',
      description: 'Download as many videos, reels, photos, and stories as you desire. No daily quotas, no sign-up popups, and no paywalls ever.',
      icon: Infinity,
      badge: 'Zero Quotas',
      gradient: 'from-blue-600 to-indigo-600',
    },
    {
      title: '100% Anonymous & Private',
      description: 'Your identity is never exposed. We do not require your Instagram credentials or personal data. View and save stories without leaving footprints.',
      icon: UserCheck,
      badge: 'Zero Tracking',
      gradient: 'from-rose-500 to-pink-600',
    },
    {
      title: 'Ultra-Fast & Secure Cloud CDN',
      description: 'Our global distributed edge nodes parse and serve direct CDN streams in milliseconds with TLS 1.3 encryption and zero file logging.',
      icon: Zap,
      badge: 'Edge Powered',
      gradient: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Award className="h-3.5 w-3.5" />
            <span>Top Rated Instagram Downloader</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {t.whyChooseTitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            {t.whyChooseSubtitle}
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
                  <div className="flex items-center justify-between">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr ${card.gradient} text-white shadow-md`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="rounded-full bg-slate-200/70 px-3 py-1 text-[11px] font-bold text-slate-700">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Verified Safe & Clean</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Community Trust Endorsement */}
        <div className="mt-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <HeartHandshake className="h-4 w-4 text-rose-500" />
          <span>Trusted by over 4,500,000 users worldwide each month for fast media archiving.</span>
        </div>
      </div>
    </section>
  );
};
