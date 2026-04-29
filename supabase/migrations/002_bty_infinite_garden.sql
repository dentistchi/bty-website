-- The Infinite Garden: season, bounce_back_count
-- Run in Supabase SQL Editor (after 001_bty_journey.sql)

alter table bty_profiles add column if not exists season int not null default 1;
alter table bty_profiles add column if not exists bounce_back_count int not null default 0;
