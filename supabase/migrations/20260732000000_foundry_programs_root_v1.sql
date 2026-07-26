-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2C — Minimal Program Root + Lineage Extension V1
-- ============================================================================
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate authorized step (snapshot before/after; verify against
-- information_schema). Idempotent + replay-safe (create ... if not exists;
-- add-column IF NOT EXISTS; drop ... if exists in rollback).
--
-- Canonical contract: docs/UNIFIED_PROGRAM_LIVE_EXPERIENCE_CONTRACT.md (outer
-- commit f0acbfc6). This migration introduces EXACTLY ONE additive canonical
-- Program identity root and connects it to the existing Foundry authoring
-- (foundry_module_drafts) and runtime (foundry_events) objects via NULLABLE
-- lineage references. It does NOT create Live Experience / Experience Run /
-- Activity / Checkpoint, does NOT touch assignments / participants / audience /
-- completion / QR / XP / Practice / Field Action / Follow-up, does NOT rename any
-- table, and performs NO historical backfill.
--
-- SCOPE (additive only):
--   1. foundry_programs — the durable, org-scoped Program IDENTITY root. Owns
--      identity only (org, owner, title, lifecycle). It owns NO assignments, NO
--      participants, NO completion, NO XP, NO QR — those stay on the Program Run
--      (foundry_events), per Founder decision 1.
--   2. foundry_module_drafts.program_id — nullable lineage: which durable Program
--      a Guided authoring draft/version belongs to. A revision inherits it.
--   3. foundry_events.program_id — nullable lineage: which durable Program a
--      published run (Guided or Quick) belongs to.
--   4. bty_foundry_resolve_or_create_program(...) — a SECURITY DEFINER,
--      service-role-only RPC that create-or-resolves a Program in the ACTOR's OWN
--      organization (org derived from the actor's active-primary membership,
--      never trusted from the caller). BEST-EFFORT: if the actor has no resolvable
--      org it returns a NULL program_id (the create path proceeds WITHOUT linkage
--      — exactly today's behavior), because Foundry Host is a GLOBAL capability
--      and a Host is not necessarily an org member. Legacy / non-member-authored
--      rows therefore keep program_id NULL = "LEGACY UNIFIED-LINEAGE NOT
--      RECORDED"; they remain fully playable and visible.
--
-- ORGANIZATION ISOLATION: organization_id uses the CANONICAL bty_organizations /
-- bty_org_memberships identity — NEVER the legacy `memberships` table. A caller
-- can neither supply an org nor link to a foreign-org Program: the RPC derives org
-- from the actor and rejects a supplied program_id whose org differs
-- (cross_organization). No global Program discovery is introduced; program_catalog
-- is untouched.
--
-- IDEMPOTENCY: the RPC is create-or-resolve by EXPLICIT program_id only. It does
-- NOT dedup by title (title similarity must never merge identities). A retry that
-- passes an existing p_program_id resolves that same row; a retry with no
-- p_program_id is a new canonical creation and yields a new Program (callers that
-- need publish idempotency continue to rely on the existing
-- foundry_event_module.source_draft_id UNIQUE boundary — unchanged here).
--
-- ROLLBACK (manual, if ever needed):
--   drop function if exists public.bty_foundry_resolve_or_create_program(uuid, text, uuid);
--   alter table public.foundry_events drop column if exists program_id;
--   alter table public.foundry_module_drafts drop column if exists program_id;
--   drop table if exists public.foundry_programs;
-- Every existing Foundry table, draft, event, participant, assignment, and
-- behavior is unchanged by this migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. foundry_programs — durable, org-scoped Program identity root.
--    Durability mirrors the 3.1A-3 pattern: a live convenience FK to the owner
--    (SET NULL on offboarding) PLUS an immutable owner snapshot, so a Program is
--    never orphaned and its origin is never lost. organization_id is NOT NULL and
--    ON DELETE RESTRICT (a Program cannot outlive its org silently).
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.bty_organizations (id) on delete restrict,
  -- Live convenience FK (nullable, SET NULL) + immutable value snapshot.
  owner_user_id uuid null references auth.users (id) on delete set null,
  owner_user_id_snapshot uuid not null,
  title text not null,
  -- Lifecycle sufficient for active/retired behavior. Retirement never rewrites
  -- historical events (their program_id snapshot stays); it only hides the Program
  -- from future authoring lists.
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_programs_status_check
    check (status in ('active', 'retired')),
  constraint foundry_programs_title_len_check
    check (char_length(btrim(title)) between 1 and 120)
);

