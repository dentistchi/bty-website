/**
 * Mirror pool sync — ineligible origin_scenario_id (mirror:|pswitch_) filtered before upsert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateMirror, getMirrorScenarios } from "./mirror-scenario.service";

function buildMirrorPoolMock(opts: {
  arenaEvents: { scenario_id: string; created_at: string }[];
  upsert?: ReturnType<typeof vi.fn>;
}) {
  const upsert = opts.upsert ?? vi.fn().mockResolvedValue({ data: null, error: null });

  const from = vi.fn((table: string) => {
    if (table === "arena_events") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: opts.arenaEvents, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "mirror_scenario_pool") {
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        upsert,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }
    return {};
  });

  return { from, upsert };
}

describe("mirror-scenario.service", () => {
  describe("getMirrorScenarios / syncMirrorPoolForUser", () => {
    it("does not upsert when recent CHOICE_CONFIRMED is only pswitch_ (filtered before upsert)", async () => {
      const { from, upsert } = buildMirrorPoolMock({
        arenaEvents: [{ scenario_id: "pswitch_ps_peer_1", created_at: new Date().toISOString() }],
      });
      await getMirrorScenarios("u1", { from } as unknown as SupabaseClient);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("upserts only eligible origins when mix includes pswitch_", async () => {
      const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const { from } = buildMirrorPoolMock({
        arenaEvents: [
          { scenario_id: "doctor_chronic_tension_v1", created_at: "2026-01-02T00:00:00.000Z" },
          { scenario_id: "pswitch_ps_peer_1", created_at: "2026-01-01T00:00:00.000Z" },
        ],
        upsert,
      });
      await getMirrorScenarios("u1", { from } as unknown as SupabaseClient);
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert.mock.calls[0][0]).toMatchObject({
        origin_scenario_id: "doctor_chronic_tension_v1",
      });
    });
  });

  describe("generateMirror", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("returns null and does not upsert when origin is pswitch_", async () => {
      const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const from = vi.fn(() => ({
        upsert,
      }));

      const out = await generateMirror(
        "u1",
        "pswitch_ps_peer_1",
        "A",
        { from } as unknown as SupabaseClient,
      );
      expect(out).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith("[generateMirror] Skipping ineligible origin:", "pswitch_ps_peer_1");
    });
  });
});
