-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SLICE R1B-C — PRE-ACTION CAPTURE OBJECT (bty_action_captures) V1.
-- ADDITIVE ONLY. No existing table, column, constraint, function or grant is
-- altered. `bty_action_contracts` is referenced as an FK target and is NOT
-- modified in any way by this migration.
-- ===========================================================================
--
-- WHAT THIS IS. A place for something the user chose not to lose, BEFORE they
-- have decided to do anything about it. "Save to BTY" from an external surface
-- (Microsoft Teams first) lands here and nowhere else.
--
-- WHY IT IS NOT AN ACTION CONTRACT, MEASURED RATHER THAN ASSERTED.
-- `bty_action_contracts` was measured on live (PostgreSQL 17.6, 2026-08-28)
-- before this file was written. It carries five NOT NULL columns with no
-- default, and every one of them asserts a commitment the user has not made
-- at capture time:
--
--     chosen_at           -- literally the moment of choosing
--     deadline_at         -- a promise has a WHEN
--     verification_type   -- a promise has a PROOF METHOD
--     le_activation_type  -- CHECK (micro_win | reset): a leadership activation
--     weight              -- CHECK (weight > 0): it COUNTS for something
--
-- Storing a raw capture there requires fabricating all five, and the
-- fabrication is not cosmetic. It was measured to produce real side effects:
--   * `fetchBlockingArenaContractForSession` selects status IN (pending,
--     submitted, rejected, escalated) AND deadline_at > now() with NO
--     action_type filter, so a fabricated deadline BLOCKS Arena progression
--     (409 on GET /api/arena/session/next).
--   * The Host review queue selects status='submitted' AND verification_mode
--     IN ('hybrid','link') with NO action_type filter, so a fabricated
--     verification_mode can surface a private capture to a reviewer.
-- The schema was correctly refusing to hold a non-promise. This table is the
-- object that was missing.
--
-- WHAT IT IS NOT, AND WHAT ENFORCES THAT:
--   * NOT a task. There is no due date, no priority, no expires_at and no
--     overdue state. A capture cannot become late, because being late is a
--     judgement about a promise and no promise has been made.
--   * NOT evidence. Creating, viewing, promoting or dismissing a capture
--     establishes NOTHING on the behaviour ladder. It records that the user
--     did not want to lose something, never that they did anything.
--   * NOT XP-bearing. No weight, no ledger, no activation type.
--   * NOT Arena or Foundry state. No run, no scenario, no pattern_family, no
--     event, no progress, no follow-up.
--   * NOT shared. No organization_id, no reviewer, no host visibility. A
--     capture is private to the person who made it, and V1 has no path by
--     which anyone else can read one.
--
-- PROMOTION IS RETAINED + LINKED, NEVER AUTOMATIC. There is deliberately no
-- trigger here. Nothing in this file can create a `bty_action_contracts` row,
-- and nothing here changes `status` when a contract is deleted. Promotion is a
-- later, explicit, TRANSACTIONAL application operation that will: create the
-- contract, set status='promoted', set promoted_at=now(), set
-- `promoted_action_contract_id`, and copy the immutable source provenance into
-- `bty_action_contracts.details.source` so "Open in Teams" survives on the
-- contract without needing to join back to this table.
--
-- HISTORY != POINTER. Promotion history and the currently-existing contract are
-- DIFFERENT FACTS and are stored in different columns. `promoted_at` records
-- that promotion happened and is historical truth; `promoted_action_contract_id`
-- points at the contract that still exists and may legitimately become NULL. A
-- capture that was promoted stays promoted even after its contract is deleted —
-- the history is not rewritten by a later deletion.
--
-- IDENTITY. `user_id` is the server-derived `auth.users.id`. `external_key` is
-- the SERVER-CANONICALIZED external identity (for Teams, conceptually
-- `<tenant_id>:<conversation_id>:<message_id>`); the client never supplies an
-- identity that is trusted. Deduplication is enforced by the DATABASE via
-- UNIQUE (user_id, source_type, external_key) — never by application-only
-- checks. This is a deliberate correction: the Field Action producer's comment
-- claims idempotency from "UNIQUE(user_id, session_id)", a constraint that was
-- measured NOT TO EXIST on live; it works only because it happens to set
-- `action_id` identically. This table does not repeat that mistake.
--
-- ROLLBACK:
--   drop table if exists public.bty_action_captures;
-- ===========================================================================

