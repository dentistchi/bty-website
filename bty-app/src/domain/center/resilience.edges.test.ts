/**
 * Center resilience 경계 케이스 보강 테스트.
 * 기존 resilience.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  energyToLevel,
  aggregateLetterRowsToDailyEntries,
  type LetterRow,
} from "./resilience";

describe("energyToLevel (edges)", () => {
  it("null and undefined → mid", () => {
    expect(energyToLevel(null)).toBe("mid");
    expect(energyToLevel(undefined)).toBe("mid");
  });
  it("0 → low (below range)", () => {
    expect(energyToLevel(0)).toBe("low");
  });
  it("1 → low (lower bound of low)", () => {
    expect(energyToLevel(1)).toBe("low");
  });
  it("-1 → low (negative)", () => {
    expect(energyToLevel(-1)).toBe("low");
  });
  it("2 → low (upper bound of low)", () => {
    expect(energyToLevel(2)).toBe("low");
  });
  it("4 → high (lower bound of high)", () => {
    expect(energyToLevel(4)).toBe("high");
  });
  it("5 → high (upper bound of high, letter energy 1–5)", () => {
    expect(energyToLevel(5)).toBe("high");
  });
  it("3 → mid (middle)", () => {
    expect(energyToLevel(3)).toBe("mid");
  });
  it("2.5 → mid (between low and high)", () => {
    expect(energyToLevel(2.5)).toBe("mid");
  });
  it("6 → high (above range)", () => {
    expect(energyToLevel(6)).toBe("high");
  });

  it("NaN → mid (treats as missing)", () => {
    expect(energyToLevel(NaN)).toBe("mid");
  });
});

describe("aggregateLetterRowsToDailyEntries (edges)", () => {
  it("empty rows returns empty array", () => {
    const entries = aggregateLetterRowsToDailyEntries([]);
    expect(entries).toEqual([]);
  });

  it("same day: later null energy keeps earlier non-null", () => {
    const rows: LetterRow[] = [
      { energy: 4, created_at: "2026-03-05T08:00:00Z" },
      { energy: null, created_at: "2026-03-05T20:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("high");
  });

  it("same day: later non-null overwrites earlier non-null", () => {
    const rows: LetterRow[] = [
      { energy: 5, created_at: "2026-03-05T08:00:00Z" },
      { energy: 1, created_at: "2026-03-05T20:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("low");
  });

  it("periodDays=1 returns only the latest date", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: 1 });
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe("2026-03-05");
  });

  it("periodDays=2 returns only the last two days by date", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-03T00:00:00Z" },
      { energy: 3, created_at: "2026-03-04T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: 2 });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-04", "2026-03-05"]);
  });

  it("rows in reverse date order still produce ascending entries", () => {
    const rows: LetterRow[] = [
      { energy: 5, created_at: "2026-03-10T00:00:00Z" },
      { energy: 3, created_at: "2026-03-08T00:00:00Z" },
      { energy: 1, created_at: "2026-03-06T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-06", "2026-03-08", "2026-03-10"]);
  });

  it("all rows null energy → all mid", () => {
    const rows: LetterRow[] = [
      { energy: null, created_at: "2026-03-01T00:00:00Z" },
      { energy: null, created_at: "2026-03-02T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries.every((e) => e.level === "mid")).toBe(true);
  });

  it("source is always 'letter'", () => {
    const rows: LetterRow[] = [
      { energy: 2, created_at: "2026-03-01T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries[0].source).toBe("letter");
  });

  it("periodDays greater than date span returns all entries", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-02T00:00:00Z" },
      { energy: 3, created_at: "2026-03-03T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: 30 });
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("periodDays 0 does not filter (returns all entries)", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: 0 });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-01", "2026-03-05"]);
  });

  it("periodDays 0 does not filter (all entries returned)", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: 0 });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-01", "2026-03-05"]);
  });

  it("periodDays negative does not filter (periodDays > 0 check)", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: -1 });
    expect(entries).toHaveLength(2);
  });

  it("options undefined (no second arg) returns all entries", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries).toHaveLength(2);
  });

  it("options empty object (no periodDays) returns all entries", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T00:00:00Z" },
      { energy: 5, created_at: "2026-03-05T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, {});
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-01", "2026-03-05"]);
  });
});
