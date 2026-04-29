import { describe, it, expect } from "vitest";
import { arenaLeaderboardMondayUtcFromDate } from "./arenaLeaderboardMondayUtcFromDate";

describe("arenaLeaderboardMondayUtcFromDate (edges)", () => {
  it("maps Wednesday mid-week to that week’s Monday UTC", () => {
    expect(arenaLeaderboardMondayUtcFromDate(new Date("2025-03-12T12:00:00.000Z"))).toBe(
      "2025-03-10",
    );
  });

  it("maps Sunday to the Monday that started the same ISO week", () => {
    expect(arenaLeaderboardMondayUtcFromDate(new Date("2025-03-16T12:00:00.000Z"))).toBe(
      "2025-03-10",
    );
  });

  it("returns the same YYYY-MM-DD when input is already Monday UTC", () => {
    expect(arenaLeaderboardMondayUtcFromDate(new Date("2025-03-10T00:00:00.000Z"))).toBe(
      "2025-03-10",
    );
  });

  it("handles year boundary (Wednesday Jan 1 → prior December Monday)", () => {
    expect(arenaLeaderboardMondayUtcFromDate(new Date("2025-01-01T12:00:00.000Z"))).toBe(
      "2024-12-30",
    );
  });

  it("handles month boundary within same week", () => {
    expect(arenaLeaderboardMondayUtcFromDate(new Date("2025-03-02T12:00:00.000Z"))).toBe(
      "2025-02-24",
    );
  });
});