create index if not exists foundry_programs_org_created_idx
  on public.foundry_programs (organization_id, created_at desc);
create index if not exists foundry_programs_owner_snapshot_idx
  on public.foundry_programs (owner_user_id_snapshot);

-- Default-deny for every client role; all access is service-role only (matches
-- foundry_module_drafts / foundry_event_module — the strictest Foundry tier).
revoke all on public.foundry_programs from anon, public, authenticated;
alter table public.foundry_programs enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Nullable Program lineage on the existing authoring draft. A revision copies
--    the parent's program_id (service layer); the column stays NULL for legacy
--    drafts and for drafts authored by a Host with no resolvable org. SET NULL on
--    Program delete so a lineage reference never blocks Program removal.
-- ---------------------------------------------------------------------------
alter table public.foundry_module_drafts
  add column if not exists program_id uuid null
    references public.foundry_programs (id) on delete set null;

create index if not exists foundry_module_drafts_program_idx
  on public.foundry_module_drafts (program_id)
  where program_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Nullable Program lineage on the runtime Program Run. Publish copies the
--    draft's program_id (Guided) or the quick-resolved program_id (Quick). NULL =
--    legacy / non-member-authored run — still fully playable.
-- ---------------------------------------------------------------------------
alter table public.foundry_events
  add column if not exists program_id uuid null
    references public.foundry_programs (id) on delete set null;

create index if not exists foundry_events_program_idx
  on public.foundry_events (program_id)
  where program_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Create-or-resolve RPC. SECURITY DEFINER, service-role only. Org is DERIVED
--    from the actor's active-primary bty_org_membership — never trusted from the
--    caller. BEST-EFFORT: no org -> NULL program_id (caller proceeds unlinked).
--
--    * p_program_id NULL  -> create a NEW Program in the actor's org (or NULL if
--      the actor has no org).
--    * p_program_id given -> RESOLVE it: it must exist AND belong to the actor's
--      org, else raise (program_missing / cross_organization). Used when a Guided
--      revision or publish threads an already-created Program id, so linkage can
--      never cross organizations.
--
--    Title is used only for a new row's display identity; it NEVER dedups /
--    merges identities.
-- ---------------------------------------------------------------------------
create or replace function public.bty_foundry_resolve_or_create_program(
  p_actor_user_id uuid,
  p_title text,
  p_program_id uuid default null
)
returns table (program_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_prog_org uuid;
  v_new uuid;
  v_title text;
begin
  -- Derive org from the actor's OWN active-primary membership (canonical table).
  -- Best-effort: absence is NOT an error — it means "no Program linkage".
  select om.organization_id into v_org
    from public.bty_org_memberships om
   where om.user_id = p_actor_user_id and om.status = 'active' and om.is_primary = true;

  -- Resolve an explicitly-supplied Program: must exist and be SAME-ORG.
  if p_program_id is not null then
    select fp.organization_id into v_prog_org
      from public.foundry_programs fp
     where fp.id = p_program_id;
    if not found then
      raise exception 'program_missing' using errcode = 'P0002';
    end if;
    -- If the actor has no org, they cannot own/resolve any Program.
    if v_org is null or v_prog_org is distinct from v_org then
      raise exception 'cross_organization' using errcode = 'P0001';
    end if;
    program_id := p_program_id;
    return next;
    return;
  end if;

  -- No org -> best-effort NULL (create path proceeds WITHOUT linkage).
  if v_org is null then
    program_id := null;
    return next;
    return;
  end if;

  -- Create a NEW Program identity in the actor's org. Title bounded/trimmed to
  -- the table CHECK; never used to dedup.
  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' then
    v_title := 'Untitled Program';
  end if;
  if char_length(v_title) > 120 then
    v_title := left(v_title, 120);
  end if;

  insert into public.foundry_programs (organization_id, owner_user_id, owner_user_id_snapshot, title)
  values (v_org, p_actor_user_id, p_actor_user_id, v_title)
  returning id into v_new;

  program_id := v_new;
  return next;
end;
$$;

revoke execute on function public.bty_foundry_resolve_or_create_program(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.bty_foundry_resolve_or_create_program(uuid, text, uuid)
  to service_role;

-- ============================================================================
-- END Slice 3.2C. Additive, reversible in principle, no historical mutation.
-- ============================================================================
