import React from 'react';
import {
  Video,
  Sparkles,
  Image as ImageIcon,
  CircleDot,
  FolderHeart,
  Layers,
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
  const features = [
    {
      tool: 'video' as MediaType,
      title: 'Instagram Video Downloader',
      description: 'Download standard Instagram feed videos in Full HD 1080p MP4. Uncompressed audio and fast extraction without watermarks.',
      icon: Video,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      tool: 'reels' as MediaType,
      title: 'Instagram Reels Downloader',
      description: 'Save viral 9:16 vertical Reels with crystal-clear audio soundtrack or extract high-bitrate background MP3 music tracks.',
      icon: Sparkles,
      color: 'from-rose-500 to-pink-500',
    },
    {
      tool: 'photo' as MediaType,
      title: 'Photo & Carousel Downloader',
      description: 'Save single photos and multi-image carousel albums in original 1080x1350 resolution with zero pixelation or compression.',
      icon: ImageIcon,
      color: 'from-amber-500 to-orange-500',
    },
    {
      tool: 'story' as MediaType,
      title: 'Anonymous Story Saver',
      description: 'Watch and download Instagram Stories 100% anonymously. The account owner will never see your profile in their viewers list.',
      icon: CircleDot,
      color: 'from-purple-500 to-indigo-500',
    },
    {
      tool: 'highlights' as MediaType,
      title: 'Highlights & Archive Saver',
      description: 'Archive permanently saved Highlight stories and custom cover artwork icons in full high definition with no expiration.',
      icon: FolderHeart,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      tool: 'photo' as MediaType,
      title: 'Batch Carousel Extractor',
      description: 'Automatically unpack complex Instagram carousel posts and swipe galleries into separate full-resolution media files.',
      icon: Layers,
      color: 'from-fuchsia-500 to-rose-500',
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-slate-50/70 border-t border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            <Zap className="h-3.5 w-3.5" />
            <span>All-In-One Toolkit</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            Everything You Need to Save Instagram Media
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Engineered specifically for creators, archivists, and everyday users who want fast, lossless downloads.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                onClick={() => onSelectTool(feat.tool)}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs hover:shadow-xl hover:shadow-slate-200/60 hover:border-slate-300 transition-all duration-200 cursor-pointer"
              >
                <div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${feat.color} text-white shadow-md transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-500 group-hover:text-rose-600">
                  <span>Open Tool</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical highlight bar */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-wrap items-center justify-around gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">1080p & 4K</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Original Resolution</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">0 ms</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Account Footprint</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">100%</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Free with No Limits</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-left">
            <Shield className="h-7 w-7 text-emerald-500" />
            <div>
              <div className="text-sm font-bold text-slate-900">TLS 1.3 Encryption</div>
              <div className="text-xs text-slate-500">Zero Server-Side Media Retention</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
