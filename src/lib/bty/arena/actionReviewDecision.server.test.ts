import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Canonical Action Review decision command (Slice 3.1B-3N-5C).
 * Covers Refinement 5 (authority, side-effect gate, idempotency, stale) + Section 9.
 * The atomic RPC (bty_resolve_action_review) is the DB source of truth; here it is mocked
 * to drive each branch. The APPROVE completion chain is mocked to assert the side-effect
 * gate + learner-scoped attribution.
 */

const mockResolveAuthority = vi.fn();
vi.mock("@/lib/bty/arena/actionReviewAuthorityResolver.server", () => ({
  resolveActionReviewAuthority: (...a: unknown[]) => mockResolveAuthority(...a),
}));

const mockCompleteRun = vi.fn().mockResolvedValue({ runUpdated: true, deferredQueued: false });
vi.mock("@/lib/bty/action-contract/actionContractLifecycle.server", () => ({
  completeArenaRunAfterContractVerification: (...a: unknown[]) => mockCompleteRun(...a),
}));

const mockLevel = vi.fn().mockResolvedValue({ ok: true, applied: true, bandChanged: false });
vi.mock("@/lib/bty/level-engine/arenaLevelRecords", () => ({
  onArenaRunCompleteVerified: (...a: unknown[]) => mockLevel(...a),
}));

const mockReward = vi.fn().mockResolvedValue({ ok: true, applied: true });
const mockAir = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/bty/arena/reflectionRewards.server", () => ({
  applyArenaRunRewardsOnVerifiedCompletion: (...a: unknown[]) => mockReward(...a),
  reflectContractVerificationToAir: (...a: unknown[]) => mockAir(...a),
}));

import { resolveActionReviewDecision } from "./actionReviewDecision.server";

const HOST = "host-a";
const LEARNER = "learner-a";
const CONTRACT = "contract-a";

type RpcRow = Record<string, unknown>;

function makeAdmin(rpcRow: RpcRow | null, rpcError: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcRow ? [rpcRow] : [], error: rpcError });
  return { admin: { rpc } as never, rpc };
}

function appliedApproveRow(overrides: RpcRow = {}): RpcRow {
  return {
    transition_applied: true,
    stale_reason: null,
    decision: "approve",
    previous_status: "submitted",
    resulting_status: "approved",
    reviewed_at: "2026-07-23T00:00:00.000Z",
    revision_note: null,
    decision_audit_id: "audit-1",
    learner_user_id: LEARNER,
    verification_mode: "hybrid",
    contract_run_id: "run-1",
    contract_session_id: "run-1",
    arena_scenario_id: "scn-1",
    le_activation_type: "micro_win",
    weight: 1,
    chosen_at: "2026-07-22T00:00:00.000Z",
    deadline_at: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAuthority.mockResolvedValue({
    allowed: true,
    actorUserId: HOST,
    actionContractId: CONTRACT,
    authorityId: "edge-1",
    reviewerMembershipId: "rm-1",
    learnerMembershipId: "lm-1",
    organizationId: "org-1",
    verificationMode: "hybrid",
  });
});

describe("resolveActionReviewDecision — authority", () => {
  it("authorized reviewer can approve (RPC called; success)", async () => {
    const { admin, rpc } = makeAdmin(appliedApproveRow());
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "approve",
    });
    expect(r.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("bty_resolve_action_review", expect.objectContaining({
      p_action_contract_id: CONTRACT,
      p_actor_user_id: HOST,
      p_decision: "approve",
      p_revision_note: null,
    }));
  });

  it("authorized reviewer can request revision (note passed through)", async () => {
    const { admin, rpc } = makeAdmin(
      appliedApproveRow({ decision: "request_revision", resulting_status: "rejected", revision_note: "tighten it" }),
    );
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "request_revision",
      revisionNote: "tighten it",
    });
    expect(r.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("bty_resolve_action_review", expect.objectContaining({
      p_decision: "request_revision",
      p_revision_note: "tighten it",
    }));
  });

  it("resolveActionReviewAuthority is called from the mutation path BEFORE the RPC", async () => {
    const order: string[] = [];
    mockResolveAuthority.mockImplementationOnce(async () => {
      order.push("authority");
      return { allowed: true, verificationMode: "hybrid" };
    });
    const rpc = vi.fn().mockImplementation(async () => {
      order.push("rpc");
      return { data: [appliedApproveRow()], error: null };
    });
    await resolveActionReviewDecision({ rpc } as never, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "approve",
    });
    expect(order).toEqual(["authority", "rpc"]);
  });

  it("unauthorized reviewer cannot approve — resolver deny, RPC never called", async () => {
    mockResolveAuthority.mockResolvedValueOnce({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    const { admin, rpc } = makeAdmin(appliedApproveRow());
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "approve",
    });
    expect(r).toEqual({ ok: false, code: "unauthorized" });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockCompleteRun).not.toHaveBeenCalled();
  });

  it("unauthorized reviewer cannot request revision", async () => {
    mockResolveAuthority.mockResolvedValueOnce({ allowed: false, reason: "ORGANIZATION_MISMATCH" });
    const { admin, rpc } = makeAdmin(null);
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "request_revision",
      revisionNote: "note",
    });
    expect(r).toEqual({ ok: false, code: "unauthorized" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a stale detail loaded under another account cannot mutate (RPC unauthorized → generic 404)", async () => {
    // Authority (loader) may still pass under the old identity, but the RPC re-derives from
    // DB truth and returns unauthorized — collapsed to a generic unauthorized result.
    const { admin } = makeAdmin(appliedApproveRow({ transition_applied: false, stale_reason: "unauthorized" }));
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "approve",
    });
    expect(r).toEqual({ ok: false, code: "unauthorized" });
    expect(mockCompleteRun).not.toHaveBeenCalled();
  });
});

