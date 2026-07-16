-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Guided Module Builder — Draft Assets V1 (Slice 2.1.2)
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after; verify against
-- information_schema). Idempotent + replay-safe (create ... if not exists;
-- add-constraint guarded by pg_constraint existence checks).
--
-- WHY (measured root cause): Slice 2.1.1 stored the whole PDF reference as a JSON
-- string in foundry_module_drafts.document_asset_ref, whose CHECK bounds it to
-- 1..200 chars. A real reference serializes to ~340 chars (307 even with a
-- 1-char filename: a 64-char content hash + a 77-char owner/uuid path + an ISO
-- timestamp already exceed 200), so EVERY attach violated the CHECK after the
-- object uploaded — the object was then compensating-deleted and the client saw a
-- generic "Couldn't upload". No draft ever persisted a reference (0 legacy rows),
-- so NO backfill is needed and no orphan objects were left.
--
-- FIX: a dedicated additive table holds one row per stored draft asset, so the
-- reference is never length-bounded into a single column, and a draft can carry
-- MULTIPLE assets (documents + screenshots). The bounded document_asset_ref
-- column is LEFT IN PLACE (not dropped/rewritten) for compatibility; it is simply
-- no longer the canonical location for new assets.
--
-- Scope (additive only — touches NOTHING in the event/participant/progress/XP
-- spine, and does not modify foundry_module_drafts):
--   1. foundry_module_draft_assets — one row per privately-stored draft asset.
--
-- Authorization: CLIENT-DENY. RLS on, NO client policy, NO grant to anon/
-- authenticated -> fully default-deny (matches foundry_module_drafts). Only the
-- service-role client touches it, always after requireManager confirms the draft
-- (draft id + authenticated owner) and then scopes assets by that draft id — so
-- no redundant owner column is needed. Storage stays in the existing PRIVATE
-- 'foundry-docs' bucket; no bucket change, no public object, no path exposed.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.foundry_module_draft_assets;
-- =============================================================================

create table if not exists public.foundry_module_draft_assets (
  id uuid primary key default gen_random_uuid(),
  -- Ownership derives through the draft (draft_id -> foundry_module_drafts
  -- -> owner_user_id); no redundant owner column. Every service op resolves the
  -- draft with (draft id + authenticated owner) FIRST, then scopes assets to that
  -- confirmed draft id.
  draft_id uuid not null references public.foundry_module_drafts (id) on delete cascade,
  original_filename text not null,
  normalized_extension text not null,
  mime_type text not null,
  -- Coarse category for UI + delivery-readiness (NOT participant-render proof).
  file_kind text not null,
  byte_size bigint not null,
  -- Server-owned private storage location (never exposed to the client).
  storage_bucket text not null,
  storage_path text not null,
  content_hash text not null,
  -- Optional, kind-specific metadata (documents: pages; images: dimensions).
  page_count integer,
  page_count_verified boolean not null default false,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  constraint foundry_draft_assets_file_kind_check
    check (file_kind in ('pdf', 'document', 'spreadsheet', 'presentation', 'text', 'image')),
  constraint foundry_draft_assets_filename_len_check
    check (char_length(btrim(original_filename)) between 1 and 260),
  constraint foundry_draft_assets_extension_len_check
    check (char_length(btrim(normalized_extension)) between 1 and 12),
  constraint foundry_draft_assets_mime_len_check
    check (char_length(btrim(mime_type)) between 1 and 160),
  -- 25 MB per file (matches the existing FOUNDRY_DOC_MAX_BYTES allowance).
  constraint foundry_draft_assets_byte_size_check
    check (byte_size between 1 and 26214400),
  -- Defense in depth: never store a public/absolute URL as a path.
  constraint foundry_draft_assets_path_len_check
    check (char_length(btrim(storage_path)) between 1 and 400),
  constraint foundry_draft_assets_content_hash_len_check
    check (char_length(btrim(content_hash)) between 1 and 128),
  constraint foundry_draft_assets_page_count_check
    check (page_count is null or page_count between 1 and 10000),
  constraint foundry_draft_assets_width_check
    check (width is null or width between 1 and 100000),
  constraint foundry_draft_assets_height_check
    check (height is null or height between 1 and 100000),
  -- One asset row per stored object (defense in depth against a double-insert).
  constraint foundry_draft_assets_storage_path_unique unique (storage_path)
);

-- Hot path: list a draft's assets oldest-first (attachment order).
create index if not exists foundry_module_draft_assets_draft_created_idx
  on public.foundry_module_draft_assets (draft_id, created_at);

-- Client-deny: RLS on, no policy, no anon/authenticated grant -> service-role only.
revoke all on public.foundry_module_draft_assets from anon, public, authenticated;
alter table public.foundry_module_draft_assets enable row level security;
