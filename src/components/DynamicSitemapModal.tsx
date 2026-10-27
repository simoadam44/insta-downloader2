import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode, ExternalLink } from 'lucide-react';
import { generateDynamicSitemapXml } from '../services/seoEngine';

interface DynamicSitemapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DynamicSitemapModal: React.FC<DynamicSitemapModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const sitemapXml = generateDynamicSitemapXml(
    typeof window !== 'undefined' ? window.location.origin : 'https://www.igsavego.com'
  );

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sitemapXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sitemapXml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sitemap.xml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Dynamic sitemap.xml Generator</h3>
              <p className="text-xs text-slate-500">
                Covers 41 indexed URLs across 8 languages with xhtml:link hreflang tags
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* XML Viewer */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-300 font-mono text-xs leading-relaxed selection:bg-rose-500 selection:text-white">
          <pre className="whitespace-pre-wrap">{sitemapXml}</pre>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            <span>Search engines auto-crawl this directly for high SERP ranking.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Copied XML!' : 'Copy XML'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 px-4 py-2 text-xs font-bold text-white hover:brightness-105 transition-all shadow-md shadow-rose-500/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download sitemap.xml</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
