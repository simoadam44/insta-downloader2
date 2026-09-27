-- =============================================================
-- IGSAVEGO rebrand: SSSInstagram -> IGSaveGo in keyword landing pages
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (plain string replacement, no-ops when absent).
-- =============================================================

update public.keyword_pages
set
  title = replace(title, 'SSSInstagram', 'IGSaveGo'),
  meta_description = replace(meta_description, 'SSSInstagram', 'IGSaveGo'),
  h1 = replace(h1, 'SSSInstagram', 'IGSaveGo'),
  subtitle = replace(subtitle, 'SSSInstagram', 'IGSaveGo'),
  badge = replace(badge, 'SSSInstagram', 'IGSaveGo'),
  target_keyword = replace(target_keyword, 'SSSInstagram', 'IGSaveGo');

update public.keyword_pages
set
  title = replace(title, 'sssinstagram.app', 'igsavego.com'),
  meta_description = replace(meta_description, 'sssinstagram.app', 'igsavego.com'),
  subtitle = replace(subtitle, 'sssinstagram.app', 'igsavego.com');

-- Verify:
-- select id, slug, title from public.keyword_pages;
