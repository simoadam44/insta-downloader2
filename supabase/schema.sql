-- =============================================================
-- SSSInstagram · Keywords & Tools Engine · Supabase schema
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query
-- =============================================================

create table if not exists public.keyword_pages (
  id text primary key,
  slug text not null unique,
  badge text not null default '',
  target_keyword text not null default '',
  lang text not null default 'en' check (lang in ('en','es','fr','ar','pt','de','id','tr')),
  tool text not null default 'video' check (tool in ('video','photo','reels','story','highlights')),
  title text not null default '',
  meta_description text not null default '',
  h1 text not null default '',
  subtitle text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists keyword_pages_slug_idx on public.keyword_pages (slug);
create index if not exists keyword_pages_enabled_idx on public.keyword_pages (enabled);

-- Auto-update updated_at on every change
create or replace function public.touch_keyword_pages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_keyword_pages on public.keyword_pages;
create trigger trg_touch_keyword_pages
  before update on public.keyword_pages
  for each row execute function public.touch_keyword_pages_updated_at();

-- Row Level Security:
-- · Public (anon key) can READ only enabled pages.
-- · All writes go through our backend API using the SERVICE ROLE key
--   (service role bypasses RLS), so no write policies are needed.
alter table public.keyword_pages enable row level security;

drop policy if exists "public read enabled keyword pages" on public.keyword_pages;
create policy "public read enabled keyword pages"
  on public.keyword_pages for select
  to anon, authenticated
  using (enabled = true);

-- =============================================================
-- Seed: the 8 default landing pages (EN + AR)
-- =============================================================
insert into public.keyword_pages
  (id, slug, badge, target_keyword, lang, tool, title, meta_description, h1, subtitle, enabled)
values
  ('kw-en-video-downloader','instagram-video-downloader','VIDEO DOWNLOADER','Instagram Video Downloader','en','video',
   'Instagram Video Downloader - Download IG Videos in HD Free',
   'Instagram Video Downloader: download Instagram videos in 1080p MP4 for free. Fast, anonymous, no watermark, no login. Save any public IG video online.',
   'Instagram Video Downloader',
   'Download any Instagram video in Full HD MP4 quality online - free, fast and without watermark.',
   true),
  ('kw-en-reels','download-instagram-reels','REELS SAVER','Download Instagram Reels','en','reels',
   'Download Instagram Reels - Save Reels Videos in HD Online Free',
   'Download Instagram Reels in HD quality free. Save Reels videos to your phone or PC in MP4 without watermark. No app or login required.',
   'Download Instagram Reels',
   'Save Instagram Reels videos in HD MP4 - download viral reels free with no watermark.',
   true),
  ('kw-en-save-insta','save-insta-video','INSTA SAVER','Save Insta Video','en','video',
   'Save Insta Video - Free Instagram Video Saver Online (HD)',
   'Save Insta videos online free in 1080p HD. The fastest Insta video saver - paste the link and download any public Instagram video instantly.',
   'Save Insta Video',
   'The easiest way to save Insta videos - paste the link and download in HD instantly.',
   true),
  ('kw-en-ig-downloader','ig-downloader','IG TOOL','IG Downloader','en','video',
   'IG Downloader - Download Instagram Videos, Reels & Photos Free',
   'IG Downloader: free online tool to download Instagram videos, reels and photos in high quality. Anonymous, unlimited, no watermark.',
   'IG Downloader',
   'Free IG downloader for videos, reels and photos - HD quality, no login needed.',
   true),
  ('kw-ar-tahmil-video','تحميل-فيديو-من-انستقرام','تحميل فيديو','تحميل فيديو من انستقرام','ar','video',
   'تحميل فيديو من انستقرام - تنزيل فيديوهات انستا بجودة عالية مجانا',
   'تحميل فيديو من انستقرام بجودة 1080p MP4 مجانا وبدون علامة مائية. أداة سريعة ومجهولة لحفظ أي فيديو عام من انستقرام بدون تسجيل دخول.',
   'تحميل فيديو من انستقرام',
   'حمّل أي فيديو انستقرام بجودة Full HD مجانا - سريع، مجهول وبدون علامة مائية.',
   true),
  ('kw-ar-reels','موقع-تحميل-ريلز-انستقرام','تحميل ريلز','موقع تحميل ريلز انستقرام','ar','reels',
   'موقع تحميل ريلز انستقرام - حفظ مقاطع الريلز HD مجانا',
   'موقع تحميل ريلز انستقرام: احفظ مقاطع الريلز بجودة عالية MP4 بدون علامة مائية. مجاني، سريع ولا يحتاج تطبيق أو حساب.',
   'موقع تحميل ريلز انستقرام',
   'احفظ ريلز انستقرام بجودة HD على هاتفك أو حاسوبك مجانا وبدون علامة مائية.',
   true),
  ('kw-ar-hifz','حفظ-فيديو-انستقرام','حفظ فيديو','حفظ فيديو انستقرام','ar','video',
   'حفظ فيديو انستقرام - أداة حفظ فيديوهات انستا أونلاين مجانا',
   'حفظ فيديو انستقرام أونلاين بجودة 1080p. الصق الرابط وحمّل أي فيديو عام من انستقرام فورا - مجاني وغير محدود.',
   'حفظ فيديو انستقرام',
   'أسهل طريقة لحفظ فيديو انستقرام - الصق الرابط وحمّله بجودة عالية فورا.',
   true),
  ('kw-ar-tanzil','تنزيل-مقاطع-انستقرام','تنزيل مقاطع','تنزيل مقاطع انستقرام','ar','video',
   'تنزيل مقاطع انستقرام - حمّل مقاطع انستا MP4 بجودة عالية',
   'تنزيل مقاطع انستقرام مجانا بجودة عالية MP4. حمّل المقاطع والفيديوهات العامة بدون تسجيل دخول وبدون حدود يومية.',
   'تنزيل مقاطع انستقرام',
   'نزّل مقاطع انستقرام المفضلة لديك بجودة عالية - مجاني، سريع وبدون حدود.',
   true)
on conflict (id) do nothing;
