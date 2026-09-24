import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice Practice Generation System-Block Recovery V1 — the MIGRATION contract.
 *
 * ★ WHAT THESE PROVE, AND WHAT THEY DO NOT. They read the SQL and assert its shape. They are a
 * structural proof, not a behavioural one: no database executes here, so "the helper ignores a
 * recovered attempt" is asserted as written SQL rather than as an observed row. The behavioural
 * proof is the post-deploy production check, and these exist so the shape cannot regress silently
 * between now and then.
 *
 * The hazard they were written for is specific: the system-block test lives in TWO governance
 * functions whose LATEST definitions are in DIFFERENT migrations, so a clause duplicated by hand
 * can disagree while both files still read correctly on their own.
 */

const ROOT = process.cwd();
const MIG = join(ROOT, "supabase/migrations");
const sql = (f: string) => readFileSync(join(MIG, f), "utf8");
const THIS = sql("20260925000000_practice_generation_system_block_recovery_v1.sql");
const TABLE = "foundry_practice_generation_system_block_recoveries";
const HELPER = "foundry_practice_generation_active_system_block_v1";

describe("A — the recovery record is private and append-only", () => {
  it("is server-only: RLS on, client roles revoked", () => {
    expect(THIS).toMatch(new RegExp(`revoke all on public\\.${TABLE} from anon, public, authenticated`));
    expect(THIS).toMatch(new RegExp(`alter table public\\.${TABLE} enable row level security`));
  });

  it("creates no policy, so no client key can read it even if a grant returns", () => {
    expect(THIS).not.toMatch(new RegExp(`create policy[\\s\\S]*${TABLE}`));
  });

  it("offers no update or delete path — the record is append-only", () => {
    expect(THIS).not.toMatch(new RegExp(`update public\\.${TABLE}`));
    expect(THIS).not.toMatch(new RegExp(`delete from public\\.${TABLE}`));
  });

  it("never modifies the failed attempt", () => {
    expect(THIS).not.toMatch(/update public\.foundry_practice_generation_attempts/);
    expect(THIS).not.toMatch(/delete from public\.foundry_practice_generation_attempts/);
  });
});

describe("B — one recovery per failure", () => {
  it("pins uniqueness to the blocked attempt", () => {
    expect(THIS).toMatch(/unique \(blocked_attempt_id\)/);
  });

  it("inserts with ON CONFLICT DO NOTHING, so a repeat is not a second grant", () => {
    expect(THIS).toMatch(/on conflict \(blocked_attempt_id\) do nothing/);
  });

  it("constrains the operator's assertions rather than trusting them", () => {
    expect(THIS).toMatch(/fixed_in_deploy_sha ~ '\^\[0-9a-f\]\{40\}\$'/);
    expect(THIS).toMatch(/support_reference ~ '\^\[0-9a-f\]\{12\}\$'/);
    expect(THIS).toMatch(/recovery_contract_version = 1/);
  });
});

