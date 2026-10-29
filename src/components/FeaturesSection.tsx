import React from 'react';
import {
  Video,
  Sparkles,
  Image as ImageIcon,
  CircleDot,
  FolderHeart,
  Music,
  Shield,
  Zap,
} from 'lucide-react';
import { LanguageCode, MediaType } from '../types';

interface FeaturesSectionProps {
  currentLanguage: LanguageCode;
  onSelectTool: (tool: MediaType) => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
  currentLanguage: _currentLanguage,
  onSelectTool,
}) => {
  // Copy is limited to behaviour that can be checked in the extractor:
  // post/Reel/IGTV links are accepted, story and highlight links are not,
  // the MP3 action is a local lamejs conversion, and quality is whatever
  // Instagram exposes for that post.
  const features: {
    tool: MediaType;
    title: string;
    description: string;
    cta: string;
    icon: typeof Video;
    color: string;
  }[] = [
    {
      tool: 'video' as MediaType,
      title: 'Instagram Video Downloader',
      description:
        'Save the MP4 that Instagram exposes for a public video post. Nothing is upscaled and no fixed resolution is promised.',
      cta: 'Open tool',
      icon: Video,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      tool: 'reels' as MediaType,
      title: 'Instagram Reels Downloader',
      description:
        'Download a public Reel as MP4 with its original audio track. No account and no app install are required.',
      cta: 'Open tool',
      icon: Sparkles,
      color: 'from-rose-500 to-pink-500',
    },
    {
      tool: 'photo' as MediaType,
      title: 'Instagram Photo Downloader',
      description:
        'Save the JPG that Instagram returns for a public photo. One media item is returned per request; carousel coverage is not guaranteed.',
      cta: 'Open tool',
      icon: ImageIcon,
      color: 'from-amber-500 to-orange-500',
    },
    {
      tool: 'story' as MediaType,
      title: 'Story Support Status',
      description:
        'Story and highlight links are rejected today with a clear message. The tab stays visible so the limitation is not hidden.',
      cta: 'View status',
      icon: CircleDot,
      color: 'from-purple-500 to-indigo-500',
    },
    {
      tool: 'highlights' as MediaType,
      title: 'Highlights: Not Supported',
      description:
        'Highlights need an authenticated Instagram session, which this tool does not use. Public post, Reel and IGTV links still work.',
      cta: 'View status',
      icon: FolderHeart,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      tool: 'reels' as MediaType,
      title: 'MP3 Audio Extraction',
      description:
        'When a Reel has an audio track, the result card can convert it to MP3 locally in your browser. Nothing is sent to a conversion server.',
      cta: 'Open tool',
      icon: Music,
      color: 'from-fuchsia-500 to-rose-500',
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-slate-50/70 border-t border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>What the tool does</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            One browser-based downloader
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Built for public Instagram posts, Reels and IGTV videos — with the unsupported
            formats stated up front instead of hidden behind a promise.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <button
                key={feat.title}
                type="button"
                onClick={() => onSelectTool(feat.tool)}
                className="group relative flex w-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 text-left shadow-xs hover:shadow-xl hover:shadow-slate-200/60 hover:border-slate-300 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${feat.color} text-white shadow-md transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-700 group-hover:text-rose-800">
                  <span>{feat.cta}</span>
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Technical highlight bar */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-wrap items-center justify-around gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">Up to 1080p</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Quality Instagram exposes</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">None</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Accounts required</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">Free</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Rate-limited, no payment</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-left">
            <Shield className="h-7 w-7 text-emerald-500" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold text-slate-900">HTTPS delivery</div>
              <div className="text-xs text-slate-500">No media library or archive</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
