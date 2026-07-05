import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateDailyGate } from "./dailyGateCheck";
import { userHasForcedResetPending } from "@/lib/bty/leadership-engine/state-service";
import { fetchBlockingArenaContractForSession } from "@/lib/bty/arena/blockingArenaActionContract";
import { fetchFirstDueNoChangeReexposureMeta } from "@/engine/scenario/delayed-outcome-trigger.service";
import { getOnboardingStep } from "@/engine/integration/onboarding-flow.service";

// Mock the non-evidence gate sources. `relationshipPulse` is NOT mocked — Gates 4/5 run
// the real `hasAnyEvidenceInWindow` against the `sbEvidence` stub, so 3-domain routing is
// exercised end-to-end (Commander Flag 1 = b).
vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  userHasForcedResetPending: vi.fn(),
}));
vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  fetchBlockingArenaContractForSession: vi.fn(),
}));
vi.mock("@/engine/scenario/delayed-outcome-trigger.service", () => ({
  fetchFirstDueNoChangeReexposureMeta: vi.fn(),
}));
vi.mock("@/engine/integration/onboarding-flow.service", () => ({
  getOnboardingStep: vi.fn(),
}));

const NOW = new Date("2026-07-02T09:00:00.000Z");
const YESTERDAY = "2026-07-01T12:00:00.000Z"; // inside [07-01T00:00, 07-02T00:00)
const DAYS_AGO_5 = "2026-06-28T12:00:00.000Z"; // in 14d window, not yesterday

/**
 * Evidence stub: per-table ISO timestamps. Emulates the head+count query used by
 * countInWindow — captures gte(since)/lt(until) and counts rows in [since, until).
 */
