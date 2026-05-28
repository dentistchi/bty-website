/**
 * POST /api/bty/action-contract/submit-validation
 * G-B06: Layer 1 returns all field failures in one response (multi-field bundle).
 * G-B07: JSON exposes no validator rationale keys (VALIDATOR_ARCHITECTURE_V1 §5).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as validation from "@/lib/bty/validator/runActionContractValidation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POST } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

// MVP-FIX-ACTION-DEMO-05 (B): the auto-approve branch now inlines qr/validate's
// run-completion + reward + AIR reflection calls. Mock the four modules so the
// auto-approve test can verify they fire (and assertions are not weakened).
// vi.hoisted is required so the mock fns exist when the hoisted vi.mock
// factories run during module loading.
const {
  mockCompleteArenaRunAfterContractVerification,
  mockOnArenaRunCompleteVerified,
  mockApplyArenaRunRewardsOnVerifiedCompletion,
  mockReflectContractVerificationToAir,
} = vi.hoisted(() => ({
  mockCompleteArenaRunAfterContractVerification: vi
    .fn()
    .mockResolvedValue({ runUpdated: true, deferredQueued: false }),
  mockOnArenaRunCompleteVerified: vi.fn().mockResolvedValue({ ok: true }),
  mockApplyArenaRunRewardsOnVerifiedCompletion: vi
    .fn()
    .mockResolvedValue({ ok: true, applied: true, coreXp: 12, weeklyXp: 8, deltaApplied: 8 }),
  mockReflectContractVerificationToAir: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/bty/action-contract/actionContractLifecycle.server", () => ({
  completeArenaRunAfterContractVerification: (...args: unknown[]) =>
    mockCompleteArenaRunAfterContractVerification(...args),
}));
vi.mock("@/lib/bty/level-engine/arenaLevelRecords", () => ({
  onArenaRunCompleteVerified: (...args: unknown[]) =>
    mockOnArenaRunCompleteVerified(...args),
}));
vi.mock("@/lib/bty/arena/reflectionRewards.server", () => ({
  applyArenaRunRewardsOnVerifiedCompletion: (...args: unknown[]) =>
    mockApplyArenaRunRewardsOnVerifiedCompletion(...args),
  reflectContractVerificationToAir: (...args: unknown[]) =>
    mockReflectContractVerificationToAir(...args),
}));

/** Keys that must never appear in terminal outcomes (rationale / internal evaluation leakage). */
const FORBIDDEN_RATIONALE_KEYS = [
  "rationale",
  "rationale_text",
  "reasoning",
  "layer2_rationale",
  "internal_notes",
  "criteria",
  "layer2_criteria",
  "model_id",
  "confidence",
];

