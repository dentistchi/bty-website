import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice Practice Generation System-Block Recovery V1 — the SERVICE boundary.
 *
 * The eligibility rules live in the RPC on purpose, so these prove the two things the service
 * itself owns: it fails closed when the runtime identity is unknown, and it never invents an
 * outcome the database did not give it.
 */

const identity = vi.hoisted(() => ({ currentSourceIdentity: vi.fn() }));
vi.mock("./sourceIdentity", () => identity);

import { listRecoverableSystemBlocks, recoverPracticeGenerationSystemBlock } from "./practiceGenerationRecovery.server";

const CURRENT = "d3329f2f966dccfbd4749a823fc711bff9091734";
const FAILED = "d2a18a081c45b0a084c202308d43da6d224615b3";
const DRAFT = "af921b9d-19b1-4673-a0ff-9753ecd581b1";
const ATTEMPT = "29cfe46e-4b13-4c08-a4a2-9f639eb55195";

const input = (over: Record<string, unknown> = {}) => ({
  draftId: DRAFT,
  blockedAttemptId: ATTEMPT,
  grantedByUserId: "admin-1",
  recoveryReasonCode: "boundary_repair_group_expansion_fixed",
  fixedInDeploySha: CURRENT,
  ...over,
});

/** Records every table write attempted, so "history is untouched" is observed, not assumed. */
function fakeAdmin(opts: { rpc?: (fn: string, args: Record<string, unknown>) => unknown } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const writes: string[] = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "get_foundry_practice_generation_governance_v1") {
        return { data: [{ state: "ready", can_start_generation: true }], error: null };
      }
      const r = opts.rpc?.(fn, args);
      return (r as { data?: unknown; error?: unknown }) ?? {
        data: [{ recovery_id: "rec-1", recovered_attempt_id: ATTEMPT, recovered_draft_id: DRAFT, recovered_at: "2026-09-25T00:00:00Z", already_recovered: false }],
        error: null,
      };
    },
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: table === "foundry_arena_scenario_drafts" ? { owner_user_id: "owner-1" } : { locale: "en" },
        }),
        update: () => { writes.push(`update:${table}`); return chain; },
        delete: () => { writes.push(`delete:${table}`); return chain; },
      };
      return chain;
    },
  };
  return { admin: admin as never, calls, writes };
}

beforeEach(() => {
  vi.clearAllMocks();
  identity.currentSourceIdentity.mockReturnValue({ sourceCommitSha: CURRENT });
});

describe("O — an unknown runtime fails closed", () => {
  it("refuses, and never reaches the database", async () => {
    identity.currentSourceIdentity.mockReturnValue(null);
    const { admin, calls } = fakeAdmin();
    expect(await recoverPracticeGenerationSystemBlock(admin, input()))
      .toEqual({ ok: false, reason: "source_identity_unavailable" });
    expect(calls).toHaveLength(0);
  });

  it("treats a blank sha as unknown rather than as a value", async () => {
    identity.currentSourceIdentity.mockReturnValue({ sourceCommitSha: "" });
    const { admin, calls } = fakeAdmin();
    expect((await recoverPracticeGenerationSystemBlock(admin, input())).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("Q/S — a valid recovery succeeds and changes no history", () => {
  it("returns the recovery and the governance state that followed it", async () => {
    const { admin, writes } = fakeAdmin();
    const r = await recoverPracticeGenerationSystemBlock(admin, input());
    expect(r).toMatchObject({
      ok: true, recoveryId: "rec-1", blockedAttemptId: ATTEMPT, draftId: DRAFT,
      alreadyRecovered: false, governanceState: "ready", canStartGeneration: true,
    });
    expect(writes).toEqual([]);
  });

  it("passes the CURRENT runtime sha to the database, never the operator's claim alone", async () => {
    const { admin, calls } = fakeAdmin();
    await recoverPracticeGenerationSystemBlock(admin, input());
    const rpc = calls.find((c) => c.fn === "recover_foundry_practice_generation_system_block_v1")!;
    expect(rpc.args.p_current_deploy_sha).toBe(CURRENT);
    expect(rpc.args.p_granted_by_user_id).toBe("admin-1");
  });

  it("reads governance through the same function the Host's own screen reads", async () => {
    const { admin, calls } = fakeAdmin();
    await recoverPracticeGenerationSystemBlock(admin, input());
    expect(calls.some((c) => c.fn === "get_foundry_practice_generation_governance_v1")).toBe(true);
  });
});

describe("R — a repeated recovery is the same recovery", () => {
  it("reports alreadyRecovered rather than a second grant", async () => {
    const { admin } = fakeAdmin({
      rpc: () => ({ data: [{ recovery_id: "rec-1", recovered_attempt_id: ATTEMPT, recovered_draft_id: DRAFT, recovered_at: "2026-09-25T00:00:00Z", already_recovered: true }], error: null }),
    });
    const r = await recoverPracticeGenerationSystemBlock(admin, input());
    expect(r).toMatchObject({ ok: true, recoveryId: "rec-1", alreadyRecovered: true });
  });
});

describe("K/L/M/N/P — every database refusal is carried through by name", () => {
  const cases: [string, string][] = [
    ["K", "attempt_draft_mismatch"],
    ["L", "attempt_not_system_block"],
    ["M", "attempt_not_completed"],
    ["—", "blocked_attempt_source_identity_unavailable"],
    ["N", "source_identity_unchanged"],
    ["P", "fixed_deploy_sha_not_current"],
    ["—", "blocked_attempt_not_found"],
    ["—", "support_reference_mismatch"],
  ];
  it.each(cases)("%s → %s", async (_label, code) => {
    const { admin } = fakeAdmin({ rpc: () => ({ data: null, error: { code: "22023", message: `${code}` } }) });
    expect(await recoverPracticeGenerationSystemBlock(admin, input()))
      .toEqual({ ok: false, reason: code });
  });

  it("an unrecognised database error never becomes a specific refusal", async () => {
    const { admin } = fakeAdmin({ rpc: () => ({ data: null, error: { code: "XX000", message: "something else" } }) });
    expect(await recoverPracticeGenerationSystemBlock(admin, input()))
      .toEqual({ ok: false, reason: "recovery_failed" });
  });

  it.each([
    { recovery_id: undefined },
    { recovered_attempt_id: undefined },
    { recovered_draft_id: undefined },
    { recovered_at: undefined },
    { recovered_at: "" },
    { already_recovered: undefined },
    { already_recovered: "false" },
  ])("refuses incomplete audit facts rather than inventing them: %#", async (missing) => {
    const { admin } = fakeAdmin({
      rpc: () => ({
        data: [{ recovery_id: "rec-1", recovered_attempt_id: ATTEMPT, recovered_draft_id: DRAFT, recovered_at: "2026-09-25T00:00:00Z", already_recovered: false, ...missing }],
        error: null,
      }),
    });
    expect(await recoverPracticeGenerationSystemBlock(admin, input())).toEqual({ ok: false, reason: "recovery_failed" });
  });

  it("N is the live case: recovering ON the failed build is refused", async () => {
    identity.currentSourceIdentity.mockReturnValue({ sourceCommitSha: FAILED });
    const { admin } = fakeAdmin({ rpc: () => ({ data: null, error: { code: "22023", message: "source_identity_unchanged" } }) });
    expect((await recoverPracticeGenerationSystemBlock(admin, input({ fixedInDeploySha: FAILED }))).ok).toBe(false);
  });
});

describe("the governance read is additive", () => {
  it("still reports a durable recovery when governance cannot be read", async () => {
    const { calls } = fakeAdmin();
    const admin = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        if (fn === "get_foundry_practice_generation_governance_v1") return { data: null, error: { code: "42501" } };
        return { data: [{ recovery_id: "rec-1", recovered_attempt_id: ATTEMPT, recovered_draft_id: DRAFT, recovered_at: "t", already_recovered: false }], error: null };
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { owner_user_id: "o", locale: "en" } }) }) }) }),
    };
    const r = await recoverPracticeGenerationSystemBlock(admin as never, input());
    expect(r).toMatchObject({ ok: true, governanceState: null, canStartGeneration: null });
  });
});

