import { describe, expect, it, vi } from "vitest";
import { accrueNoChangeRisk, normalizeScenarioDecisionEventUser } from "./noChangeRisk.server";

function makeSupabaseMock(initialRiskCount = 0) {
  let riskCount = initialRiskCount;
  const rows = initialRiskCount > 0 ? [{ risk_count: initialRiskCount }] : [];

  const maybeSingle = vi.fn(async () => ({
    data: initialRiskCount > 0 ? { id: "r1", risk_count: initialRiskCount } : null,
    error: null,
  }));
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const insert = vi.fn(async () => ({ error: null }));
  const select = vi.fn((cols: string) => {
    const q: Record<string, unknown> = {};
    q.eq = vi.fn(() => q);
    q.maybeSingle = maybeSingle;
    q.then = cols === "id,risk_count"
      ? undefined
      : (resolve: (value: unknown) => void) =>
          Promise.resolve(resolve({ data: [{ risk_count: riskCount || 1 }, ...rows], error: null }));
    return q;
  });

  const from = vi.fn(() => ({
    select,
    update: (...args: unknown[]) => {
      riskCount = Number((args[0] as { risk_count?: number })?.risk_count ?? riskCount);
      return update(...args);
    },
    insert: (...args: unknown[]) => {
      riskCount = 1;
      return insert(...args);
    },
  }));

  return { supabase: { from } as unknown, from, update, insert, maybeSingle };
}

describe("noChangeRisk server accrual", () => {
  it("overrides event userId with authenticated user id", () => {
    const normalized = normalizeScenarioDecisionEventUser({ userId: "client_user", scenarioId: "s1" }, "auth_user");
    expect(normalized?.userId).toBe("auth_user");
  });

  it("accrues risk on AD2 event and sets threshold candidate true", async () => {
    const m = makeSupabaseMock(1);
    const result = await accrueNoChangeRisk(m.supabase as never, {
      userId: "u1",
      incidentId: "incident_01_small_compromise_to_trust_repair",
      scenarioId: "core_01_problem_framing",
      dbScenarioId: "INCIDENT-01-OWN-01",
      axisGroup: "Ownership",
      axisIndex: 1,
      secondPatternFamily: "future_deferral",
      actionChoiceId: "AD2",
      actionDbChoiceId: "INCIDENT-01-OWN-01_action_B_X_AD2",
      isActionCommitment: false,
      timestamp: "2026-04-27T01:00:00.000Z",
    });
    expect(result.riskCount).toBe(2);
    expect(result.reExposureDueCandidate).toBe(true);
  });

  it("does not require risk accrual for AD1 path (caller should skip)", async () => {
    const m = makeSupabaseMock(0);
    await expect(
      accrueNoChangeRisk(m.supabase as never, {
        userId: "u1",
        incidentId: "incident_01_small_compromise_to_trust_repair",
        scenarioId: "core_01_problem_framing",
        dbScenarioId: "INCIDENT-01-OWN-01",
        axisGroup: "Ownership",
        axisIndex: 1,
        secondPatternFamily: "ownership_act",
        actionChoiceId: "AD1",
        actionDbChoiceId: "INCIDENT-01-OWN-01_action_B_X_AD1",
        isActionCommitment: true,
      }),
    ).resolves.toMatchObject({ reExposureDueCandidate: false });
  });
});
