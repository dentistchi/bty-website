-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — ROOM SETTINGS V1. Adds the ONE new field this slice needs: an
-- optional guest-facing welcome message on the Room. The display name is the
-- existing `karaoke_rooms.display_name` (unchanged, still the single source of
-- truth) and the slug stays immutable. Isolated bty-karaoke Supabase project (ref
-- zycwaqignioawtqynopj). Additive + idempotent; never regresses a prior migration.
--
-- Why a column on karaoke_rooms (not a new table): it is a single optional scalar
-- owned 1:1 by the Room, read on the same Room lookup the guest/admin already do.
-- A side table would add a join for zero benefit. NOT copied into workspace,
-- ownership, Event, or any client store — the Room row is the canonical home.
--
-- Deliberately NOT added: logo/image storage, theme colors, slug mutation, Event
-- settings, or any Event/queue linkage. Updating this field writes ONLY this Room
-- row and never touches Events.
--
-- Rollback:
--   alter table public.karaoke_rooms drop column if exists guest_welcome_message;

alter table public.karaoke_rooms
  add column if not exists guest_welcome_message text
    check (guest_welcome_message is null or char_length(guest_welcome_message) <= 160);
