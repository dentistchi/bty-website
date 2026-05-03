/**
 * AL-1.7 Phase 1 smoke tests — C5 verification gate.
 * Covers: BINDING_V1_SECOND meta, fetchSecondChoiceConfirmedRow .in() path,
 * patternSignatureUpsert skip warn, legacy event coexistence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertUserPatternSignatureFromValidation } from "./patternSignatureUpsert.server";
import { fetchSecondChoiceConfirmedRow } from "./reexposureValidation.server";
import type { ReexposureValidationPayload } from "./reexposureValidation.server";

// ---------------------------------------------------------------------------
// Item 4: skip warn log fires when pattern_family is null
// ---------------------------------------------------------------------------
describe("AL17-0 Item 4 — patternSignatureUpsert skip warn", () => {
  it("emits [pattern_signature][skip] warn and returns ok:true when after_pattern_family is null", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adminMock = { from: vi.fn() } as unknown as Parameters<typeof upsertUserPatternSignatureFromValidation>[0]["admin"];

    const payload: ReexposureValidationPayload = {
      scenario_id: "core_01",
      before_axis: "Ownership vs. Blame",
      before_pattern_family: null,
      before_second_choice_direction: null,
      before_exit_pattern_key: "",
      action_decision_commitment: "commit",
      after_axis: "Ownership vs. Blame",
      after_pattern_family: null,
      after_second_choice_direction: null,
      after_exit_pattern_key: "",
      validation_result: "no_change",
      axis_guard: "same_axis_ok",
      prior_run_id: null,
      reexposure_run_id: "run-1",
      recorded_at: new Date().toISOString(),
    };

    const result = await upsertUserPatternSignatureFromValidation({
      admin: adminMock,
      userId: "user-al17",
      payload,
      pendingOutcomeId: "pend-1",
      sourceChoiceHistoryId: "hist-1",
      nextWatchpointIso: null,
    });

    expect(result).toEqual({ ok: true });
    expect(warnSpy).toHaveBeenCalledWith(
      "[pattern_signature][skip]",
      expect.objectContaining({ userId: "user-al17" }),
    );
    // admin.from must NOT have been called (no DB access on skip path)
    expect(adminMock.from).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Item 2 + Item 5: fetchSecondChoiceConfirmedRow uses .in() and returns
// BINDING_V1_SECOND row when no SECOND_CHOICE_CONFIRMED exists
// ---------------------------------------------------------------------------
describe("AL17-0 Item 2+5 — fetchSecondChoiceConfirmedRow .in() query", () => {
  const makeSupabase = (returnData: unknown) => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_col2: string, _val2: unknown) => ({
            in: (_col3: string, _vals: unknown[]) => ({
              order: (_col4: string, _opts: unknown) => ({
                limit: (_n: number) => ({
                  maybeSingle: async () => ({ data: returnData, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  });

  it("returns null when BINDING_V1_SECOND row has no direction in meta", async () => {
    const supabase = makeSupabase({
      choice_id: "X",
      meta: { binding: "v1", binding_phase: "tradeoff" }, // no direction
    });
    const result = await fetchSecondChoiceConfirmedRow(supabase as never, "run-1");
    expect(result).toBeNull();
  });

  it("returns row with direction and pattern_family from BINDING_V1_SECOND meta", async () => {
    const supabase = makeSupabase({
      choice_id: "X",
      meta: {
        binding: "v1",
        binding_phase: "tradeoff",
        direction: "exit",
        pattern_family: "repair_avoidance",
      },
    });
    const result = await fetchSecondChoiceConfirmedRow(supabase as never, "run-2");
    expect(result).not.toBeNull();
    expect(result?.direction).toBe("exit");
    expect(result?.pattern_family).toBe("repair_avoidance");
    expect(result?.choice_id).toBe("X");
  });

  it("returns null when supabase returns no row (both event types absent)", async () => {
    const supabase = makeSupabase(null);
    const result = await fetchSecondChoiceConfirmedRow(supabase as never, "run-3");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Item 1: BINDING_V1_SECOND meta includes direction + pattern_family
// Structural invariant — verified by code review of choice/route.ts lines 774-776:
//   ...(binding_phase === "tradeoff" && tradeoffDirection
//     ? { direction: tradeoffDirection, pattern_family: tradeoffPatternFamily }
//     : {}),
// Full integration assertion: staging SQL after tradeoff run.
// ---------------------------------------------------------------------------