function sbEvidence(rowsByTable: Record<string, string[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      let since: string | undefined;
      let until: string | undefined;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        gte: (_c: string, v: string) => {
          since = v;
          return builder;
        },
        lt: (_c: string, v: string) => {
          until = v;
          return builder;
        },
        then: (resolve: (r: { count: number; error: null }) => unknown, reject?: (e: unknown) => unknown) => {
          const count = rows.filter(
            (ts) => (since === undefined || ts >= since) && (until === undefined || ts < until),
          ).length;
          return Promise.resolve({ count, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const NO_EVIDENCE = sbEvidence({});

function onboardingState(isComplete: boolean) {
  return {
    userId: "u1",
    highestCompleted: isComplete ? 5 : 1,
    nextStep: isComplete ? null : 2,
    isComplete,
    completedAt: isComplete ? "2026-06-01T00:00:00.000Z" : null,
  };
}

beforeEach(() => {
  vi.mocked(userHasForcedResetPending).mockResolvedValue(false);
  vi.mocked(fetchBlockingArenaContractForSession).mockResolvedValue(null);
  vi.mocked(fetchFirstDueNoChangeReexposureMeta).mockResolvedValue(null);
  // Default: onboarding complete → not a new user.
  vi.mocked(getOnboardingStep).mockResolvedValue(onboardingState(true) as never);
});

const blockingRow = {
  id: "c1",
  contract_description: "do the thing",
  deadline_at: "2026-07-03T00:00:00.000Z",
  verification_mode: "qr",
  verification_type: "qr",
  created_at: "2026-07-01T00:00:00.000Z",
  status: "pending",
  validation_approved_at: null,
  verified_at: null,
};

describe("evaluateDailyGate — ordering (Scope Lock §5)", () => {
  it("FORCED_RESET wins over an open action contract", async () => {
    vi.mocked(userHasForcedResetPending).mockResolvedValue(true);
    vi.mocked(fetchBlockingArenaContractForSession).mockResolvedValue(blockingRow);
    const r = await evaluateDailyGate(sbEvidence({ center_letters: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("FORCED_RESET");
    expect(r.destination.kind).toBe("center");
  });

  it("ACTION_REQUIRED wins over a due re-exposure", async () => {
    vi.mocked(fetchBlockingArenaContractForSession).mockResolvedValue(blockingRow);
    vi.mocked(fetchFirstDueNoChangeReexposureMeta).mockResolvedValue({
      scenarioId: "s1",
      pendingOutcomeId: "p1",
    });
    const r = await evaluateDailyGate(NO_EVIDENCE, "u1", NOW);
    expect(r.gate).toBe("ACTION_REQUIRED");
    expect(r.context?.contractId).toBe("c1");
  });

  it("REEXPOSURE_DUE wins over yesterday evidence", async () => {
    vi.mocked(fetchFirstDueNoChangeReexposureMeta).mockResolvedValue({
      scenarioId: "s1",
      pendingOutcomeId: "p1",
    });
    const r = await evaluateDailyGate(sbEvidence({ center_letters: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("REEXPOSURE_DUE");
    expect(r.context?.reexposureId).toBe("p1");
  });

  it("YESTERDAY_MIRROR wins over quiet invitation", async () => {
    // Yesterday row also lands inside the 14-day window, but Gate 4 short-circuits.
    const r = await evaluateDailyGate(sbEvidence({ center_letters: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("YESTERDAY_MIRROR");
  });

  it("QUIET_INVITATION wins over first-day ritual", async () => {
    vi.mocked(getOnboardingStep).mockResolvedValue(onboardingState(false) as never);
    const r = await evaluateDailyGate(sbEvidence({ arena_runs: [DAYS_AGO_5] }), "u1", NOW);
    expect(r.gate).toBe("QUIET_INVITATION");
  });
});

describe("evaluateDailyGate — Gates 4/5 full 3-domain evidence (Flag 1 = b)", () => {
  it("self-only yesterday evidence → YESTERDAY_MIRROR", async () => {
    const r = await evaluateDailyGate(sbEvidence({ center_letters: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("YESTERDAY_MIRROR");
  });

  it("others-only (Arena) yesterday evidence → YESTERDAY_MIRROR", async () => {
    const r = await evaluateDailyGate(sbEvidence({ arena_runs: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("YESTERDAY_MIRROR");
  });

  it("ground-only (Foundry) yesterday evidence → YESTERDAY_MIRROR", async () => {
    const r = await evaluateDailyGate(sbEvidence({ user_dojo_attempts: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("YESTERDAY_MIRROR");
  });

  it("no yesterday evidence but 14-day evidence → QUIET_INVITATION", async () => {
    const r = await evaluateDailyGate(sbEvidence({ arena_runs: [DAYS_AGO_5] }), "u1", NOW);
    expect(r.gate).toBe("QUIET_INVITATION");
  });

  it("no evidence + incomplete onboarding → FIRST_DAY", async () => {
    vi.mocked(getOnboardingStep).mockResolvedValue(onboardingState(false) as never);
    const r = await evaluateDailyGate(NO_EVIDENCE, "u1", NOW);
    expect(r.gate).toBe("FIRST_DAY");
  });

  it("no evidence + complete onboarding → OPEN_DAY", async () => {
    const r = await evaluateDailyGate(NO_EVIDENCE, "u1", NOW);
    expect(r.gate).toBe("OPEN_DAY");
  });
});

describe("evaluateDailyGate — canonical 05:00-local day boundary (D1 STEP 1)", () => {
  // NOW = 2026-07-02T09:00:00Z. Canonical UTC user-day: [07-02T05:00Z, 07-03T05:00Z);
  // yesterday: [07-01T05:00Z, 07-02T05:00Z). An event at 03:00Z is BEFORE the 05:00 open hour
  // → it belongs to YESTERDAY, whereas the old UTC-midnight logic would have called it "today".
  it("pre-05:00 evidence counts as yesterday, not today (tz=UTC injected)", async () => {
    const r = await evaluateDailyGate(
      sbEvidence({ center_letters: ["2026-07-02T03:00:00.000Z"] }),
      "u1",
      NOW,
      "UTC",
    );
    expect(r.gate).toBe("YESTERDAY_MIRROR");
  });

  it("explicit userTz overrides profile resolution (Asia/Seoul yesterday window)", async () => {
    // 2026-07-01T15:00Z == 00:00 KST 07-02 → before 05:00 KST → KST yesterday user-day.
    const r = await evaluateDailyGate(
      sbEvidence({ arena_runs: ["2026-07-01T15:00:00.000Z"] }),
      "u1",
      NOW,
      "Asia/Seoul",
    );
    expect(r.gate).toBe("YESTERDAY_MIRROR");
  });

  it("no evidence still resolves to OPEN_DAY under an injected tz", async () => {
    const r = await evaluateDailyGate(NO_EVIDENCE, "u1", NOW, "Asia/Seoul");
    expect(r.gate).toBe("OPEN_DAY");
  });
});

describe("evaluateDailyGate — failure behavior (§ fail-quiet, no 500)", () => {
  it("Gate 1 open-on-failure: helper false result → proceeds, no center lockout", async () => {
    // userHasForcedResetPending returns false on db error (its own open-on-failure contract);
    // the gate must proceed rather than lock to Center.
    vi.mocked(userHasForcedResetPending).mockResolvedValue(false);
    const r = await evaluateDailyGate(NO_EVIDENCE, "u1", NOW);
    expect(r.gate).not.toBe("FORCED_RESET");
    expect(r.gate).toBe("OPEN_DAY");
  });

  it("a throwing action-contract source is swallowed (fall-through, no throw)", async () => {
    vi.mocked(fetchBlockingArenaContractForSession).mockRejectedValue(new Error("boom"));
    const r = await evaluateDailyGate(sbEvidence({ arena_runs: [YESTERDAY] }), "u1", NOW);
    expect(r.gate).toBe("YESTERDAY_MIRROR"); // fell through to evidence, never threw
  });

  it("a throwing onboarding source degrades to OPEN_DAY (not a hard error)", async () => {
    vi.mocked(getOnboardingStep).mockRejectedValue(new Error("boom"));
    const r = await evaluateDailyGate(NO_EVIDENCE, "u1", NOW);
    expect(r.gate).toBe("OPEN_DAY");
  });

  it("evaluateDailyGate resolves (never rejects) even when every source throws", async () => {
    vi.mocked(userHasForcedResetPending).mockRejectedValue(new Error("x"));
    vi.mocked(fetchBlockingArenaContractForSession).mockRejectedValue(new Error("x"));
    vi.mocked(fetchFirstDueNoChangeReexposureMeta).mockRejectedValue(new Error("x"));
    vi.mocked(getOnboardingStep).mockRejectedValue(new Error("x"));
    const throwingSb = {
      from() {
        throw new Error("db down");
      },
    } as unknown as SupabaseClient;
    // userHasForcedResetPending is not wrapped (it owns open-on-failure); mock it safe here.
    vi.mocked(userHasForcedResetPending).mockResolvedValue(false);
    await expect(evaluateDailyGate(throwingSb, "u1", NOW)).resolves.toHaveProperty("gate");
  });
});
