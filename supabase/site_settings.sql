-- =============================================================
-- IGSAVEGO · Shared Dashboard Settings · Supabase schema
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query
-- Purpose: persist ALL admin dashboard settings server-side so they
-- are identical in every browser / private window / device.
-- (Fixes GA4 + branding + ads + api settings vanishing in new browsers,
--  which previously lived in localStorage only.)
-- Single-row table: id = 'global'.
-- =============================================================

create table if not exists public.site_settings (
  id text primary key default 'global',
  branding jsonb not null default '{}',
  seo_tracking jsonb not null default '{}',
  ads jsonb not null default '{}',
  api jsonb not null default '{}',
  seo_overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure the singleton row exists (empty = fall back to app defaults).
insert into public.site_settings (id)
values ('global')
on conflict (id) do nothing;

-- Auto-update updated_at on every change
create or replace function public.touch_site_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_site_settings on public.site_settings;
create trigger trg_touch_site_settings
  before update on public.site_settings
  for each row execute function public.touch_site_settings_updated_at();

-- Row Level Security:
-- · Public (anon key) can READ the singleton row (visitors need GA4 /
--   branding / ads to render identically for everyone).
-- · All writes go through our backend API using the SERVICE ROLE key
--   (service role bypasses RLS), so no write policies are needed.
alter table public.site_settings enable row level security;

drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (id = 'global');