describe("C/D — the helper ignores a recovered attempt and still sees every other one", () => {
  it("filters on a NOT EXISTS keyed to the attempt id, never to the draft", () => {
    const body = THIS.slice(THIS.indexOf(`function public.${HELPER}`));
    expect(body).toMatch(/not exists \(\s*select 1\s*from public\.foundry_practice_generation_system_block_recoveries r\s*where r\.blocked_attempt_id = a\.id/);
  });

  it("reuses the canonical predicate instead of re-enumerating outcomes", () => {
    expect(THIS).toMatch(/public\.foundry_practice_generation_is_system_block_v1\(a\.outcome, a\.terminal_reason_code\)/);
    for (const code of ["semantic_reviewer_terminal_failure", "boundary_reviewer_terminal_failure", "review_execution_failed"]) {
      // Naming them here would fork the vocabulary the canonical helper exists to own.
      expect(THIS.split("comment on")[0], code).not.toContain(`'${code}'`);
    }
  });

  it("stays draft-scoped and epoch- and locale-independent", () => {
    const body = THIS.slice(THIS.indexOf(`function public.${HELPER}`), THIS.indexOf("comment on function"));
    expect(body).not.toMatch(/generation_input_revision/);
    expect(body).not.toMatch(/locale/);
  });
});

describe("E — the two governance functions cannot disagree", () => {
  it("both call the shared helper", () => {
    const calls = THIS.match(new RegExp(`public\\.${HELPER}\\(p_draft_id\\)`, "g")) ?? [];
    expect(calls.length).toBe(2);
  });

  it("neither keeps its own inline system-block EXISTS", () => {
    const after = THIS.slice(THIS.indexOf("3. THE READ-ONLY GOVERNANCE"));
    expect(after).not.toMatch(/select exists \([\s\S]{0,200}is_system_block_v1/);
  });

  it("the admitting body is carried from its LATEST definition, not the older one", () => {
    // These three exist only in 20260806000000. Copying from 20260805050000 would drop them.
    expect(THIS).toMatch(/duplicate_existing_intent/);
    expect(THIS).toMatch(/input_revision_stale/);
    expect(THIS).toMatch(/when unique_violation then/);
    expect(THIS).toMatch(/p_submission_intent_id uuid\n\) returns table/);
  });
});

describe("F/H — recovery touches nothing but the block", () => {
  it("leaves the refusal count on its own predicate", () => {
    const refusalUses = THIS.match(/foundry_practice_generation_refusal_counts_v1/g) ?? [];
    expect(refusalUses.length).toBe(2);
    expect(THIS).not.toMatch(/refusal_counts_v1[\s\S]{0,120}system_block_recoveries/);
  });

  it("preserves the epoch and locale filter on the refusal count", () => {
    const windows = THIS.match(/a\.generation_input_revision = v_epoch and a\.locale = p_locale/g) ?? [];
    expect(windows.length).toBe(2);
  });
});

describe("G — precedence is unchanged", () => {
  it("keeps in_progress above system_blocked above the refusal states", () => {
    const branches = THIS.match(/when v_active then 'in_progress'[\s\S]{0,260}?when v_count = 1/g) ?? [];
    expect(branches.length).toBe(2);
    for (const b of branches) {
      expect(b.indexOf("'in_progress'")).toBeLessThan(b.indexOf("'system_blocked'"));
      expect(b.indexOf("'system_blocked'")).toBeLessThan(b.indexOf("'revision_required'"));
    }
  });
});

describe("the RPC refuses everything it should", () => {
  it("names each refusal explicitly", () => {
    for (const code of [
      "unknown_source_identity",
      "invalid_fixed_deploy_sha",
      "fixed_deploy_sha_not_current",
      "blocked_attempt_not_found",
      "attempt_draft_mismatch",
      "attempt_not_completed",
      "attempt_not_system_block",
      "source_identity_unchanged",
      "support_reference_mismatch",
    ]) {
      expect(THIS, code).toContain(code);
    }
  });

  it("proves the attempt belongs to the draft rather than trusting the pairing", () => {
    expect(THIS).toMatch(/v_attempt\.draft_id is distinct from p_draft_id/);
  });

  it("locks the attempt so a concurrent recovery cannot race the checks", () => {
    expect(THIS).toMatch(/where a\.id = p_blocked_attempt_id\s*\n\s*for update/);
  });

  it("avoids the OUT-param/column collision that only fails at runtime", () => {
    const sig = THIS.slice(THIS.indexOf("function public.recover_foundry_practice_generation_system_block_v1"));
    const outs = sig.slice(sig.indexOf("returns table"), sig.indexOf("language plpgsql"));
    for (const col of ["blocked_attempt_id", "draft_id", "granted_at"]) {
      expect(outs, col).not.toMatch(new RegExp(`\\n\\s*${col} `));
    }
  });

  it("reads ROW_COUNT into an integer, not a boolean", () => {
    expect(THIS).toMatch(/v_inserted_rows integer/);
    expect(THIS).toMatch(/get diagnostics v_inserted_rows = row_count/);
  });
});
