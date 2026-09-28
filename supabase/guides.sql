-- =============================================================
-- IGSAVEGO · Blog / Guides engine · Supabase schema
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query
-- Long-tail articles (e.g. "download reels on iPhone") rendered
-- under /blog/{slug} with Article + FAQ schemas.
-- =============================================================

create table if not exists public.guide_articles (
  id text primary key,
  slug text not null unique,
  lang text not null default 'en' check (lang in ('en','es','fr','ar','pt','de','id','tr')),
  keyword text not null default '',
  tool text not null default 'video' check (tool in ('video','photo','reels','story','highlights')),
  title text not null default '',
  meta_description text not null default '',
  h1 text not null default '',
  excerpt text not null default '',
  sections jsonb not null default '[]',
  faqs jsonb not null default '[]',
  related_slugs text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guide_articles_slug_idx on public.guide_articles (slug);
create index if not exists guide_articles_lang_idx on public.guide_articles (lang);

alter table public.guide_articles enable row level security;

drop policy if exists "public read enabled guides" on public.guide_articles;
create policy "public read enabled guides"
  on public.guide_articles for select
  to anon, authenticated
  using (enabled = true);
