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

/**
 * Renders a real advertising unit only.
 *
 * Earlier versions fell back to a hand-written "Sponsored VPN / cloud storage"
 * card with a money-back guarantee when a slot was enabled but had no AdSense
 * unit or custom HTML. That was invented advertising inventory and could be
 * mistaken for site content, so it has been removed: if there is no configured
 * unit, nothing is rendered.
 */
export const AdBanner: React.FC<AdBannerProps> = ({ slot, config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const hasCustomHtml = Boolean(config?.customHtml && config.customHtml.trim());
  const hasAdSense = Boolean(config?.type === 'adsense' && config.adClient && config.adSlot);
  const isRealUnit = Boolean(config?.enabled) && (hasCustomHtml || hasAdSense);

  useEffect(() => {
    if (!isRealUnit || isDismissed) return;

    // Re-execute scripts in custom HTML (innerHTML does not run them).
    if (hasCustomHtml && containerRef.current) {
      const container = containerRef.current;
      container.querySelectorAll('script').forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr: Attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }

    if (hasAdSense) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense is optional; a blocked or not-yet-loaded script is harmless.
      }
    }
  }, [isRealUnit, hasCustomHtml, hasAdSense, isDismissed]);

  if (!isRealUnit || isDismissed) {
    return null;
  }

  const unit = hasCustomHtml ? (
    <div
      ref={containerRef}
      className="flex min-h-[50px] w-full justify-center overflow-hidden sm:min-h-[90px]"
      dangerouslySetInnerHTML={{ __html: config!.customHtml! }}
    />
  ) : (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', width: '100%', minHeight: '50px' }}
      data-ad-client={config!.adClient}
      data-ad-slot={config!.adSlot}
      data-ad-format={slot === 'stickyFooterBanner' ? 'horizontal' : 'auto'}
      data-full-width-responsive="true"
    />
  );

  if (slot === 'stickyFooterBanner') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center justify-center border-t border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md">
        <div className="relative flex w-full max-w-4xl items-center justify-center">
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute -top-3 right-0 z-50 rounded-full border border-slate-700 bg-slate-800 p-1 text-xs text-slate-300 shadow-md hover:text-white"
            aria-label="Close advertisement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="w-full text-center">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Advertisement
            </span>
            {unit}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto my-4 max-w-4xl px-4 text-center">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Advertisement
      </div>
      <div className="flex min-h-[50px] w-full items-center justify-center sm:min-h-[90px]">
        {unit}
      </div>
    </div>
  );
};