create table if not exists public.bty_action_captures (
  id uuid primary key default gen_random_uuid(),

  -- Owner. Server-derived; a deleted account takes its private captures with it.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- WHERE it came from, and its canonical identity THERE. Server-canonicalized.
  source_type text not null,
  external_key text not null,

  -- Enough to recognise the thing again. Nullable: a capture whose preview or
  -- permalink could not be resolved is still a capture, and an absent value is
  -- never invented.
  preview_text text,
  source_url text,

  -- Immutable source provenance envelope (tenant/conversation/message ids,
  -- sender display, captured-at as reported by the source, etc). Defaults to an
  -- empty object so a reader never has to distinguish null from absent.
  source_metadata jsonb not null default '{}'::jsonb,

  -- The ONLY lifecycle. Three states, no fourth, and none of them is "late".
  status text not null default 'captured',

  captured_at timestamptz not null default now(),

  -- HISTORY. That an explicit promotion happened, and when. Survives deletion
  -- of the promoted contract, because the promotion still happened.
  promoted_at timestamptz,

  -- POINTER. The promoted contract that CURRENTLY exists. ON DELETE SET NULL
  -- mirrors the apply-window rule: a deleted contract must never cascade-delete
  -- the user's own capture record. Going NULL means "that contract is gone",
  -- never "promotion never occurred" — that is what promoted_at is for.
  promoted_action_contract_id uuid
    references public.bty_action_contracts (id) on delete set null,

  constraint bty_action_captures_status_check
    check (status in ('captured', 'promoted', 'dismissed')),

  constraint bty_action_captures_user_source_key_unique
    unique (user_id, source_type, external_key),

  -- HISTORY != POINTER. Promotion history is the biconditional; the pointer only
  -- implies it. Binding the biconditional to the FK column instead was measured
  -- on PostgreSQL 17 and REFUSED THE CONTRACT DELETION OUTRIGHT: ON DELETE SET
  -- NULL drove a promoted row to a NULL pointer, violating the check, so the
  -- parent DELETE aborted. Three real code paths delete contracts
  -- (api/dev/reset-arena-state, e2e-three-contract-users.service,
  -- api/test/cleanup-action-contracts), so that shape was unshippable.
  constraint bty_action_captures_promotion_history_check
    check ((status = 'promoted') = (promoted_at is not null)),

  constraint bty_action_captures_promoted_pointer_check
    check (promoted_action_contract_id is null or status = 'promoted')
);

-- One capture -> one promoted contract. Partial so the many un-promoted rows
-- (NULL) are not indexed at all; mirrors the existing
-- `bty_action_contracts_user_family_open_unique` partial-unique precedent.
create unique index if not exists bty_action_captures_promoted_contract_unique
  on public.bty_action_captures (promoted_action_contract_id)
  where promoted_action_contract_id is not null;

-- The only read path V1 needs: a user's own inbox, newest first.
create index if not exists bty_action_captures_user_status_captured_idx
  on public.bty_action_captures (user_id, status, captured_at desc);

comment on table public.bty_action_captures is
  'BTY Action Capture represents something the user chose not to lose. It is not an action commitment, Action Decision, Action Contract, behavior evidence, deadline, verification request, Arena state, Foundry completion, Follow-up evidence, or XP-bearing activity. Saving an external item must not create a bty_action_contracts row. Only an explicit later user decision may promote a capture into an Action Contract. Capture != Commitment.';

comment on column public.bty_action_captures.external_key is
  'Server-canonicalized identity of the item in its source system (Teams: tenant:conversation:message). Never trusted from the client; the (user_id, source_type, external_key) UNIQUE is the sole deduplication authority.';
comment on column public.bty_action_captures.status is
  'captured | promoted | dismissed. There is no expiry and no overdue state — a capture is not a promise and therefore can never be late.';
comment on column public.bty_action_captures.promoted_at is
  'HISTORY: an explicit promotion occurred, and when. Historical truth — it survives deletion of the promoted Action Contract. status = promoted IF AND ONLY IF this is set.';
comment on column public.bty_action_captures.promoted_action_contract_id is
  'POINTER to the promoted Action Contract that currently EXISTS; NULL once that contract is deleted. Never the source of truth for whether promotion occurred (see promoted_at). Set ONLY by an explicit user promotion — no trigger creates an Action Contract, and no trigger changes status when one is deleted.';
comment on column public.bty_action_captures.source_metadata is
  'Immutable source provenance. Copied into bty_action_contracts.details.source at promotion so Open in Teams survives without joining this table.';

-- Private by construction. RLS ON with NO policies = deny-all for `anon` and
-- `authenticated`, matching every BTY table added since 2026-08 (measured:
-- foundry_participant_apply_windows, foundry_behavior_observations,
-- bty_org_action_review_authority all enable RLS and create zero policies).
-- All access is server-side via `service_role`, which bypasses RLS. No
-- authenticated INSERT/UPDATE is granted, because granting one would weaken
-- the existing write boundary for convenience.
alter table public.bty_action_captures enable row level security;

grant select, insert, update, delete on public.bty_action_captures to service_role;
