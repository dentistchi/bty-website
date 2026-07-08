/**
 * Diagnosis-class strip: GET /api/bty/my-page/state must NOT expose pattern_signatures
 * on the wire, even when the identity service still provides them internally.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

const mockGetMyPageIdentityState = vi.fn();
vi.mock("@/lib/bty/identity", () => ({
  getMyPageIdentityState: (...args: unknown[]) => mockGetMyPageIdentityState(...args),
}));

const { createSupabaseRouteClient } = await import("@/lib/supabase/server");

describe("GET /api/bty/my-page/state — pattern_signatures strip", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseRouteClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u-sig-1" } }, error: null }),
      },
    } as Awaited<ReturnType<typeof createSupabaseRouteClient>>);
  });

  it("returns 200 WITHOUT pattern_signatures even when identity state includes them", async () => {
    mockGetMyPageIdentityState.mockResolvedValue({
      ok: true,
      data: {
        metrics: { xp: 1, AIR: 0.5, TII: 0, relationalBias: 0, operationalBias: 0, emotionalRegulation: 0, signalCount: 0 },
        leadershipState: {
          codeName: "C5",
          stage: "s",
          headline: "h",
          airLabel: "a",
          tiiLabel: "t",
          rhythmLabel: "r",
          relationalLabel: "rel",
          operationalLabel: "op",
          emotionalLabel: "em",
          teamSignal: "ts",
          influencePattern: "ip",
          alignmentTrend: "at",
          nextFocus: "nf",
          nextCue: "nc",
        },
        recoveryTriggered: false,
        recoveryEntryCount: 0,
        signals: [],
        reflections: [],
        open_action_contract: null,
        pattern_signatures: [
          {
            pattern_family: "blame_shift",
            axis: "Blame vs. Structural Honesty",
            current_state: "stable",
            repeat_count: 2,
            last_validation_result: "changed",
            confidence_score: 0.75,
            next_watchpoint: null,
            last_seen_at: "2026-04-10T12:00:00.000Z",
            first_seen_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/bty/my-page/state?locale=en"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    // Diagnosis-class (pattern_signatures / current_state) must not reach the wire.
    expect("pattern_signatures" in json).toBe(false);
    expect(JSON.stringify(json)).not.toContain("current_state");
    expect(JSON.stringify(json)).not.toContain("blame_shift");

    // Payload minimization: raw signals[] and raw metric numerics must not reach the wire.
    expect("signals" in json).toBe(false);
    const metrics = json.metrics as Record<string, unknown>;
    expect(Object.keys(metrics)).toEqual(["signalCount"]);
    for (const raw of ["xp", "AIR", "TII", "relationalBias", "operationalBias", "emotionalRegulation"]) {
      expect(raw in metrics).toBe(false);
    }
  });
});
