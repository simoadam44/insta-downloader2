import React from 'react';
import { X, Shield, FileText, AlertTriangle } from 'lucide-react';

interface LegalModalProps {
  type: 'terms' | 'privacy' | 'disclaimer' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const content = {
    terms: {
      title: 'Terms of Service',
      icon: FileText,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p>
            Welcome to SSSInstagram. By accessing or using our online Instagram media downloader, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must refrain from using the service.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">1. Personal & Non-Commercial Fair Use</h4>
          <p>
            SSSInstagram is provided strictly for personal, non-commercial, and fair-use educational archiving purposes. You agree to download media only for offline viewing and backup of content that you own or have explicit permission from the original copyright owner to access.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">2. Intellectual Property Rights</h4>
          <p>
            All intellectual property rights, trademarks, copyrights, and ownership in and to photos, videos, reels, and stories downloaded via SSSInstagram belong exclusively to their respective creators, publishers, and Meta Platforms, Inc. You are strictly prohibited from redistributing, monetizing, re-uploading, or selling downloaded materials.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">3. Prohibited Conduct</h4>
          <p>
            You may not attempt to reverse engineer, disrupt, overload, or bypass rate limits of our web services using automated bots, scrapers, or DDoS attacks.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">4. Disclaimer of Warranties</h4>
          <p>
            SSSInstagram is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, express or implied.
          </p>
        </div>
      ),
    },
    privacy: {
      title: 'Privacy Policy',
      icon: Shield,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p>
            At SSSInstagram, your digital privacy and anonymity are our foundational priorities. This Privacy Policy clarifies how we treat information when you use our downloader.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">1. Zero Account Logging & Anonymity</h4>
          <p>
            We do not require users to create an account, register, or provide personal details (such as names, emails, telephone numbers, or Instagram passwords). All media extraction requests are processed through anonymous proxy relays.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">2. No Permanent File Retention</h4>
          <p>
            We do not store, host, or duplicate downloaded photos, videos, or stories on our servers. Media URLs are parsed in real-time and served directly from Instagram’s public CDN delivery endpoints.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">3. Cookies & Analytics</h4>
          <p>
            We do not use tracking cookies to build user advertising profiles. Any cookies utilized are strictly technical and ephemeral (such as keeping track of your selected interface language).
          </p>
          <h4 className="font-bold text-slate-900 text-sm">4. Security</h4>
          <p>
            All web traffic between your browser and SSSInstagram is encrypted using industry-standard TLS 1.3 cryptographic protocols.
          </p>
        </div>
      ),
    },
    disclaimer: {
      title: 'DMCA & Legal Disclaimer',
      icon: AlertTriangle,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p>
            SSSInstagram operates in strict compliance with the Digital Millennium Copyright Act (DMCA) and international copyright legislation.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">1. Trademark Notice</h4>
          <p>
            &ldquo;Instagram&rdquo;, &ldquo;Reels&rdquo;, &ldquo;IGTV&rdquo;, and the Instagram logo are registered trademarks of Meta Platforms, Inc. SSSInstagram is an independent software tool and is NOT affiliated with, sponsored by, authorized by, or associated in any way with Meta Platforms, Inc. or Instagram.
          </p>
          <h4 className="font-bold text-slate-900 text-sm">2. DMCA Takedown Procedure</h4>
          <p>
            If you are a copyright owner or authorized representative and believe that material accessed through our website infringes upon your copyright, please submit a formal takedown request containing:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>Direct URL on Instagram where the material is located.</li>
            <li>Your contact details (name, email address, physical address).</li>
            <li>A statement affirming good-faith belief of unauthorized use.</li>
          </ul>
          <p>
            Email inquiries may be directed to: <span className="font-mono text-rose-600">dmca@sssinstagram.app</span>. We respond to verified notices within 24 to 48 business hours.
          </p>
        </div>
      ),
    },
  }[type];

  const Icon = content.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{content.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">{content.body}</div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
