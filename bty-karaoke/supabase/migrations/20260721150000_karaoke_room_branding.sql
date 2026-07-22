-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — ROOM BRANDING V1. Adds a Room's optional logo pointer + preset
-- visual theme. Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj).
-- Additive + idempotent; never regresses a prior migration.
--
-- Storage model: only the OPAQUE object key of the server-normalized 512×512 WebP is
-- stored (never a public URL, account id, email, filename, or the raw upload). The
-- object itself lives in the PRIVATE `room-logos` Storage bucket and is delivered
-- only through the controlled public proxy /api/public/rooms/{slug}/logo. `logo_version`
-- is a cache-busting token rotated on every upload so the versioned proxy URL is
-- immutable-cacheable. `branding_theme` is constrained to the exact allowlist so the
-- UI renders a server-controlled class, never raw CSS.
--
-- Default theme 'midnight_gold' == the current :root look, so existing Rooms
-- (bty-home) keep their exact appearance with no data change.
--
-- Rollback:
--   alter table public.karaoke_rooms drop column if exists logo_object_key;
--   alter table public.karaoke_rooms drop column if exists logo_version;
--   alter table public.karaoke_rooms drop column if exists branding_theme;

alter table public.karaoke_rooms
  add column if not exists logo_object_key text;

alter table public.karaoke_rooms
  add column if not exists logo_version text;

alter table public.karaoke_rooms
  add column if not exists branding_theme text not null default 'midnight_gold';

-- Constrain the theme to the exact supported allowlist (idempotent add).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'karaoke_rooms_branding_theme_chk'
  ) then
    alter table public.karaoke_rooms
      add constraint karaoke_rooms_branding_theme_chk
      check (branding_theme in ('midnight_gold', 'neon_night', 'warm_stage'));
  end if;
end $$;
