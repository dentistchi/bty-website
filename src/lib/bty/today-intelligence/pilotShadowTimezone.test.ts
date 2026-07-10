/**
 * Pilot shadow — TIMEZONE threading (matrix §12: TIMEZONE 7–13). Synthetic, no DB.
 *
 * Drives assembleTodayMirrorPacket directly with injected signal inputs + injected brief, so the
 * client is never touched; the only variable under test is the threaded timezone.
 */
import { describe, it, expect } from "vitest";
import { assembleTodayMirrorPacket } from "@/lib/bty/today-intelligence/todayMirrorEvidence.server";
import { userDayKey } from "@/domain/daily/userDayKey";
import { CLEAN_BRIEF, SYNTH_TZ } from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";

const mockDb = { from() { throw new Error("no db in tz test"); } } as never;
const brief = CLEAN_BRIEF;

async function packet(now: Date, timezone: string | undefined, injected: Parameters<typeof assembleTodayMirrorPacket>[3] = {}) {
  return assembleTodayMirrorPacket(mockDb, "u1", now, injected, timezone === undefined ? { brief } : { timezone, brief });
}

describe("timezone threading", () => {
  it("7. configured timezone reaches the evidence assembler (userDay.timezone)", async () => {
    const p = await packet(new Date("2026-07-10T18:00:00Z"), SYNTH_TZ);
    expect(p.userDay.timezone).toBe(SYNTH_TZ);
    expect(p.userDay.boundaryHour).toBe(5);
  });

  it("8 + 12. configured tz reaches latency recency: same pair is IN-window under LA, OUT under UTC", async () => {
    const now = new Date("2026-07-10T06:00:00Z");
    const completions = [
      { id: "p", patternFamily: "future_deferral", chosenAt: "2026-06-20T10:00:00Z", verifiedAt: "2026-06-20T14:00:00Z", userId: "u1" },
      { id: "c", patternFamily: "future_deferral", chosenAt: "2026-07-03T04:00:00Z", verifiedAt: "2026-07-03T04:30:00Z", userId: "u1" },
    ];
    const la = await packet(now, "America/Los_Angeles", { completions });
    const utc = await packet(now, "UTC", { completions });
    // Under LA the latest completion is age 7 (inside the 7-day window) → signal emits.
    expect(la.derivedSignals.map((s) => s.code)).toContain("LATENCY_SHORTENED");
    // Under UTC the same completion is age 8 (outside) → held on the recency window, no signal.
    expect(utc.derivedSignals.map((s) => s.code)).not.toContain("LATENCY_SHORTENED");
    expect(utc.insufficientEvidence).toContain("LATENCY_OUTSIDE_RECENCY_WINDOW");
  });

  it("9. UTC is NOT silently substituted for a configured pilot timezone", async () => {
    const now = new Date("2026-07-10T18:00:00Z");
    const la = await packet(now, "America/Los_Angeles");
    expect(la.userDay.timezone).toBe("America/Los_Angeles");
    expect(la.userDay.timezone).not.toBe("UTC");
  });

  it("10. explicit fallback path (no tz) stays isolated → UTC; pilot tz does not leak into it", async () => {
    const now = new Date("2026-07-10T18:00:00Z");
    const fallback = await packet(now, undefined); // generic caller, documented UTC fallback
    const pilot = await packet(now, "America/Los_Angeles");
    expect(fallback.userDay.timezone).toBe("UTC");
    expect(pilot.userDay.timezone).toBe("America/Los_Angeles");
  });

  it("11. LA 04:59 and 05:01 map to DIFFERENT BTY user-days (UTC would not)", async () => {
    const before = new Date("2026-07-05T11:59:00Z"); // 04:59 LA
    const after = new Date("2026-07-05T12:01:00Z"); // 05:01 LA
    const pBefore = await packet(before, "America/Los_Angeles");
    const pAfter = await packet(after, "America/Los_Angeles");
    expect(pBefore.userDay.date).toBe("2026-07-04");
    expect(pAfter.userDay.date).toBe("2026-07-05");
    expect(pBefore.userDay.date).not.toBe(pAfter.userDay.date);
    // Same two instants under UTC fall in the SAME user-day (proves the split is tz-driven).
    const uBefore = await packet(before, "UTC");
    const uAfter = await packet(after, "UTC");
    expect(uBefore.userDay.date).toBe(uAfter.userDay.date);
  });

  it("13. DST-safe: 05:00 boundary is well-defined on the spring-forward day", async () => {
    // US spring-forward 2026-03-08 02:00→03:00 LA; the 05:00 user-day boundary has no gap/overlap.
    const now = new Date("2026-03-08T18:00:00Z"); // 10:00 LA, after the transition
    const p = await packet(now, "America/Los_Angeles");
    // The assembler's user-day date agrees with the canonical DST-safe key (no off-by-one / throw).
    expect(p.userDay.date).toBe(userDayKey(now, "America/Los_Angeles", 5));
    expect(p.userDay.date).toBe("2026-03-08");
  });
});
