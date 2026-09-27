export type MediaType = 'video' | 'photo' | 'reels' | 'story' | 'highlights';

export type LanguageCode = 'en' | 'es' | 'fr' | 'ar' | 'pt' | 'de' | 'id' | 'tr';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export interface QualityOption {
  id: string;
  label: string;
  quality: '1080p' | 'original' | 'audio';
  resolution: string;
  fileSize: string;
  downloadUrl: string;
  format: 'mp4' | 'jpg' | 'mp3';
  isHd?: boolean;
  isFullHd?: boolean;
  fps?: number;
  bitrate?: string;
}

export interface ExtractedMediaItem {
  id: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail: string;
  downloadUrl: string;
  quality: string;
  dimensions: string;
  fileSize: string;
  format: 'mp4' | 'jpg';
  availableQualities?: QualityOption[];
}

export interface ExtractedMedia {
  id: string;
  mediaType: MediaType;
  originalUrl: string;
  author: {
    username: string;
    fullName: string;
    avatar: string;
    isVerified: boolean;
    followers?: string;
  };
  caption: string;
  timestamp: string;
  likes: string;
  comments?: string;
  views?: string;
  duration?: string;
  // Optional backend notice (e.g. "Instagram exposed no video stream…").
  note?: string;
  items: ExtractedMediaItem[];
  audioTrack?: {
    title: string;
    artist: string;
    audioUrl: string;
  };
}

export interface ExtractionErrorDetails {
  stage: number; // 1: URL Parse, 2: Server Connect, 3: Media Stream Extract, 4: Stream Packaging
  stageName: string;
  stageTitle: string;
  error: string;
  details?: string;
  shortcode?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolSeoContent {
  title: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  badge: string;
  canonicalPath: string;
  features: {
    title: string;
    description: string;
    icon: string;
  }[];
  steps: {
    step: number;
    title: string;
    description: string;
  }[];
  faqs: FaqItem[];
}

export interface SiteBrandingSettings {
  siteName: string;
  siteTagline: string;
  logoType: 'default' | 'image' | 'text';
  customLogoUrl: string;
  faviconUrl: string;
  accentColor: string;
  contactEmail: string;
  copyrightText: string;
}

export interface SeoTrackingSettings {
  googleAnalyticsId: string;
  googleSearchConsoleCode: string;
  bingWebmasterCode: string;
  facebookPixelId: string;
  customHeadCode: string;
  customBodyCode: string;
  enableRobotsIndex: boolean;
  canonicalBaseUrl: string;
}

export interface AdSlotConfig {
  enabled: boolean;
  type: 'banner' | 'native' | 'script' | 'adsense';
  title: string;
  adClient: string;
  adSlot: string;
  customHtml?: string;
}

export interface AdSettings {
  autoAdsEnabled: boolean;
  autoAdsClientId: string;
  headerBanner: AdSlotConfig;
  belowInput: AdSlotConfig;
  aboveResult: AdSlotConfig;
  inContentBanner: AdSlotConfig;
  footerBanner: AdSlotConfig;
  stickyFooterBanner: AdSlotConfig;
  customPopunderCode?: string;
}

export interface ApiSettings {
  primaryEndpoint: string;
  backupEndpoint: string;
  rapidApiKey: string;
  timeoutMs: number;
  rateLimitPerMin: number;
  enableRotatingProxies: boolean;
  proxyPool: string[];
}

export interface LiveRequestLog {
  id: string;
  timestamp: string;
  url: string;
  mediaType: MediaType;
  status: 200 | 400 | 404 | 500;
  durationMs: number;
  country: string;
  countryCode: string;
}

// Programmatic-SEO keyword landing page (Keywords & Tools Engine).
// Each page targets one high-intent keyword (e.g. "Download Instagram Reels")
// and renders the downloader tool with unique SEO content under /{slug}.
export interface KeywordToolPage {
  id: string;
  slug: string;
  badge: string;
  targetKeyword: string;
  lang: LanguageCode;
  tool: MediaType;
  title: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  enabled: boolean;
}

export interface ServerSystemInfo {
  uptimeSeconds: number;
  memoryHeapUsedMB: number;
  memoryRssMB: number;
  nodeVersion: string;
  platform: string;
  environment: string;
  status: string;
}

export interface AdminStats {
  totalDownloads: number;
  totalExtractions?: number;
  todayRequests: number;
  successRate: number;
  avgLatencyMs: number;
  bandwidthProcessedMB?: number;
  bandwidthProcessedGB: number;
  cacheHitRatio: number;
  activeProxies: number;
  recentLogs?: LiveRequestLog[];
  system?: ServerSystemInfo;
}
