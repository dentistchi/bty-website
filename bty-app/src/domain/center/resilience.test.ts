import { describe, it, expect } from "vitest";
import {
  energyToLevel,
  aggregateLetterRowsToDailyEntries,
  type LetterRow,
} from "./resilience";

describe("energyToLevel", () => {
  it("returns low for 1–2", () => {
    expect(energyToLevel(1)).toBe("low");
    expect(energyToLevel(2)).toBe("low");
  });
  it("returns mid for 3 or null", () => {
    expect(energyToLevel(3)).toBe("mid");
    expect(energyToLevel(null)).toBe("mid");
  });
  it("returns high for 4–5", () => {
    expect(energyToLevel(4)).toBe("high");
    expect(energyToLevel(5)).toBe("high");
  });
  it("returns mid for fractional 3.x (between 2 and 4)", () => {
    expect(energyToLevel(3.5)).toBe("mid");
  });
});

describe("aggregateLetterRowsToDailyEntries", () => {
  it("returns empty for empty rows", () => {
    expect(aggregateLetterRowsToDailyEntries([])).toEqual([]);
  });
  it("aggregates by date and uses last energy per day", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-03-01T10:00:00Z" },
      { energy: 5, created_at: "2026-03-01T20:00:00Z" },
      { energy: 3, created_at: "2026-03-02T12:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ date: "2026-03-01", level: "high", source: "letter" });
    expect(entries[1]).toMatchObject({ date: "2026-03-02", level: "mid", source: "letter" });
  });
  it("sorts by date ascending", () => {
    const rows: LetterRow[] = [
      { energy: 2, created_at: "2026-03-03T00:00:00Z" },
      { energy: 4, created_at: "2026-03-01T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-01", "2026-03-03"]);
  });
  it("filters by periodDays when provided", () => {
    const rows: LetterRow[] = [
      { energy: 1, created_at: "2026-02-28T00:00:00Z" },
      { energy: 2, created_at: "2026-03-01T00:00:00Z" },
      { energy: 3, created_at: "2026-03-02T00:00:00Z" },
      { energy: 4, created_at: "2026-03-03T00:00:00Z" },
    ];
    const entries = aggregateLetterRowsToDailyEntries(rows, { periodDays: 2 });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-03-02", "2026-03-03"]);
  });
  it("ignores invalid periodDays", () => {
    const rows: LetterRow[] = [{ energy: 3, created_at: "2026-03-01T00:00:00Z" }];
    expect(aggregateLetterRowsToDailyEntries(rows, { periodDays: 0 })).toHaveLength(1);
    expect(aggregateLetterRowsToDailyEntries(rows, { periodDays: -1 })).toHaveLength(1);
  });
});
