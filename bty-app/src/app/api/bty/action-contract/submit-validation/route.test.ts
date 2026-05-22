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

  it("G-B07: reject response contains only outcome", async () => {
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
    expect(Object.keys(data)).toEqual(["outcome"]);
    expect(data.outcome).toBe("reject");
    for (const k of FORBIDDEN_RATIONALE_KEYS) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("G-B07: escalate response contains only outcome", async () => {
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
    expect(Object.keys(data)).toEqual(["outcome"]);
    expect(data.outcome).toBe("escalate");
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

  it("auto-approves and completes for self_attest with self_report_auto_approve=true", async () => {
    // MVP-FIX-ACTION-DEMO-03 (A'): demo signal is verification_type=
    // 'self_attest' (admitted by CHECK enum); the flag name inside `details`
    // is intentionally preserved as `self_report_auto_approve` until the
    // post-demo label cleanup.
    // STAB-01-P1: the 4-AND gate also requires worker-level env conditions
    // (SELF_REPORT_AUTO_APPROVE="true" + BTY_ENV="staging"). Set both for
    // this positive case to satisfy the extended gate.
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
        verification_type: "self_attest",
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
    // STAB-06-FIX-03 (U1): auto-approve path is terminal — verified_at echoed back.
    expect(approveBody.contract_state).toBe("terminal");
    expect(typeof approveBody.verified_at).toBe("string");
    expect(updates[1]).toMatchObject({
      status: "approved",
      validation_approved_at: expect.any(String),
      verified_at: expect.any(String),
      completed_at: expect.any(String),
    });
    // MVP-FIX-ACTION-DEMO-05 (B): demo auto-approve must also drive run
    // completion and XP — the four lifecycle/level/reward/AIR calls should
    // fire exactly once each, mirroring qr/validate's awaitingVerification
    // branch. Assertions added (not weakened).
    expect(mockCompleteArenaRunAfterContractVerification).toHaveBeenCalledTimes(1);
    expect(mockOnArenaRunCompleteVerified).toHaveBeenCalledTimes(1);
    expect(mockApplyArenaRunRewardsOnVerifiedCompletion).toHaveBeenCalledTimes(1);
    expect(mockReflectContractVerificationToAir).toHaveBeenCalledTimes(1);
  });

  // STAB-01-P1 negative case #1: missing env flag.
  // Contract-level signals alone (self_attest + details.self_report_auto_approve=true)
  // are no longer sufficient under the 4-AND gate. Without
  // SELF_REPORT_AUTO_APPROVE="true" in process.env, the route must fall
  // through to evaluateActionContractPayload (Layer 2).
  it("does NOT auto-approve when SELF_REPORT_AUTO_APPROVE env flag is unset", async () => {
    delete process.env.SELF_REPORT_AUTO_APPROVE;
    process.env.BTY_ENV = "staging";

    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "self_attest",
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
    expect(last).toMatchObject({
      status: "escalated",
      escalated_at: expect.any(String),
    });
  });

  // STAB-01-P1 negative case #2: production env (D2 enforcement).
  // Even when SELF_REPORT_AUTO_APPROVE="true" leaks somehow, BTY_ENV must
  // also normalize to "staging" for the gate to satisfy. Production worker
  // (BTY_ENV="production") never auto-approves.
  it("does NOT auto-approve when BTY_ENV is production even if SELF_REPORT_AUTO_APPROVE is true", async () => {
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "production";

    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "self_attest",
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
    expect(last).toMatchObject({
      status: "escalated",
      escalated_at: expect.any(String),
    });
  });

  // STAB-01-P1 negative case #3: verification_type mismatch.
  // The contract-level verification_type AND-term in the 4-AND gate
  // preserves D3 — only self_attest contracts qualify. external_witness
  // (and any non-self_attest mode) continues to route through Layer 2 /
  // QR witness verification regardless of the env flag.
  it("does NOT auto-approve when verification_type is external_witness regardless of env flag", async () => {
    process.env.SELF_REPORT_AUTO_APPROVE = "true";
    process.env.BTY_ENV = "staging";

    const updates: Record<string, unknown>[] = [];
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: makeSupabaseForContract("pending", {
        verification_type: "external_witness",
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
    expect(last).toMatchObject({
      status: "escalated",
      escalated_at: expect.any(String),
    });
  });
});
