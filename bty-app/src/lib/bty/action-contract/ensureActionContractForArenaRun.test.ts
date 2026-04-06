/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureActionContractForArenaRun } from "./ensureActionContractForArenaRun";

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const { getSupabaseAdmin } = await import("@/lib/supabase-admin");

describe("ensureActionContractForArenaRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSupabaseAdmin returns null → ok:false, created:false, console.error with KEY hint", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);

    const r = await ensureActionContractForArenaRun({
      userId: "u1",
      runId: "run-1",
      scenarioId: "sc-1",
      nbaLogId: null,
    });

    expect(r).toEqual({ ok: false, contractId: null, created: false });
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("CRITICAL"),
      expect.objectContaining({ userId: "u1", runId: "run-1" }),
    );
    expect(String(err.mock.calls[0]?.[0])).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    err.mockRestore();
  });

  it("returns ok:true, created:false when row already exists for user+session", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "existing-c", status: "pending" },
      error: null,
    });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle,
          }),
        }),
      }),
    }));
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never);

    const r = await ensureActionContractForArenaRun({
      userId: "u1",
      runId: "run-1",
      scenarioId: "sc-1",
      nbaLogId: null,
    });
    expect(r).toEqual({ ok: true, contractId: "existing-c", created: false });
    expect(from).toHaveBeenCalledWith("bty_action_contracts");
  });

  it("inserts and returns ok:true, created:true with contract id when pattern threshold family is set", async () => {
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingleSession = vi.fn().mockResolvedValue({ data: null, error: null });
    const singleInsert = vi.fn().mockResolvedValue({
      data: { id: "new-c" },
      error: null,
    });
    let selectCall = 0;
    const from = vi.fn((table: string) => {
      if (table !== "bty_action_contracts") return {};
      return {
        select: () => {
          selectCall += 1;
          if (selectCall === 1) {
            return {
              eq: () => ({
                eq: () => ({
                  in: () => ({ maybeSingle: maybeSingleOpen }),
                }),
              }),
            };
          }
          return {
            eq: () => ({
              eq: () => ({
                maybeSingle: maybeSingleSession,
              }),
            }),
          };
        },
        insert: () => ({
          select: () => ({
            single: singleInsert,
          }),
        }),
      };
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never);

    const r = await ensureActionContractForArenaRun({
      userId: "u1",
      runId: "run-1",
      scenarioId: "plain",
      nbaLogId: null,
      patternFamily: "ownership_escape",
    });
    expect(r).toEqual({ ok: true, contractId: "new-c", created: true });
  });

  it("on unique violation (23505), re-selects and returns created:false", async () => {
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const singleInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    const maybeSingleSession = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "race-c" }, error: null });
    let selectCall = 0;
    const from = vi.fn(() => ({
      select: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            eq: () => ({
              eq: () => ({
                in: () => ({ maybeSingle: maybeSingleOpen }),
              }),
            }),
          };
        }
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: maybeSingleSession,
            }),
          }),
        };
      },
      insert: () => ({
        select: () => ({
          single: singleInsert,
        }),
      }),
    }));
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never);

    const r = await ensureActionContractForArenaRun({
      userId: "u1",
      runId: "run-1",
      scenarioId: "plain",
      nbaLogId: null,
      patternFamily: "ownership_escape",
    });
    expect(r).toEqual({ ok: true, contractId: "race-c", created: false });
  });
});
