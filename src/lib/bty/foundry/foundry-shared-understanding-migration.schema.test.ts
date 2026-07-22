import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for Slice 3.1B-3G (Shared Understanding Evidence V1). Proves the migration
 * keeps private Reflection (response_text) private + independently addressable, adds a SEPARATE
 * shared_understanding_response path, gives legacy rows NO shared status (Amendment A), FKs the
 * Host reviewer to the measured canonical actor auth.users (Amendment B), enforces the impossible-
 * state constraints (Amendment C), preserves review history via an append-only audit (Amendment D),
 * and never exposes response_text through the review RPC (privacy). Additive only (Amendment H).
 */
const PATH = join(process.cwd(), "supabase", "migrations", "20260726000000_foundry_shared_understanding_v1.sql");
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("foundry shared-understanding migration (schema-intent)", () => {
  it("adds a nullable shared_question to BOTH content tables (NULL = existing behavior)", () => {
    expect(CODE).toMatch(/alter table public\.foundry_event_training_content add column if not exists shared_question text/i);
    expect(CODE).toMatch(/alter table public\.foundry_event_document_content add column if not exists shared_question text/i);
  });

  it("adds shared_understanding_response as a SEPARATE column and does NOT touch/drop response_text (Amendment G/H)", () => {
    expect(CODE).toMatch(/add column if not exists shared_understanding_response text/i);
    // response_text must never be altered/dropped/reclassified by this migration.
    expect(CODE).not.toMatch(/response_text/i);
  });

  it("host_review_status is NULLABLE with NO default (legacy rows get no status — Amendment A)", () => {
    // The column definition ends immediately at the comma — no NOT NULL, no DEFAULT.
    expect(CODE).toMatch(/add column if not exists host_review_status text,/i);
    expect(CODE).not.toMatch(/add column if not exists host_review_status text not null/i);
    expect(CODE).not.toMatch(/add column if not exists host_review_status text default/i);
  });

  it("host_reviewed_by FKs the measured canonical actor auth.users, plus a durable snapshot (Amendment B)", () => {
    expect(CODE).toMatch(/host_reviewed_by uuid references auth\.users \(id\) on delete set null/i);
    expect(CODE).toMatch(/host_reviewed_by_snapshot uuid/i);
  });

  it("enforces impossible-state consistency constraints (Amendment C)", () => {
    // response <-> submitted_at together
    expect(CODE).toMatch(/\(shared_understanding_response is null\) = \(shared_response_submitted_at is null\)/i);
    // review cannot exist without a shared response
    expect(CODE).toMatch(/host_review_status is null or shared_understanding_response is not null/i);
    // NOT_REVIEWED has no reviewer; reviewed states require reviewed_at + snapshot
    expect(SQL).toMatch(/host_review_status = 'NOT_REVIEWED' and host_reviewed_at is null and host_reviewed_by is null/i);
    expect(SQL).toMatch(/host_review_status in \('ALIGNED', 'PARTIALLY_CLEAR', 'FOLLOW_UP_NEEDED'\) and host_reviewed_at is not null and host_reviewed_by_snapshot is not null/i);
  });

  it("preserves review history via an append-only, service-role-only, RLS audit table (Amendment D)", () => {
    expect(CODE).toMatch(/create table if not exists public\.foundry_shared_review_audit/i);
    expect(CODE).toMatch(/prev_status text/i);
    expect(CODE).toMatch(/new_status text not null/i);
    expect(CODE).toMatch(/reviewed_by_snapshot uuid not null/i);
    expect(CODE).toMatch(/alter table public\.foundry_shared_review_audit enable row level security/i);
    expect(CODE).toMatch(/revoke all on public\.foundry_shared_review_audit from anon, public, authenticated/i);
  });

  it("review RPC is owner-scoped, requires a shared response, audits, and is idempotent — service-role only", () => {
    expect(CODE).toMatch(/create or replace function public\.bty_foundry_set_shared_review/i);
    expect(CODE).toMatch(/security definer/i);
    expect(CODE).toMatch(/set search_path = pg_catalog, public/i);
    // owner authorization
    expect(CODE).toMatch(/v_owner <> p_owner_user_id/i);
    expect(CODE).toMatch(/'not_owner'/i);
    // requires a submitted shared response
    expect(CODE).toMatch(/shared_understanding_response is null/i);
    expect(CODE).toMatch(/'no_shared_response'/i);
    // idempotent no-op on unchanged (status, note)
    expect(CODE).toMatch(/'unchanged'/i);
    // writes an audit row
    expect(CODE).toMatch(/insert into public\.foundry_shared_review_audit/i);
    // service-role only execute
    expect(CODE).toMatch(/grant execute on function public\.bty_foundry_set_shared_review[^;]*to service_role/i);
    expect(CODE).toMatch(/revoke all on function public\.bty_foundry_set_shared_review[^;]*from anon, public, authenticated/i);
  });

  it("the review RPC NEVER reads response_text or the AI reflection (privacy — Host sees only shared evidence)", () => {
    // The function body selects shared_understanding_response / status / note — never the private bodies.
    expect(CODE).not.toMatch(/\bresponse_text\b/i);
    expect(CODE).not.toMatch(/\breflection\b/i);
  });
});
