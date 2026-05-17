import { describe, expect, it } from "vitest";
import { patternShiftBandFromReexposure } from "@/domain/leadership-engine/patternShift";
import { computeReexposureValidation } from "./reexposureValidation.server";

describe("re-exposure validation (pattern shift closure)", () => {
  it("exit → entry crossing yields changed", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: true,
        priorExitPatternKey: "future_deferral|X",
        afterExitPatternKey: "ignored",
      }),
    ).toBe("changed");
  });

  it("same exit keys yields no_change", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "future_deferral|id1",
        afterExitPatternKey: "future_deferral|id1",
      }),
    ).toBe("no_change");
  });

  it("different exit keys yields unstable", () => {
    expect(
      patternShiftBandFromReexposure({
        reentryAsEntry: false,
        priorExitPatternKey: "future_deferral|id1",
        afterExitPatternKey: "repair_avoidance|id2",
      }),
    ).toBe("unstable");
  });
});

describe("computeReexposureValidation — fallback result_origin (Route B)", () => {
  /** arena_runs (no prior run) + arena_events (valid after-run second choice). */
  function makeSupabase() {
    return {
      from(table: string) {
        if (table === "arena_runs") {
          // resolvePriorRunIdForReexposure → empty → priorRunId null
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            neq: () => chain,
            order: () => chain,
            limit: async () => ({ data: [], error: null }),
          };
          return chain;
        }
        if (table === "arena_events") {
          // fetchSecondChoiceConfirmedRow → valid after-run row (direction entry)
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({
              data: {
                choice_id: "c1",
                meta: {
                  direction: "entry",
                  axis: "Ownership vs. Blame",
                  pattern_family: "blame_shift",
                },
              },
              error: null,
            }),
          };
          return chain;
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
  }

  it("no prior run → unstable band tagged result_origin insufficient_signal", async () => {
    const res = await computeReexposureValidation({
      supabase: makeSupabase() as never,
      userId: "u1",
      scenarioId: "scenario_not_in_elite_registry_zzz",
      reexposureRunId: "run-2",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // band itself is unchanged — still a PatternShiftBand value
      expect(res.payload.validation_result).toBe("unstable");
      // …but tagged as a fallback collapse, not measured evidence
      expect(res.payload.result_origin).toBe("insufficient_signal");
      expect(res.payload.insufficient_signal_reason).toBe("no_prior_run");
    }
  });
});