describe("discovery — the set comes from SQL, never from a list in this file", () => {
  const row = {
    recoverable_draft_id: DRAFT,
    recoverable_attempt_id: ATTEMPT,
    recoverable_outcome: "review_execution_failed",
    recoverable_terminal_reason_code: "boundary_reviewer_terminal_failure",
    recoverable_failed_deploy_sha: FAILED,
  };

  it("projects the canonical rows and stamps the current build", async () => {
    const admin = { rpc: async () => ({ data: [row], error: null }) };
    const r = await listRecoverableSystemBlocks(admin as never);
    expect(r).toEqual({
      ok: true,
      recoverable: [{
        draftId: DRAFT, blockedAttemptId: ATTEMPT,
        outcome: "review_execution_failed",
        terminalReasonCode: "boundary_reviewer_terminal_failure",
        failedDeploySha: FAILED, currentDeploySha: CURRENT,
      }],
    });
  });

  it("calls the canonical SQL projection", async () => {
    const seen: string[] = [];
    const admin = { rpc: async (fn: string) => { seen.push(fn); return { data: [], error: null }; } };
    await listRecoverableSystemBlocks(admin as never);
    expect(seen).toEqual(["foundry_practice_generation_recoverable_blocks_v1"]);
  });

  it("names no terminal reason code in application code", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/bty/foundry/arena/practiceGenerationRecovery.server.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const code of ["semantic_reviewer_terminal_failure", "boundary_reviewer_terminal_failure", "review_execution_failed"]) {
      expect(src, code).not.toContain(code);
    }
  });

  it("an unknown runtime returns nothing rather than an empty list", async () => {
    identity.currentSourceIdentity.mockReturnValue(null);
    let called = false;
    const admin = { rpc: async () => { called = true; return { data: [], error: null }; } };
    expect(await listRecoverableSystemBlocks(admin as never)).toEqual({ ok: false, reason: "source_identity_unavailable" });
    expect(called).toBe(false);
  });

  it("drops a row missing either coordinate rather than rendering a half-identified block", async () => {
    const admin = { rpc: async () => ({ data: [row, { ...row, recoverable_attempt_id: null }], error: null }) };
    const r = await listRecoverableSystemBlocks(admin as never);
    expect(r.ok && r.recoverable).toHaveLength(1);
  });

  it("reports a failed read instead of an empty list", async () => {
    const admin = { rpc: async () => ({ data: null, error: { code: "42883" } }) };
    expect(await listRecoverableSystemBlocks(admin as never)).toEqual({ ok: false, reason: "discovery_failed" });
  });
});
