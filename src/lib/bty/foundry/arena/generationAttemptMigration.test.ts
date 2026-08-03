import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * MIGRATION, RLS AND PRIVACY (Slice 3.2I-R5B2-R5A).
 *
 * The attempt table is the first structure in this product that exists purely to remember what a
 * provider did. It therefore has to be checked for the opposite risk from most tables: not that it
 * stores too little, but that it could ever store CONTENT.
 *
 * These read the migration as text, so the guarantees are asserted against the file that will
 * actually be applied rather than against a description of it.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805000000_foundry_practice_generation_attempts_v1.sql"),
  "utf8",
);
const TABLE = "public.foundry_practice_generation_attempts";

describe("[R5A] the table is additive and follows the established convention", () => {
  it("creates only this table, idempotently, and rewrites nothing", () => {
    expect(SQL).toContain(`create table if not exists ${TABLE}`);
    expect((SQL.match(/create table/g) ?? [])).toHaveLength(1);
    // No backfill, no data movement, no trigger reaching other product writes.
    expect(SQL).not.toMatch(/\binsert\s+into\b/i);
    expect(SQL).not.toMatch(/\bupdate\s+public\./i);
    expect(SQL).not.toMatch(/\bdelete\s+from\b/i);
    expect(SQL).not.toMatch(/create\s+(or replace\s+)?trigger/i);
    expect(SQL).not.toMatch(/alter table public\.foundry_arena_scenario_drafts/i);
  });

  it("uses the repository's constrained-text convention, not a new enum type", () => {
    expect(SQL).not.toMatch(/create type/i);
    expect(SQL).toMatch(/lifecycle_state text not null default 'started'[\s\S]*check \(lifecycle_state in \('started', 'completed'\)\)/);
  });

  it("indexes the queries the forensic actually needed", () => {
    for (const idx of [
      "foundry_practice_gen_attempt_draft_started_idx",
      "foundry_practice_gen_attempt_started_idx",
      "foundry_practice_gen_attempt_outcome_idx",
      "foundry_practice_gen_attempt_open_idx",
    ]) {
      expect(SQL).toContain(`create index if not exists ${idx}`);
    }
    // The one R4 could not run: attempts that never reached a terminal state.
    expect(SQL).toMatch(/foundry_practice_gen_attempt_open_idx[\s\S]*where lifecycle_state = 'started'/);
  });

  it("records a reviewed rollback WITHOUT executing it", () => {
    expect(SQL).toMatch(/ROLLBACK \(reviewed, NOT executed/);
    // Every rollback statement is inside a comment.
    for (const line of SQL.split("\n")) {
      if (/drop (table|index)/i.test(line)) expect(line.trim().startsWith("--")).toBe(true);
    }
  });
});

describe("[R5A] no client can read or write attempts", () => {
  it("enables RLS and revokes every client grant", () => {
    expect(SQL).toContain(`alter table ${TABLE} enable row level security`);
    expect(SQL).toContain(`revoke all on ${TABLE} from anon, public, authenticated`);
  });

  it("creates NO permissive policy — RLS with no policy denies outright", () => {
    // A policy would be the only way a product client could enumerate attempts, including its own.
    expect(SQL).not.toMatch(/create policy/i);
  });

  it("cross-account enumeration is therefore impossible by construction", () => {
    const rlsAt = SQL.indexOf("enable row level security");
    const revokeAt = SQL.indexOf("revoke all on");
    expect(rlsAt).toBeGreaterThan(-1);
    expect(revokeAt).toBeGreaterThan(-1);
    expect(SQL).not.toMatch(/grant\s+(select|insert|update|delete|all)[\s\S]{0,80}to\s+(anon|authenticated|public)/i);
  });
});

describe("[R5A] the schema cannot hold content", () => {
  it("declares no column that could carry prose", () => {
    // Column NAMES, not substrings: `prompt_tokens` is a count, and rejecting it for containing
    // "prompt" would be theatre. What must not exist is a column able to hold the text itself.
    const body = SQL.slice(SQL.indexOf("create table"), SQL.indexOf("comment on table"));
    const names = body
      .split("\n")
      .map((l) => l.match(/^\s{2}([a-z_]+)\s+(uuid|text|integer|boolean|timestamptz)/)?.[1])
      .filter((n): n is string => Boolean(n));
    expect(names.length).toBeGreaterThan(15);

    const forbidden = [
      "prompt",
      "prompt_text",
      "messages",
      "response",
      "response_body",
      "response_text",
      "raw_response",
      "scenario",
      "scenario_draft",
      "boundary_statement",
      "constraints",
      "error_message",
      "error_body",
      "stack",
      "stack_trace",
      "content",
      "api_key",
      "authorization",
      "training_title",
    ];
    for (const f of forbidden) expect(names).not.toContain(f);

    // Every TEXT column must be BOUNDED — a closed vocabulary, a digest pattern, or a length cap.
    // Asserting the property rather than a hardcoded list means a future unbounded text column
    // fails here instead of quietly passing a name check.
    // Checks span lines, so bind each text column to a constraint that NAMES it, anywhere in the
    // table body. A future unbounded text column fails here rather than passing a name check.
    const textCols = [...body.matchAll(/^\s{2}([a-z_]+)\s+text\b/gm)].map((m) => m[1]);
    expect(textCols.length).toBeGreaterThanOrEqual(9);
    const UNBOUNDED_BY_DESIGN = new Set(["model", "deploy_version"]); // provider / build identifiers
    for (const name of textCols) {
      if (UNBOUNDED_BY_DESIGN.has(name)) continue;
      const bounded = new RegExp(`check \\(\\s*${name}\\b|${name} in \\(|${name} ~ '\\^|length\\(${name}\\)`);
      expect(bounded.test(body), `${name} must be bounded by a constraint`).toBe(true);
    }
  });

  it("constrains every free-text field to a closed set, a digest, or a short label", () => {
    expect(SQL).toMatch(/outcome text null check \(outcome is null or outcome in \(/);
    expect(SQL).toMatch(/provider_error_category text null check[\s\S]*'rate_limited'/);
    // The response is remembered as a hash and a byte count — never as itself.
    expect(SQL).toMatch(/response_sha256 text null check[\s\S]*\^\[0-9a-f\]\{64\}\$/);
    expect(SQL).toMatch(/finish_reason text null check[\s\S]*length\(finish_reason\) <= 40/);
  });

  it("`generation_failed` is NOT a storable outcome — the collapse cannot come back", () => {
    const outcomeBlock = SQL.slice(SQL.indexOf("outcome text null check"), SQL.indexOf("provider_http_status"));
    expect(outcomeBlock).not.toContain("generation_failed");
    for (const c of [
      "provider_timeout",
      "provider_transport_error",
      "provider_http_error",
      "provider_empty_output",
      "provider_malformed_output",
      "provider_schema_invalid",
      "scenario_quality_rejected",
      "boundary_review_rejected",
      "scenario_persistence_failed",
      "internal_failure",
      "success",
    ]) {
      expect(outcomeBlock).toContain(`'${c}'`);
    }
  });

  it("a row cannot claim a terminal state without an outcome, or persistence without success", () => {
    expect(SQL).toMatch(/lifecycle_state = 'started' and outcome is null and finished_at is null/);
    expect(SQL).toMatch(/lifecycle_state = 'completed' and outcome is not null and finished_at is not null/);
    expect(SQL).toMatch(/scenario_persisted = false or outcome = 'success'/);
  });
});

describe("[R5C-1] the attribution migration is additive and prose-free", () => {
  const ATTR = readFileSync(
    join(process.cwd(), "supabase/migrations/20260805010000_foundry_practice_generation_refusal_attribution_v1.sql"),
    "utf8",
  );

  it("ALTERs the existing table and creates no new or child table", () => {
    expect(ATTR).toContain("alter table public.foundry_practice_generation_attempts");
    expect(ATTR).not.toMatch(/create table/i);
    expect(ATTR).not.toMatch(/_calls\b/);
  });

  it("rewrites no existing row — the two historical attempts keep NULL detail", () => {
    expect(ATTR).not.toMatch(/\bupdate\s+public\./i);
    expect(ATTR).not.toMatch(/\binsert\s+into\b/i);
    expect(ATTR).not.toMatch(/\bdelete\s+from\b/i);
    expect(ATTR).not.toMatch(/create\s+(or replace\s+)?trigger/i);
    // Historical rows are exempt from the completeness rule by attribution_version being NULL.
    expect(ATTR).toMatch(/attribution_version is null\s*\n?\s*or lifecycle_state <> 'completed'/);
  });

  it("keeps semantic review and boundary review as SEPARATE stages", () => {
    const stages = ATTR.slice(ATTR.indexOf("terminal_stage in ("), ATTR.indexOf("terminal_reason_code is null"));
    expect(stages).toContain("'semantic_review'");
    expect(stages).toContain("'boundary_review'");
    expect(stages).not.toMatch(/'review'|'any_review'|'reviewer'/);
  });

  it("names boundary CONTENT rejection distinctly from every non-content boundary failure", () => {
    for (const c of [
      "boundary_content_rejected",
      "boundary_review_authority_failure",
      "boundary_review_inconclusive",
      "boundary_reviewer_terminal_failure",
      "semantic_reviewer_terminal_failure",
      "internal_unclassified_failure",
    ]) {
      expect(ATTR).toContain(`'${c}'`);
    }
    // The old umbrella must not be storable.
    expect(ATTR).not.toContain("'boundary_review_rejected'");
  });

  it("adds no column able to carry prose, and bounds the finding codes", () => {
    const added = [...ATTR.matchAll(/add column if not exists ([a-z_]+)\s+([a-z\[\]]+)/g)].map((m) => [m[1], m[2]]);
    expect(added.length).toBe(7);
    for (const [name] of added) {
      expect(["attribution_version", "terminal_stage", "terminal_reason_code", "refusal_gate", "primary_finding_code", "finding_codes", "finding_count"]).toContain(name);
    }
    // Identifier pattern is what makes prose unstorable rather than merely discouraged.
    expect(ATTR).toMatch(/primary_finding_code ~ '\^\[a-z\]\[a-z0-9_\]\{2,63\}\$'/);
    expect(ATTR).toMatch(/array_length\(finding_codes, 1\) <= 8/);
  });

  it("leaves the RLS posture unchanged and re-asserts the client revoke", () => {
    expect(ATTR).toContain("revoke all on public.foundry_practice_generation_attempts from anon, public, authenticated");
    expect(ATTR).not.toMatch(/create policy/i);
    expect(ATTR).not.toMatch(/disable row level security/i);
    expect(ATTR).not.toMatch(/grant\s+(select|insert|update|delete|all)[\s\S]{0,80}to\s+(anon|authenticated|public)/i);
  });

  it("documents a rollback without executing it", () => {
    expect(ATTR).toMatch(/ROLLBACK \(reviewed, NOT executed\)/);
    for (const line of ATTR.split("\n")) {
      if (/drop (column|constraint|index)/i.test(line)) expect(line.trim().startsWith("--")).toBe(true);
    }
  });
});
