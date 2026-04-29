/**
 * arenaLabDailyResetAt — UTC 다음 자정. XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import { arenaLabDailyResetAt } from "./arenaLabDailyResetAt";

describe("arenaLabDailyResetAt (edges)", () => {
  it("returns next UTC midnight for a typical instant", () => {
    const out = arenaLabDailyResetAt(new Date("2026-03-22T14:30:45.123Z"));
    expect(out.toISOString()).toBe("2026-03-23T00:00:00.000Z");
  });

  it("at exact UTC midnight, next reset is the following calendar day 00:00Z", () => {
    const out = arenaLabDailyResetAt(new Date("2026-03-22T00:00:00.000Z"));
    expect(out.toISOString()).toBe("2026-03-23T00:00:00.000Z");
  });

  it("last millisecond of UTC day rolls to next midnight", () => {
    const out = arenaLabDailyResetAt(new Date("2026-03-22T23:59:59.999Z"));
    expect(out.toISOString()).toBe("2026-03-23T00:00:00.000Z");
  });

  it("month/year rollover uses UTC date math (Mar 31 → Apr 1)", () => {
    const out = arenaLabDailyResetAt(new Date("2026-03-31T18:00:00.000Z"));
    expect(out.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  /**
   * DST: 동일한 **UTC** 규칙만 사용 — 미국 서머타임 전환일에도 결과는 항상 다음 UTC 자정.
   */
  it("is independent of local DST (fixed UTC next midnight)", () => {
    const out = arenaLabDailyResetAt(new Date("2024-03-10T12:00:00.000Z"));
    expect(out.toISOString()).toBe("2024-03-11T00:00:00.000Z");
  });

  /**
   * 음수 오프셋 ISO 문자열: 내부 UTC 인스턴트 기준으로 **UTC 날짜**의 다음 자정.
   */
  it("negative timezone offset in input still keys off UTC calendar day", () => {
    const out = arenaLabDailyResetAt(new Date("2026-07-04T20:00:00-07:00"));
    expect(out.toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("throws RangeError for Invalid Date", () => {
    expect(() => arenaLabDailyResetAt(new Date(Number.NaN))).toThrow(RangeError);
  });
});
