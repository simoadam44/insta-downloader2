import React, { useEffect, useState } from 'react';
import {
  Download,
  Music,
  CheckCircle2,
  Copy,
  RotateCcw,
  Film,
  Image as ImageIcon,
  Heart,
  Eye,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Video,
  RefreshCw,
} from 'lucide-react';
import { ExtractedMedia, LanguageCode, QualityOption } from '../types';
import { UI_TRANSLATIONS } from '../data/i18nData';
import { triggerBrowserDownload } from '../services/extractorService';

interface MediaResultCardProps {
  media: ExtractedMedia;
  currentLanguage: LanguageCode;
  onReset: () => void;
  // Called when the preview stream fails (Instagram CDN signatures expire).
  // Parent should re-extract the same URL to mint fresh links.
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const MediaResultCard: React.FC<MediaResultCardProps> = ({
  media,
  currentLanguage,
  onReset,
  onRefresh,
  isRefreshing,
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadingQualityId, setDownloadingQualityId] = useState<string | null>(null);
  // CDN links expire: any preview failure flips this and offers a 1-tap refresh.
  const [mediaError, setMediaError] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  // Fresh media (new extract object or new slide) clears the error state.
  // NOTE: compare the whole object, not media.id — a refresh re-extracts the
  // SAME shortcode, so media.id is unchanged and an id-based effect would
  // leave a stale overlay on screen ("refresh does nothing" bug).
  useEffect(() => {
    setMediaError(false);
  }, [media, activeSlideIndex]);
  useEffect(() => {
    setAvatarBroken(false);
  }, [media.id]);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const isArabic = currentLanguage === 'ar';
  const currentItem = media.items[activeSlideIndex] || media.items[0];
  const isCarousel = media.items.length > 1;

  // Build 1080p Full HD quality
  const qualities: QualityOption[] = (currentItem.availableQualities && currentItem.availableQualities.length > 0)
    ? currentItem.availableQualities
    : currentItem.type === 'video'
    ? [
        {
          id: '1080p',
          label: '1080p Full HD',
          quality: '1080p',
          resolution: '1080x1920',
          fileSize: '~14.5 MB',
          downloadUrl: currentItem.downloadUrl,
          format: 'mp4',
          isFullHd: true,
          fps: 60,
          bitrate: 'High Bitrate (Ultra HD)',
        },
      ]
    : [
        {
          id: 'full',
          label: 'Original Ultra HD (1080p+)',
          quality: '1080p',
          resolution: currentItem.dimensions || '1080x1350',
          fileSize: '~2.4 MB',
          downloadUrl: currentItem.downloadUrl,
          format: 'jpg',
          isFullHd: true,
          bitrate: 'Maximum Quality (Original Color)',
        },
      ];

  const selectedQuality = qualities[0];

  const handleDownloadSpecificQuality = async (qualityOption: QualityOption, itemIndex = activeSlideIndex) => {
    const targetItem = media.items[itemIndex];
    if (!targetItem) return;

    setDownloadingQualityId(qualityOption.id);
    const extension = qualityOption.format;
    const qualityTag = qualityOption.quality.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `igsavego_${media.author.username}_${targetItem.id}_${qualityTag}.${extension}`;
    await triggerBrowserDownload(qualityOption.downloadUrl, filename);
    setDownloadingQualityId(null);
  };

  const handleDownloadAudio = async () => {
    const audioUrl = media.audioTrack?.audioUrl || (currentItem.type === 'video' ? currentItem.downloadUrl : '');
    if (!audioUrl) return;
    setDownloadingQualityId('audio');
    const filename = `igsavego_audio_${media.author.username}_320kbps.mp3`;
    await triggerBrowserDownload(audioUrl, filename);
    setDownloadingQualityId(null);
  };

  const handleCopyLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(media.originalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div id="media-result-container" className="mx-auto max-w-4xl px-4 sm:px-6 py-8 animate-in fade-in zoom-in-95 duration-200">
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/60">
        {/* Top Header with Author & Reset */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50 gap-3">
          {/* Author info */}
          <div className="flex items-center gap-3">
            {avatarBroken || !media.author.avatar ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-purple-600 text-base font-bold text-white ring-2 ring-rose-500/20">
                {(media.author.username || 'I').charAt(0).toUpperCase()}
              </div>
            ) : (
              <img
                src={media.author.avatar}
                alt={media.author.username}
                onError={() => setAvatarBroken(true)}
                className="h-11 w-11 rounded-full border border-slate-200 object-cover ring-2 ring-rose-500/20"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 text-sm sm:text-base hover:underline cursor-pointer">
                  @{media.author.username}
                </span>
                {media.author.isVerified && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white" title="Verified Account">
                    ✓
                  </span>
                )}
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  {media.mediaType}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>{media.author.fullName}</span>
                {media.author.followers && <span>• {media.author.followers} {isArabic ? 'متابع' : 'followers'}</span>}
              </div>
            </div>
          </div>

          {/* Reset button */}
          <button
            id="btn-download-another"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>{t.downloadAnother}</span>
          </button>
        </div>

        {/* Media Preview & Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
          {/* Backend notice (e.g. no video stream exposed for this post) */}
          {media.note && (
            <div className="md:col-span-12 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 leading-relaxed">
              <span className="mt-0.5 shrink-0">ℹ️</span>
              <span>{media.note}</span>
            </div>
          )}
          {/* Left Column: Media Player / Preview */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 shadow-md aspect-4/5 sm:aspect-square flex items-center justify-center">
              {currentItem.type === 'video' ? (
                <video
                  key={currentItem.url}
                  src={currentItem.url}
                  poster={currentItem.thumbnail}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setMediaError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={currentItem.url}
                  alt={media.caption}
                  onError={() => setMediaError(true)}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Expired-link overlay: Instagram CDN signatures expire — 1 tap mints fresh links */}
              {mediaError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 p-6 text-center backdrop-blur-xs">
                  <RefreshCw className={`h-8 w-8 text-rose-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <p className="text-xs font-semibold text-white leading-relaxed">
                    {isArabic
                      ? 'انتهت صلاحية رابط المعاينة (روابط انستقرام مؤقتة). حدّث للحصول على رابط جديد فوراً.'
                      : 'This preview link expired (Instagram links are temporary). Refresh to mint a fresh one.'}
                  </p>
                  {onRefresh && (
                    <button
                      onClick={onRefresh}
                      disabled={isRefreshing}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 px-4 py-2 text-xs font-bold text-white hover:brightness-105 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isRefreshing ? (isArabic ? 'جاري التحديث...' : 'Refreshing...') : (isArabic ? 'تحديث الرابط' : 'Refresh link')}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Active Selected Quality badge tag */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-xs border border-white/10">
                {currentItem.type === 'video' ? <Film className="h-3.5 w-3.5 text-rose-400" /> : <ImageIcon className="h-3.5 w-3.5 text-rose-400" />}
                <span>{selectedQuality.label}</span>
              </div>

              {/* Carousel Next/Prev Controls */}
              {isCarousel && (
                <>
                  <button
                    onClick={() => {
                      setActiveSlideIndex((prev) => (prev > 0 ? prev - 1 : media.items.length - 1));
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors cursor-pointer"
                    aria-label="Previous Slide"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveSlideIndex((prev) => (prev < media.items.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors cursor-pointer"
                    aria-label="Next Slide"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
                    {isArabic ? `شريحة ${activeSlideIndex + 1} من ${media.items.length}` : `Slide ${activeSlideIndex + 1} of ${media.items.length}`}
                  </div>
                </>
              )}
            </div>

            {/* Carousel Thumbnails */}
            {isCarousel && (
              <div className="mt-3 flex w-full gap-2 overflow-x-auto pb-1">
                {media.items.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSlideIndex(idx);
                    }}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                      activeSlideIndex === idx ? 'border-rose-500 scale-105 shadow-md' : 'border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={item.thumbnail} alt={`Slide ${idx + 1}`} className="h-full w-full object-cover" />
                    {item.type === 'video' && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 p-0.5 text-[9px] text-white">
                        ▶
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Multi-Quality Selector & Action Downloads */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div>
              {/* Engagement Stats & File Specs */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-slate-500">
                    <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                    <span>{isArabic ? 'الإعجابات' : 'Likes'}</span>
                  </div>
                  <div className="mt-1 font-bold text-slate-800">{media.likes}</div>
                </div>

                {media.views ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <div className="flex items-center justify-center gap-1 text-slate-500">
                      <Eye className="h-3.5 w-3.5 text-blue-500" />
                      <span>{isArabic ? 'المشاهدات' : 'Views'}</span>
                    </div>
                    <div className="mt-1 font-bold text-slate-800">{media.views}</div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <div className="flex items-center justify-center gap-1 text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span>{isArabic ? 'الوقت' : 'Time'}</span>
                    </div>
                    <div className="mt-1 font-bold text-slate-800 text-[11px] truncate">{media.timestamp}</div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span>{isArabic ? 'الحجم' : 'Size'}</span>
                  </div>
                  <div className="mt-1 font-bold text-slate-800">{selectedQuality.fileSize}</div>
                </div>
              </div>

              {/* Caption snippet */}
              {media.caption && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs text-slate-700 leading-relaxed max-h-20 overflow-y-auto">
                  <span className="font-semibold text-slate-900 mr-1">{isArabic ? 'الوصف:' : 'Caption:'}</span>
                  {media.caption}
                </div>
              )}

              {/* AUDIO TRACK EXTRACTION IF AVAILABLE */}
              {media.audioTrack && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-purple-200/80 bg-purple-50/60 p-3 text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
                      <Music className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-purple-950 truncate">{media.audioTrack.title}</div>
                      <div className="text-[11px] text-purple-700 truncate">{media.audioTrack.artist} • 320 kbps MP3</div>
                    </div>
                  </div>
                  <button
                    id="btn-download-audio-track"
                    onClick={handleDownloadAudio}
                    disabled={downloadingQualityId === 'audio'}
                    className="ml-2 shrink-0 flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isArabic ? 'تحميل MP3' : 'Audio MP3'}</span>
                  </button>
                </div>
              )}

              {/* === 1080p FULL HD QUALITY SPECS BADGE === */}
              <div className="mt-4 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50/70 via-purple-50/50 to-pink-50/70 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-rose-600 text-white shadow-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                      1080p FULL HD
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedQuality.label}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-rose-600 bg-white/90 px-2 py-0.5 rounded-md border border-rose-200/60">
                    {selectedQuality.fileSize}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600 bg-white/90 rounded-xl px-3 py-2 border border-slate-200/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <Video className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span className="font-medium truncate">
                      {selectedQuality.resolution} • {selectedQuality.bitrate || 'Ultra HD 60FPS'}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-500 uppercase shrink-0">
                    {currentItem.type === 'video' ? 'MP4 • H.264' : 'JPG • Original'}
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION DOWNLOAD BUTTONS */}
            <div className="space-y-2.5 pt-1">
              {/* PRIMARY 1080p DOWNLOAD BUTTON */}
              <button
                id="btn-primary-download-media"
                onClick={() => handleDownloadSpecificQuality(selectedQuality, activeSlideIndex)}
                disabled={downloadingQualityId !== null}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 py-3.5 px-6 text-sm sm:text-base font-bold text-white shadow-lg shadow-rose-500/25 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
              >
                {downloadingQualityId === selectedQuality.id ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{isArabic ? 'جاري التحميل بدقة 1080p...' : 'Downloading 1080p Full HD...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span>
                      {currentItem.type === 'video'
                        ? isArabic
                          ? `تحميل الفيديو بدقة 1080p Full HD (${selectedQuality.fileSize})`
                          : `Download Video • 1080p Full HD (${selectedQuality.fileSize})`
                        : isArabic
                        ? `تحميل الصورة بدقة 1080p Ultra HD (${selectedQuality.fileSize})`
                        : `Download Photo • 1080p Ultra HD (${selectedQuality.fileSize})`}
                    </span>
                  </>
                )}
              </button>

              {/* If carousel: Download all slides */}
              {isCarousel && (
                <button
                  id="btn-download-all-carousel"
                  onClick={async () => {
                    for (let i = 0; i < media.items.length; i++) {
                      const itemQualities = media.items[i].availableQualities || qualities;
                      const qToDownload = itemQualities[0] || selectedQuality;
                      await handleDownloadSpecificQuality(qToDownload, i);
                      await new Promise((r) => setTimeout(r, 450));
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>
                    {isArabic
                      ? `تحميل جميع الشرائح (${media.items.length} وسائط) بدقة 1080p`
                      : `Download All ${media.items.length} Slides in 1080p`}
                  </span>
                </button>
              )}

              {/* Utility actions: Copy link & view on IG */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  id="btn-copy-media-url"
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copiedLink ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                  <span>{copiedLink ? t.copied : t.copyLink}</span>
                </button>

                <a
                  href={media.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="View on Instagram"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Instagram</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
