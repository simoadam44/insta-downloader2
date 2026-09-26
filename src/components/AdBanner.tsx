import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AdSlotConfig } from '../types';

interface AdBannerProps {
  slot: 'headerBanner' | 'belowInput' | 'aboveResult' | 'inContentBanner' | 'footerBanner' | 'stickyFooterBanner';
  config?: AdSlotConfig;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export const AdBanner: React.FC<AdBannerProps> = ({ slot, config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!config || !config.enabled || isDismissed) return;

    // If custom HTML with script tags is provided, execute scripts safely
    if (config.customHtml && containerRef.current) {
      const container = containerRef.current;
      const scripts = container.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr: Attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }

    // If AdSense slot configuration is present
    if (config.type === 'adsense' && config.adClient && config.adSlot) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Handled silently
      }
    }
  }, [config, isDismissed]);

  if (!config || !config.enabled || isDismissed) {
    return null;
  }

  // 1. Sticky Bottom Floating Banner
  if (slot === 'stickyFooterBanner') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md p-2 shadow-2xl flex flex-col items-center justify-center">
        <div className="relative w-full max-w-4xl flex items-center justify-center">
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute -top-3 right-0 rounded-full bg-slate-800 border border-slate-700 p-1 text-slate-300 hover:text-white shadow-md z-50 text-xs"
            aria-label="Close ad"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          
          <div className="w-full text-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Sponsored
            </span>
            {config.customHtml && config.customHtml.trim() ? (
              <div
                ref={containerRef}
                className="overflow-hidden flex justify-center items-center"
                dangerouslySetInnerHTML={{ __html: config.customHtml }}
              />
            ) : config.type === 'adsense' && config.adClient && config.adSlot ? (
              <div className="w-full min-h-[50px] sm:min-h-[90px] flex items-center justify-center">
                <ins
                  className="adsbygoogle"
                  style={{ display: 'block', minHeight: '50px' }}
                  data-ad-client={config.adClient}
                  data-ad-slot={config.adSlot}
                  data-ad-format="horizontal"
                  data-full-width-responsive="true"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-800/80 px-4 py-2 text-white">
                <div className="flex items-center gap-2 text-left">
                  <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold">PRO</span>
                  <span className="text-xs sm:text-sm font-semibold">{config.title || 'Download Unlimited High Speed Video'}</span>
                </div>
                <a
                  href="https://google.com/adsense"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-500"
                >
                  Get Access
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Custom HTML / Script Ad Injection
  if (config.customHtml && config.customHtml.trim()) {
    return (
      <div className="mx-auto my-4 max-w-4xl px-4 text-center">
        <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
          Advertisement
        </div>
        <div
          ref={containerRef}
          className="flex justify-center items-center overflow-hidden min-h-[50px] sm:min-h-[90px]"
          dangerouslySetInnerHTML={{ __html: config.customHtml }}
        />
      </div>
    );
  }

  // 3. Google AdSense Native Unit
  if (config.type === 'adsense' && config.adClient && config.adSlot) {
    return (
      <div className="mx-auto my-4 max-w-4xl px-4 text-center">
        <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
          Advertisement
        </div>
        <div className="min-h-[90px] w-full flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-2">
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '90px' }}
            data-ad-client={config.adClient}
            data-ad-slot={config.adSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  // 4. Default Responsive High-Conversion Sponsor Card
  const isLeaderboard = slot === 'headerBanner' || slot === 'footerBanner';

  return (
    <div className="mx-auto my-4 max-w-4xl px-4">
      <div className="text-center">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          Advertisement
        </span>
      </div>
      <div
        className={`mt-1 flex flex-col sm:flex-row items-center justify-between gap-3 overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-gradient-to-r from-slate-50 via-rose-50/30 to-slate-50 p-3.5 sm:p-4 text-center sm:text-left shadow-2xs ${
          isLeaderboard ? 'min-h-[80px]' : 'min-h-[95px]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-md">
            AD
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 justify-center sm:justify-start">
              <span className="font-bold text-slate-800 text-xs sm:text-sm">
                {config.title || 'Ultra-Fast Private Cloud VPN & Storage'}
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-800">
                Sponsored
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 max-w-xl line-clamp-1 mt-0.5">
              Secure your high-speed media downloads with zero-log encrypted server networks. 30-day money-back guarantee.
            </p>
          </div>
        </div>

        <a
          href="https://google.com/adsense"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-full sm:w-auto text-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
        >
          Learn More ↗
        </a>
      </div>
    </div>
  );
};
