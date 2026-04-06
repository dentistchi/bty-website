/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolvePatternFamilyForContractTrigger } from "./resolvePatternFamilyForContractTrigger";

const syncMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock("./syncPatternStates", () => ({
  syncPatternStatesForUser: (...args: unknown[]) => syncMock(...args),
}));

describe("resolvePatternFamilyForContractTrigger", () => {
  beforeEach(() => {
    syncMock.mockResolvedValue({ ok: true });
  });

  it("returns null when sync fails", async () => {
    syncMock.mockResolvedValueOnce({ ok: false, error: "x" });
    const supabase = { from: vi.fn() } as never;
    const r = await resolvePatternFamilyForContractTrigger(supabase, "u1");
    expect(r).toBeNull();
    expect(syncMock).toHaveBeenCalled();
  });

  it("returns null when no family meets threshold", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ pattern_family: "ownership_escape", family_window_tally: 2, window_run_ids: [] }],
              error: null,
            }),
        }),
      }),
    } as never;
    const r = await resolvePatternFamilyForContractTrigger(supabase, "u1");
    expect(r).toBeNull();
  });

  it("returns sole family at threshold", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  pattern_family: "repair_avoidance",
                  family_window_tally: 3,
                  window_run_ids: ["a"],
                },
              ],
              error: null,
            }),
        }),
      }),
    } as never;
    const r = await resolvePatternFamilyForContractTrigger(supabase, "u1");
    expect(r).toBe("repair_avoidance");
  });

  it("tie-break: picks family with latest exit signal timestamp", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "pattern_states") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      pattern_family: "ownership_escape",
                      family_window_tally: 3,
                      window_run_ids: ["r1", "r2"],
                    },
                    {
                      pattern_family: "future_deferral",
                      family_window_tally: 3,
                      window_run_ids: ["r1", "r2"],
                    },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "pattern_signals") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    in: () =>
                      Promise.resolve({
                        data: [
                          {
                            pattern_family: "ownership_escape",
                            recorded_at: "2026-01-02T00:00:00.000Z",
                          },
                          {
                            pattern_family: "future_deferral",
                            recorded_at: "2026-01-03T00:00:00.000Z",
                          },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) };
      },
    } as never;
    const r = await resolvePatternFamilyForContractTrigger(supabase, "u1");
    expect(r).toBe("future_deferral");
  });
});
