import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchMeWeeklyRhythm, ME_WEEKLY_RHYTHM_CARRIER } from "./meWeeklyRhythm";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (url: string) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("fetchMeWeeklyRhythm — Center self-return carrier (STEP 1C flip)", () => {
  it("fetches /api/me/daily-trace and NOT /api/arena/weekly-stats", async () => {
    const urls: string[] = [];
    stubFetch(async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ dailyTrace: [] }), { status: 200 });
    });
    await fetchMeWeeklyRhythm();
    expect(urls.some((u) => u.includes("/api/me/daily-trace"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/arena/weekly-stats"))).toBe(false);
  });

  it("maps exactly 7 dailyTrace entries into MeWeeklyRhythm (1 → soft light, 0 → 0)", async () => {
    const dailyTrace = [
      { date: "2026-07-03", intensity: 0 },
      { date: "2026-07-04", intensity: 1 },
      { date: "2026-07-05", intensity: 1 },
      { date: "2026-07-06", intensity: 1 },
      { date: "2026-07-07", intensity: 1 },
      { date: "2026-07-08", intensity: 0 },
      { date: "2026-07-09", intensity: 1 },
    ];
    stubFetch(async () => new Response(JSON.stringify({ dailyTrace }), { status: 200 }));
    const rhythm = await fetchMeWeeklyRhythm();
    expect(rhythm).toHaveLength(7);
    // presence pattern preserved (0 = rest, >0 = soft visible light), oldest → today
    expect(rhythm.map((v) => (v > 0 ? 1 : 0))).toEqual([0, 1, 1, 1, 1, 0, 1]);
    expect(rhythm[0]).toBe(0);
    expect(rhythm[6]).toBeGreaterThan(0);
  });

  it("consumes ONLY intensity — rogue count/streak fields never affect the mapping", async () => {
    const dailyTrace = [{ date: "2026-07-09", intensity: 1, count: 999, streak: 5, xp: 42 }];
    stubFetch(async () => new Response(JSON.stringify({ dailyTrace }), { status: 200 }));
    const rhythm = await fetchMeWeeklyRhythm();
    expect(rhythm).toHaveLength(1);
    expect(rhythm[0]).toBeGreaterThan(0);
  });

  it("fail-soft: non-ok response → [] (resting orb)", async () => {
    stubFetch(async () => new Response("no", { status: 500 }));
    expect(await fetchMeWeeklyRhythm()).toEqual([]);
  });

  it("fail-soft: thrown/transport error → [] (resting orb)", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    expect(await fetchMeWeeklyRhythm()).toEqual([]);
  });

  it("carrier marker names the Center daily-trace source, not Arena", () => {
    expect(ME_WEEKLY_RHYTHM_CARRIER).toContain("daily-trace");
    expect(ME_WEEKLY_RHYTHM_CARRIER).not.toContain("arena");
  });
});