function makeSupabaseForContract(
  status: "pending" | "rejected" = "pending",
  options?: {
    verification_type?: string;
    verification_tier?: string | null;
    verification_status?: string | null;
    details?: Record<string, unknown> | null;
    onUpdate?: (payload: Record<string, unknown>) => void;
  },
) {
  const contractRow = {
    id: "contract-1",
    user_id: "user-1",
    status,
    pattern_family: null as string | null,
    arena_scenario_id: "sc1",
    session_id: "run-1",
    verification_type: options?.verification_type ?? "hybrid",
    // L6 dual-path gate reads these; default null so contracts without an explicit
    // tier/status fall through to Layer 2 (non-auto) unless a test sets them.
    verification_tier: options?.verification_tier ?? null,
    verification_status: options?.verification_status ?? null,
    details: options?.details ?? null,
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "arena_runs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { user_id: "user-1" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table !== "bty_action_contracts") {
        return {};
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: contractRow, error: null }),
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => {
              options?.onUpdate?.(payload);
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    }),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/bty/action-contract/submit-validation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bty/action-contract/submit-validation", () => {
  // STAB-01-P1: per-test env state save/restore. The 4-AND gate at
  // route.ts L253-282 reads process.env.SELF_REPORT_AUTO_APPROVE and
  // process.env.BTY_ENV; tests that mutate either must restore them so
  // global env does not leak across cases (MUT-2.5).
  let originalSelfReportAutoApprove: string | undefined;
  let originalBtyEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalSelfReportAutoApprove = process.env.SELF_REPORT_AUTO_APPROVE;
    originalBtyEnv = process.env.BTY_ENV;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSelfReportAutoApprove === undefined) {
      delete process.env.SELF_REPORT_AUTO_APPROVE;
    } else {
      process.env.SELF_REPORT_AUTO_APPROVE = originalSelfReportAutoApprove;
    }
    if (originalBtyEnv === undefined) {
      delete process.env.BTY_ENV;
    } else {
      process.env.BTY_ENV = originalBtyEnv;
    }
  });

  it("G-B06: returns multiple Layer 1 errors simultaneously (single response)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "they",
        what: "nothing",
        when: "later",
        how: "too short",
        raw_text: "This is the raw text line long enough for R6 to pass field presence.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      outcome?: string;
      layer1_errors?: { rule: string; signal: string }[];
    };
    expect(data.outcome).toBe("revise");
    expect(Array.isArray(data.layer1_errors)).toBe(true);
    expect(data.layer1_errors!.length).toBeGreaterThanOrEqual(2);
    const rules = new Set(data.layer1_errors!.map((e) => e.rule));
    expect(rules.has("R1")).toBe(true);
    expect(rules.has("R2")).toBe(true);
  });

  it("G-B07: approve response contains only outcome (no rationale keys)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    // STAB-06-FIX-03 (U1): approve now carries lifecycle discriminators
    // (contract_state / verified_at) — non-auto path is awaiting_qr. These are
    // not validator rationale; the forbidden-rationale guarantee below is unchanged.
    expect(Object.keys(data).sort()).toEqual(["contract_state", "outcome", "verified_at"]);
    expect(data.outcome).toBe("approve");
    expect(data.contract_state).toBe("awaiting_qr");
    expect(data.verified_at).toBeNull();
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("G-B07: reject response carries flow-control fields only (no rationale)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "reject",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "fail", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.8 },
        non_cosmetic: { outcome: "pass", confidence: 0.85 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    // Advisory landing (spec v2 §3.5): reject is no longer a dead-end — it carries the same
    // flow-control fields as approve (awaiting_qr progression class). Still no rationale keys.
    expect(Object.keys(data).sort()).toEqual(["contract_state", "outcome", "verified_at"]);
    expect(data.outcome).toBe("reject");
    expect(data.contract_state).toBe("awaiting_qr");
    expect(data.verified_at).toBeNull();
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("G-B07: escalate response carries flow-control fields only (no rationale)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending"),
      base: {},
    });

    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "ambiguous", confidence: 0.5 },
        external_measurability: { outcome: "pass", confidence: 0.8 },
        non_cosmetic: { outcome: "pass", confidence: 0.85 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    // Advisory landing (spec v2 §3.5): escalate no longer blocks — it carries the same
    // flow-control fields as approve (awaiting_qr progression class). Still no rationale keys.
    expect(Object.keys(data).sort()).toEqual(["contract_state", "outcome", "verified_at"]);
    expect(data.outcome).toBe("escalate");
    expect(data.contract_state).toBe("awaiting_qr");
    expect(data.verified_at).toBeNull();
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("sets submitted status first and does not complete on approve unless self_report auto-approve enabled", async () => {
    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "hybrid",
        details: {},
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Submit evidence",
        when: "2026-04-15 15:00",
        how: "Attach files",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("approve");
    expect(updates[0]).toMatchObject({ status: "submitted", submitted_at: expect.any(String) });
    expect(updates[1]).toMatchObject({
      status: "submitted",
      validation_approved_at: expect.any(String),
    });
    expect(updates[1]).not.toHaveProperty("verified_at");
    expect(updates[1]).not.toHaveProperty("completed_at");
  });

  it("L6 canonical: mvp_open + flag + env does NOT auto-approve (canonical removed) → awaiting_qr", async () => {
    // Spec v2 §3.5(B): canonical mvp_open auto-approve is REMOVED. Even with
    // verification_tier='mvp_open' + details.self_report_auto_approve=true AND both STAB-01
    // env terms satisfied, a canonical contract runs the evaluator and lands on
    // submitted + validation_approved_at (verified_at null → awaiting_qr → QR scan gates).
    // It does NOT complete inline; the four lifecycle/level/reward/AIR calls do NOT fire.
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    // MVP-FIX-ACTION-DEMO-05 (B): admin must be non-null for the inlined
    // run-completion + XP wiring to fire — override the getSupabaseAdmin
    // mock for this one test. The fake admin only needs a `.from()` chain
    // that resolves cleanly (the run_id backfill block uses it); the four
    // lifecycle/level/reward/AIR functions are module-mocked above and
    // don't actually touch admin.
    // Generic chainable fake covering admin.from(X).{update|insert|eq...}
    // patterns used by run_id backfill and logEvaluation. Each terminal
    // resolves to {error: null}; intermediate chain methods return self.
    const makeFakeAdmin = () => {
      const chain: Record<string, unknown> = {};
      const terminal = Promise.resolve({ error: null });
      chain.update = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockReturnValue(terminal);
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.then = (resolve: (v: { error: null }) => unknown) =>
        terminal.then(resolve);
      return { from: vi.fn().mockReturnValue(chain) };
    };
    const fakeAdmin = makeFakeAdmin();
    vi.mocked(getSupabaseAdmin).mockReturnValueOnce(
      fakeAdmin as unknown as ReturnType<typeof getSupabaseAdmin>,
    );
    // afterEach(restoreAllMocks) wipes the hoisted impls — re-set here per test.
    mockCompleteArenaRunAfterContractVerification.mockResolvedValue({
      runUpdated: true,
      deferredQueued: false,
    });
    mockOnArenaRunCompleteVerified.mockResolvedValue({ ok: true });
    mockApplyArenaRunRewardsOnVerifiedCompletion.mockResolvedValue({
      ok: true,
      applied: true,
      coreXp: 12,
      weeklyXp: 8,
      deltaApplied: 8,
    });
    mockReflectContractVerificationToAir.mockResolvedValue({ ok: true });
    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Self report completion",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    const approveBody = (await res.json()) as Record<string, unknown>;
    expect(approveBody.outcome).toBe("approve");
    // Canonical mvp_open is now awaiting_qr (NOT terminal) — verified_at null.
    expect(approveBody.contract_state).toBe("awaiting_qr");
    expect(approveBody.verified_at).toBeNull();
    expect(updates[1]).toMatchObject({
      status: "submitted",
      validation_approved_at: expect.any(String),
    });
    expect(updates[1]).not.toHaveProperty("verified_at");
    expect(updates[1]).not.toHaveProperty("completed_at");
    // Canonical contracts do NOT complete inline — qr/validate (scan) is the sole completion
    // path (spec v2 §3.5(B)). The four lifecycle/level/reward/AIR calls must NOT fire at submit.
    expect(mockCompleteArenaRunAfterContractVerification).not.toHaveBeenCalled();
    expect(mockOnArenaRunCompleteVerified).not.toHaveBeenCalled();
    expect(mockApplyArenaRunRewardsOnVerifiedCompletion).not.toHaveBeenCalled();
    expect(mockReflectContractVerificationToAir).not.toHaveBeenCalled();
  });

  it("L6 legacy: legacy_self_attest + self_attest + pending + env auto-approves to terminal", async () => {
    // Legacy protection OR-branch (pre-L2 contracts). TODO[L8-cleanup] removes this path.
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    const makeFakeAdmin = () => {
      const chain: Record<string, unknown> = {};
      const terminal = Promise.resolve({ error: null });
      chain.update = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockReturnValue(terminal);
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.then = (resolve: (v: { error: null }) => unknown) => terminal.then(resolve);
      return { from: vi.fn().mockReturnValue(chain) };
    };
    vi.mocked(getSupabaseAdmin).mockReturnValueOnce(
      makeFakeAdmin() as unknown as ReturnType<typeof getSupabaseAdmin>,
    );
    mockCompleteArenaRunAfterContractVerification.mockResolvedValue({
      runUpdated: true,
      deferredQueued: false,
    });
    mockOnArenaRunCompleteVerified.mockResolvedValue({ ok: true });
    mockApplyArenaRunRewardsOnVerifiedCompletion.mockResolvedValue({
      ok: true,
      applied: true,
      coreXp: 12,
      weeklyXp: 8,
      deltaApplied: 8,
    });
    mockReflectContractVerificationToAir.mockResolvedValue({ ok: true });
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "self_attest",
        verification_tier: "legacy_self_attest",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
      }),
      base: {},
    });
    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Legacy self-attest completion",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.outcome).toBe("approve");
    expect(body.contract_state).toBe("terminal");
  });

  it("L6: mvp_open + pending + env but NO self_report flag does NOT auto-approve (Site 4 draft α)", async () => {
    // Site 4 (draft-lifecycle) omits details.self_report_auto_approve (Commander §3.4 α).
    // The canonical path requires the flag → falls through to Layer 2.
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "pending",
        details: {},
      }),
      base: {},
    });
    const evalSpy = vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: null,
      modelId: null,
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Draft path, no auto-approve flag",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
  });

  it("L6: mvp_open + flag + env but verification_status NOT pending does NOT re-auto-approve", async () => {
    // Already-verified contract (verification_status='verified') must not re-auto-approve.
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "verified",
        details: { self_report_auto_approve: true },
      }),
      base: {},
    });
    const evalSpy = vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: null,
      modelId: null,
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Already verified contract",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
  });

  it("L6: legacy_self_attest + type=hybrid + pending does NOT auto-approve (legacy path requires self_attest)", async () => {
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "hybrid",
        verification_tier: "legacy_self_attest",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
      }),
      base: {},
    });
    const evalSpy = vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: null,
      modelId: null,
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Legacy hybrid contract",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
  });

  // STAB-01 negative case #1: missing env flag (defense-in-depth).
  // A fully-qualified canonical contract (mvp_open + pending + flag) must still
  // NOT auto-approve when SELF_REPORT_AUTO_APPROVE is unset — the route falls
  // through to evaluateActionContractPayload (Layer 2).
  it("does NOT auto-approve when SELF_REPORT_AUTO_APPROVE env flag is unset (STAB-01 defense)", async () => {
    delete process.env.SELF_REPORT_AUTO_APPROVE;
    process.env.BTY_ENV = "staging";

    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    const evalSpy = vi
      .spyOn(validation, "evaluateActionContractPayload")
      .mockResolvedValue({
        outcome: "escalate",
        layer1Errors: [],
        layer2Criteria: null,
        modelId: null,
        layer2TechnicalError: null,
      });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Self report completion",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
    const last = updates[updates.length - 1];
    // Advisory landing (spec v2 §3.5): escalate no longer writes a blocking 'escalated'
    // status — it lands on the same submitted + validation_approved_at progression class as
    // approve (verified_at null → QR scan gates). Not auto-approved (not terminal).
    expect(last).toMatchObject({
      status: "submitted",
      validation_approved_at: expect.any(String),
    });
    expect(last).not.toHaveProperty("verified_at");
  });

  // STAB-01 negative case #2: production env (D2 enforcement).
  // Even with SELF_REPORT_AUTO_APPROVE="true" and a fully-qualified canonical
  // contract, BTY_ENV must normalize to "staging" for the gate to satisfy.
  // Production worker (BTY_ENV="production") never auto-approves.
  it("does NOT auto-approve when BTY_ENV is production even if SELF_REPORT_AUTO_APPROVE is true", async () => {
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "production";

    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    const evalSpy = vi
      .spyOn(validation, "evaluateActionContractPayload")
      .mockResolvedValue({
        outcome: "escalate",
        layer1Errors: [],
        layer2Criteria: null,
        modelId: null,
        layer2TechnicalError: null,
      });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Self report completion",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
    const last = updates[updates.length - 1];
    // Advisory landing (spec v2 §3.5): escalate no longer writes a blocking 'escalated'
    // status — it lands on the same submitted + validation_approved_at progression class as
    // approve (verified_at null → QR scan gates). Not auto-approved (not terminal).
    expect(last).toMatchObject({
      status: "submitted",
      validation_approved_at: expect.any(String),
    });
    expect(last).not.toHaveProperty("verified_at");
  });

  // STAB-01 negative case #3: tier exclusion (Tier 2/3).
  // The L6 gate keys on verification_tier. member_only / manager_only contracts
  // require an external witness and never auto-approve — they route through
  // Layer 2 / QR witness verification regardless of the env terms or the flag.
  it("does NOT auto-approve member_only tier (Tier 2/3 excluded) regardless of env flag", async () => {
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";

    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "member_only",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    const evalSpy = vi
      .spyOn(validation, "evaluateActionContractPayload")
      .mockResolvedValue({
        outcome: "escalate",
        layer1Errors: [],
        layer2Criteria: null,
        modelId: null,
        layer2TechnicalError: null,
      });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "External witness verification path",
        when: "2026-04-15 15:00",
        how: "Witness signs receipt",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
    const last = updates[updates.length - 1];
    // Advisory landing (spec v2 §3.5): escalate no longer writes a blocking 'escalated'
    // status — it lands on the same submitted + validation_approved_at progression class as
    // approve (verified_at null → QR scan gates). Not auto-approved (not terminal).
    expect(last).toMatchObject({
      status: "submitted",
      validation_approved_at: expect.any(String),
    });
    expect(last).not.toHaveProperty("verified_at");
  });

  // ── qr-typed contracts under the L6 tier gate (verification_type="qr") ────
  // A qr-typed contract carries no auto-approve tier (neither mvp_open nor the
  // legacy_self_attest + self_attest legacy pair), so the L6 dual-path gate never
  // matches → qr contracts always route through Layer 2 and reach awaiting_qr
  // (Layer 2 pass) or escalated (Layer 2 fail) — never terminal.
  it("STAB-07-P0: qr does NOT auto-approve even with SELF_REPORT_AUTO_APPROVE=true (Layer 2 invoked, awaiting_qr not terminal)", async () => {
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";

    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "qr",
        details: { self_report_auto_approve: true },
      }),
      base: {},
    });
    const evalSpy = vi
      .spyOn(validation, "evaluateActionContractPayload")
      .mockResolvedValue({
        outcome: "approve",
        layer1Errors: [],
        layer2Criteria: {
          re_entry_direction: { outcome: "pass", confidence: 0.9 },
          external_measurability: { outcome: "pass", confidence: 0.9 },
          non_cosmetic: { outcome: "pass", confidence: 0.9 },
        },
        modelId: "gpt-4o-mini",
        layer2TechnicalError: null,
      });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Universal QR verification path",
        when: "2026-04-15 15:00",
        how: "Witness scans the QR receipt after the action",
        raw_text: "Raw evidence for the qr-gated contract.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    // qr carries no auto-approve tier → L6 gate fails → Layer 2 runs (auto-approve skipped).
    expect(evalSpy).toHaveBeenCalledTimes(1);
    expect(data.outcome).toBe("approve");
    expect(data.contract_state).toBe("awaiting_qr");
    expect(data.contract_state).not.toBe("terminal");
  });

  it("STAB-07-P0: qr Layer 2 pass → awaiting_qr (verified_at null)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "qr",
        details: { self_report_auto_approve: true },
      }),
      base: {},
    });
    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Schedule a 1:1 with the team lead to review the timeline",
        when: "2026-04-15 15:00",
        how: "Send a calendar invite with agenda bullets and confirm attendance by reply",
        raw_text: "Full raw text for audit purposes here.",
      }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.outcome).toBe("approve");
    expect(data.contract_state).toBe("awaiting_qr");
    expect(data.verified_at).toBeNull();
  });

  it("STAB-07-P0: qr Layer 2 fail → submitted (advisory, not escalated dead-end)", async () => {
    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "qr",
        details: { self_report_auto_approve: true },
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    const evalSpy = vi
      .spyOn(validation, "evaluateActionContractPayload")
      .mockResolvedValue({
        outcome: "escalate",
        layer1Errors: [],
        layer2Criteria: null,
        modelId: null,
        layer2TechnicalError: null,
      });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Universal QR verification path",
        when: "2026-04-15 15:00",
        how: "Witness scans the QR receipt after the action",
        raw_text: "Raw evidence for the qr-gated contract.",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    expect(evalSpy).toHaveBeenCalledTimes(1);
    const last = updates[updates.length - 1];
    // Advisory landing (spec v2 §3.5): escalate no longer writes a blocking 'escalated'
    // status — it lands on the same submitted + validation_approved_at progression class as
    // approve (verified_at null → QR scan gates). Not auto-approved (not terminal).
    expect(last).toMatchObject({
      status: "submitted",
      validation_approved_at: expect.any(String),
    });
    expect(last).not.toHaveProperty("verified_at");
  });

  it("escalate inserts an audit escalation row while the contract lands submitted (Q2 advisory, not blocking)", async () => {
    // Q2: escalate keeps writing bty_action_contract_escalations for audit, but the contract
    // lands `submitted` (advisory) — the row is informational (X-3), not a blocking gate.
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    const insertTables: string[] = [];
    const makeRecordingAdmin = () => {
      const makeChain = (table: string) => {
        const chain: Record<string, unknown> = {};
        const terminal = Promise.resolve({ error: null });
        chain.update = vi.fn().mockReturnValue(chain);
        chain.insert = vi.fn().mockImplementation(() => {
          insertTables.push(table);
          return terminal;
        });
        chain.eq = vi.fn().mockImplementation(() => chain);
        chain.then = (resolve: (v: { error: null }) => unknown) => terminal.then(resolve);
        return chain;
      };
      return { from: vi.fn().mockImplementation((table: string) => makeChain(table)) };
    };
    vi.mocked(getSupabaseAdmin).mockReturnValueOnce(
      makeRecordingAdmin() as unknown as ReturnType<typeof getSupabaseAdmin>,
    );
    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
        onUpdate: (payload) => updates.push(payload),
      }),
      base: {},
    });
    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: null,
      modelId: null,
      layer2TechnicalError: "layer2_timeout",
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Self report completion",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("escalate");
    const last = updates[updates.length - 1];
    expect(last).toMatchObject({ status: "submitted", validation_approved_at: expect.any(String) });
    expect(last).not.toHaveProperty("verified_at");
    expect(insertTables).toContain("bty_action_contract_escalations");
  });

  it("does NOT write le_verification_log at submit (two-phase D1 boundary)", async () => {
    // Spec D1: le_verification_log is the verification-event log. At submit time no
    // verification event exists (contract is submitted, not verified), so submit-validation
    // must never touch le_verification_log — the scan path (qr/validate) owns that write.
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";
    const fromTables: string[] = [];
    const makeRecordingAdmin = () => {
      const makeChain = () => {
        const chain: Record<string, unknown> = {};
        const terminal = Promise.resolve({ error: null });
        chain.update = vi.fn().mockReturnValue(chain);
        chain.insert = vi.fn().mockReturnValue(terminal);
        chain.eq = vi.fn().mockImplementation(() => chain);
        chain.then = (resolve: (v: { error: null }) => unknown) => terminal.then(resolve);
        return chain;
      };
      return {
        from: vi.fn().mockImplementation((table: string) => {
          fromTables.push(table);
          return makeChain();
        }),
      };
    };
    vi.mocked(getSupabaseAdmin).mockReturnValueOnce(
      makeRecordingAdmin() as unknown as ReturnType<typeof getSupabaseAdmin>,
    );
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "action_completed",
        verification_tier: "mvp_open",
        verification_status: "pending",
        details: { self_report_auto_approve: true },
      }),
      base: {},
    });
    vi.spyOn(validation, "evaluateActionContractPayload").mockResolvedValue({
      outcome: "approve",
      layer1Errors: [],
      layer2Criteria: {
        re_entry_direction: { outcome: "pass", confidence: 0.9 },
        external_measurability: { outcome: "pass", confidence: 0.9 },
        non_cosmetic: { outcome: "pass", confidence: 0.9 },
      },
      modelId: "gpt-4o-mini",
      layer2TechnicalError: null,
    });

    const res = await POST(
      makeRequest({
        contractId: "contract-1",
        who: "Alex Kim",
        what: "Self report completion",
        when: "2026-04-15 15:00",
        how: "Submit report",
        raw_text: "Raw evidence",
      }),
    );

    expect(res.status).toBe(200);
    // The route never touches le_verification_log directly, and the AIR reflection that
    // would write it must not fire for a canonical contract (scan-side carry-through only).
    expect(fromTables).not.toContain("le_verification_log");
    expect(mockReflectContractVerificationToAir).not.toHaveBeenCalled();
  });
});
