-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry PDF Study Rooms — V1  (Universal Room: adds the DOCUMENT content type)
--
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after). Idempotent +
-- replay-safe (add column if not exists, create ... if not exists, drop
-- constraint/policy if exists before re-add).
--
-- Scope: the SECOND Foundry room type. A Host turns ONE PDF into a shared study
-- event: employees scan and join by name WITHOUT a BTY account, read the
-- document in the BTY room, meet a deterministic reading-participation gate (all
-- pages visited AND a page-aware minimum active reading time), answer ONE
-- reflection question, and earn the SAME 10 Core XP through the SAME canonical
-- completion + XP + claim pipeline as YouTube training. No new event table, no
-- new participant table, no new completion table, no new XP ledger.
--
-- What this migration changes (extends the 20260714 Foundry Event Rooms schema):
--   1. foundry_events.content_type            — discriminator ('youtube'|'document'),
--                                                default 'youtube' (existing rows
--                                                keep YouTube behavior).
--   2. foundry_event_document_content         — NEW 1:1 content table for the
--                                                DOCUMENT type. YouTube keeps its
--                                                own foundry_event_training_content
--                                                (its NOT NULL/CHECK stay untouched).
--   3. foundry_event_training_progress.document_* columns — server-canonical
--                                                reading progress (reused progress
--                                                row → reused completion + XP path).
--   4. Relaxed completion CHECK — completion now requires a response AND
--                                  (video_completed_at OR document_read_completed_at).
--                                  YouTube path is preserved exactly.
--   5. Private Storage bucket 'foundry-docs' — service-role write + signed-URL
--                                  read only; default-deny for anon/authenticated.
--
-- Write path = service-role (route gate + owner/token verification). RLS exposes
-- only owner SELECT on the document content (defense-in-depth); anon has no
-- direct access. Reading progress stays default-deny (service-role only) exactly
-- like video progress. No XP, league, or leaderboard linkage is introduced here.
--
-- Rollback (drop in dependency order):
--   -- storage policies + bucket:
--   DROP POLICY IF EXISTS "Foundry docs: service manage" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'foundry-docs';
--   ALTER TABLE public.foundry_event_training_progress
--     DROP CONSTRAINT IF EXISTS foundry_training_progress_completed_needs_evidence_and_response_check;
--   ALTER TABLE public.foundry_event_training_progress
--     ADD CONSTRAINT foundry_training_progress_completed_needs_video_and_response_check
--     CHECK (completed_at is null or (video_completed_at is not null and response_text is not null
--            and char_length(btrim(response_text)) between 1 and 1000));
--   ALTER TABLE public.foundry_event_training_progress
--     DROP COLUMN IF EXISTS document_last_page,
--     DROP COLUMN IF EXISTS document_pages_viewed,
--     DROP COLUMN IF EXISTS document_active_read_ms,
--     DROP COLUMN IF EXISTS document_read_completed_at;
--   DROP TABLE IF EXISTS public.foundry_event_document_content;
--   ALTER TABLE public.foundry_events DROP COLUMN IF EXISTS content_type;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Content-type discriminator on the shared event row. Default 'youtube' so
--    every existing event keeps its current behavior with no backfill needed.
-- ---------------------------------------------------------------------------
alter table public.foundry_events
  add column if not exists content_type text not null default 'youtube';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'foundry_events_content_type_check'
  ) then
    alter table public.foundry_events
      add constraint foundry_events_content_type_check
      check (content_type in ('youtube', 'document'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. DOCUMENT content — ONE PDF + ONE reflection prompt per event (1:1, event_id
--    is the PK/FK, mirroring foundry_event_training_content). The storage path is
--    SERVER-OWNED (never a client-provided path). page_count is provided by the
--    Host's own client at creation (it gates only that Host's own participants —
--    not a security-critical value) and bounded here. min_read_seconds is the
--    deterministic reading-time gate, computed page-aware at creation.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_event_document_content (
  event_id uuid primary key references public.foundry_events (id) on delete cascade,
  -- Canonical document is source-agnostic: an uploaded PDF and a Google Drive
  -- import both normalize to ONE fixed PDF snapshot in private storage, read by
  -- the SAME reader / completion / XP. source_type records provenance only.
  source_type text not null default 'uploaded_pdf',
  original_file_id text,
  content_hash text,
  imported_at timestamptz not null default now(),
  storage_bucket text not null,
  storage_path text not null,
  file_name text,
  byte_size bigint,
  -- page_count is SERVER-derived/verified (never client-authoritative). Nullable
  -- because a compressed PDF's page count may be server-undeterminable; the gate
  -- then uses the best-effort value and page_count_verified records the fact.
  page_count int not null,
  page_count_verified boolean not null default false,
  min_read_seconds int not null,
  intro text,
  completion_prompt text not null,
  created_at timestamptz not null default now(),
  constraint foundry_document_content_source_type_check
    check (source_type in ('uploaded_pdf', 'google_drive')),
  constraint foundry_document_content_page_count_check
    check (page_count between 1 and 2000),
  constraint foundry_document_content_min_read_check
    check (min_read_seconds between 1 and 3600),
  constraint foundry_document_content_byte_size_check
    check (byte_size is null or byte_size between 1 and 26214400),
  constraint foundry_document_content_prompt_len_check
    check (char_length(btrim(completion_prompt)) between 1 and 300),
  constraint foundry_document_content_intro_len_check
    check (intro is null or char_length(btrim(intro)) between 1 and 600),
  -- Defense in depth: never store a public/absolute URL as a path.
  constraint foundry_document_content_path_len_check
    check (char_length(btrim(storage_path)) between 1 and 400)
);

revoke all on public.foundry_event_document_content from anon, public;
grant select on public.foundry_event_document_content to authenticated;

alter table public.foundry_event_document_content enable row level security;
drop policy if exists "foundry_document_content_select_owner" on public.foundry_event_document_content;
create policy "foundry_document_content_select_owner" on public.foundry_event_document_content
  for select to authenticated using (
    event_id in (
      select id from public.foundry_events where owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Reading progress on the REUSED progress row. All nullable/additive so every
--    existing YouTube progress row is unaffected. document_pages_viewed is the
--    canonical set of DISTINCT visited pages (jsonb int array) — the server
--    unions into it so repeated viewing of the same page never inflates the
--    count. document_active_read_ms is verified visible reading time (background
--    time excluded client-side, accumulated server-side). document_read_completed_at
--    is set once the deterministic gate (all pages + min time) is met.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_training_progress
  add column if not exists document_last_page int,
  add column if not exists document_pages_viewed jsonb not null default '[]'::jsonb,
  add column if not exists document_active_read_ms bigint not null default 0,
  add column if not exists document_read_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'foundry_training_progress_document_last_page_check'
  ) then
    alter table public.foundry_event_training_progress
      add constraint foundry_training_progress_document_last_page_check
      check (document_last_page is null or document_last_page between 1 and 2000);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'foundry_training_progress_document_active_read_ms_check'
  ) then
    alter table public.foundry_event_training_progress
      add constraint foundry_training_progress_document_active_read_ms_check
      check (document_active_read_ms >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Relax the completion gate to accept EITHER evidence path. The response is
--    still mandatory; only the "did the participant engage the content" evidence
--    now has two shapes. YouTube completion is preserved exactly (a YouTube
--    progress row has document_read_completed_at = null, so it still needs
--    video_completed_at). Existing completed rows already satisfy the new form.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_training_progress
  drop constraint if exists foundry_training_progress_completed_needs_video_and_response_check;
alter table public.foundry_event_training_progress
  drop constraint if exists foundry_training_progress_completed_needs_evidence_and_response_check;
alter table public.foundry_event_training_progress
  add constraint foundry_training_progress_completed_needs_evidence_and_response_check
  check (
    completed_at is null
    or (
      response_text is not null
      and char_length(btrim(response_text)) between 1 and 1000
      and (video_completed_at is not null or document_read_completed_at is not null)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Private PDF bucket. public=false => no anonymous read; NO client (anon/
--    authenticated) storage.objects policy is added for this bucket, so every
--    client role is default-denied. Upload is service-role (bypasses RLS) after
--    the manager gate; participant read is a short-lived SIGNED url minted
--    service-role after join verification. A single explicit service_role manage
--    policy documents the intent (service_role already bypasses RLS).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('foundry-docs', 'foundry-docs', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Foundry docs: service manage" on storage.objects;
create policy "Foundry docs: service manage"
on storage.objects for all to service_role
using (bucket_id = 'foundry-docs')
with check (bucket_id = 'foundry-docs');