describe("resolveActionReviewDecision — note validation (pre-RPC)", () => {
  it("request revision requires a non-empty note (RPC never called)", async () => {
    const { admin, rpc } = makeAdmin(null);
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "request_revision",
      revisionNote: "   ",
    });
    expect(r).toEqual({ ok: false, code: "note_required" });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockResolveAuthority).not.toHaveBeenCalled();
  });

  it("revision note longer than 500 chars is rejected", async () => {
    const { admin, rpc } = makeAdmin(null);
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "request_revision",
      revisionNote: "x".repeat(501),
    });
    expect(r).toEqual({ ok: false, code: "note_too_long" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("invalid decision is rejected before any I/O", async () => {
    const { admin, rpc } = makeAdmin(null);
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "reject",
    });
    expect(r).toEqual({ ok: false, code: "invalid_decision" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("resolveActionReviewDecision — side-effect gate + idempotency", () => {
  it("APPROVE runs the completion chain ONCE, scoped to the LEARNER (not the Host)", async () => {
    const { admin } = makeAdmin(appliedApproveRow());
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "approve",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.completionApplied).toBe(true);
    expect(mockCompleteRun).toHaveBeenCalledTimes(1);
    expect(mockLevel).toHaveBeenCalledTimes(1);
    expect(mockReward).toHaveBeenCalledTimes(1);
    expect(mockAir).toHaveBeenCalledTimes(1);
    // Completion is attributed to the learner (run/XP/AIR/Level owner), never the Host.
    expect(mockCompleteRun).toHaveBeenCalledWith(admin, expect.objectContaining({ userId: LEARNER }));
    expect(mockLevel).toHaveBeenCalledWith(admin, LEARNER, "run-1");
    expect(mockAir).toHaveBeenCalledWith(expect.objectContaining({ userId: LEARNER, method: "host_review_approval" }));
  });

  it("REQUEST REVISION never runs any completion effect", async () => {
    const { admin } = makeAdmin(
      appliedApproveRow({ decision: "request_revision", resulting_status: "rejected", revision_note: "redo" }),
    );
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "request_revision",
      revisionNote: "redo",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.completionApplied).toBe(false);
    expect(mockCompleteRun).not.toHaveBeenCalled();
    expect(mockLevel).not.toHaveBeenCalled();
    expect(mockReward).not.toHaveBeenCalled();
    expect(mockAir).not.toHaveBeenCalled();
  });

  it("zero-row CAS (already resolved) → no completion effects, stale result", async () => {
    const { admin } = makeAdmin(
      appliedApproveRow({ transition_applied: false, stale_reason: "already_resolved", resulting_status: "approved" }),
    );
    const r = await resolveActionReviewDecision(admin, {
      actorUserId: HOST,
      actionContractId: CONTRACT,
      decision: "approve",
    });
    expect(r).toEqual({ ok: false, code: "already_resolved", currentStatus: "approved" });
    expect(mockCompleteRun).not.toHaveBeenCalled();
    expect(mockLevel).not.toHaveBeenCalled();
    expect(mockReward).not.toHaveBeenCalled();
    expect(mockAir).not.toHaveBeenCalled();
  });

  it("retry after a successful approve (RPC now reports not-applied) → no additional effects", async () => {
    // First call wins.
    const first = makeAdmin(appliedApproveRow());
    await resolveActionReviewDecision(first.admin, { actorUserId: HOST, actionContractId: CONTRACT, decision: "approve" });
    vi.clearAllMocks();
    mockResolveAuthority.mockResolvedValue({ allowed: true, verificationMode: "hybrid" });
    // Retry: CAS finds it already approved → transition_applied false.
    const retry = makeAdmin(appliedApproveRow({ transition_applied: false, stale_reason: "already_resolved" }));
    const r = await resolveActionReviewDecision(retry.admin, { actorUserId: HOST, actionContractId: CONTRACT, decision: "approve" });
    expect(r.ok).toBe(false);
    expect(mockCompleteRun).not.toHaveBeenCalled();
    expect(mockLevel).not.toHaveBeenCalled();
    expect(mockReward).not.toHaveBeenCalled();
    expect(mockAir).not.toHaveBeenCalled();
  });

  it("not_found from the RPC maps to not_found; no effects", async () => {
    const { admin } = makeAdmin(appliedApproveRow({ transition_applied: false, stale_reason: "not_found", resulting_status: null }));
    const r = await resolveActionReviewDecision(admin, { actorUserId: HOST, actionContractId: CONTRACT, decision: "approve" });
    expect(r).toEqual({ ok: false, code: "not_found", currentStatus: null });
    expect(mockCompleteRun).not.toHaveBeenCalled();
  });

  it("ambiguous authority from the RPC fails closed (unauthorized); no effects", async () => {
    const { admin } = makeAdmin(appliedApproveRow({ transition_applied: false, stale_reason: "ambiguous_authority" }));
    const r = await resolveActionReviewDecision(admin, { actorUserId: HOST, actionContractId: CONTRACT, decision: "approve" });
    expect(r).toEqual({ ok: false, code: "unauthorized" });
    expect(mockLevel).not.toHaveBeenCalled();
  });
});
