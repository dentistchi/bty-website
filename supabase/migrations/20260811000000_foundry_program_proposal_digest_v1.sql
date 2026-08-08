-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — exact proposal identity on the program ATTEMPT row (Slice 3.2L-R11.3)
--
-- HELD until a Founder SQL gate. `supabase db push` does not scan this directory.
--
-- WHY IT EXISTS. R11.2 gave the adoption receipt real server authority: same draft, owner
-- scoped, successful outcome, matching context fingerprint, newest such success. That
-- proves the receipt names the newest successful generation. It does NOT prove the journey
-- being adopted is the one that generation produced — any schema-valid journey could take
-- that attempt's receipt, because nothing durable said what the attempt actually emitted.
--
-- The measurement is on the canonical draft today: five successful attempts, one shared
-- context fingerprint. Ownership and recency cannot separate them by content.
--
-- WHAT COULD NOT BE REUSED, and why:
--
--   response_sha256 (calls)  a digest of the RAW PROVIDER BYTES. The adopted journey is the
--                            validated, derived, Host-chosen content, so it can never be
--                            recomputed from one. Different fact, not a substitute.
--   context_fingerprint      the HOST INPUT the proposal was authored from. It is identical
--                            across all five successes; it says nothing about output.
--   element_count            a count. Every one of the five reads 7.
--   offending_path / expected_type / actual_type / dependency + behaviour diagnostics
--                            each already means something precise about a REFUSAL.
--
-- There is no jsonb, metadata, artifact or payload column on either table: the ledger was
-- built to hold shape, outcome, cost and digests only. So there is nowhere to put this.
--
-- WHAT IS STORED. One digest of the generated proposal's participant-facing identity —
-- the display title and the content of the required sections — computed SERVER-SIDE from
-- the validated proposal returned for review. The client is never authoritative for it.
--
-- THE PROPOSAL BODY IS STILL NEVER STORED. This is a one-way hash: it can confirm that a
-- journey presented later is the same text, and it cannot reproduce a single sentence of
-- it. The Slice 3.2L-R7 privacy rule — no raw model prose in the ledger — is unchanged.
--
-- HISTORICAL ROWS STAY NULL, and null means exactly one thing: exact proposal identity was
-- not durably recorded for that attempt. It must never be read as success, and a null can
-- never satisfy the Apply-time check. The five existing successes — including 15108cf3 —
-- are therefore not eligible for exact-source adoption, and nothing here pretends
-- otherwise: their proposals are unrecoverable by design and are NOT backfilled.
--
-- Idempotent and additive. No backfill, no default, no rewrite of any existing row.
-- ============================================================================

alter table public.foundry_program_generation_attempts
  add column if not exists proposal_digest text;

-- Format is enforced, not merely hoped for: `<version>:<64 hex>`. A malformed or
-- truncated digest is rejected by the database, not just by the writer.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_program_attempts_proposal_digest_format'
  ) then
    alter table public.foundry_program_generation_attempts
      add constraint foundry_program_attempts_proposal_digest_format
      check (
        proposal_digest is null
        or proposal_digest ~ '^program_proposal_digest_v[0-9]+:[0-9a-f]{64}$'
      );
  end if;
end $$;

-- A digest describes a proposal, so only a successful attempt may carry one.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_program_attempts_digest_requires_success'
  ) then
    alter table public.foundry_program_generation_attempts
      add constraint foundry_program_attempts_digest_requires_success
      check (proposal_digest is null or outcome = 'success');
  end if;
end $$;

comment on column public.foundry_program_generation_attempts.proposal_digest is
  'Slice 3.2L-R11.3 — server-computed digest of the exact generated proposal (title + required section content). One-way; the proposal body is never stored. NULL means exact identity was not recorded, never that adoption succeeded.';
