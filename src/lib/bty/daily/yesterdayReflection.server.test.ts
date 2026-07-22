import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Slice 3.1B-3I — "From yesterday" reflection selection. Verifies the deterministic, timezone-aware
 * BTY-day-boundary filter (05:00 local rollover, via the real userDayKey) picks yesterday's MOST
 * RECENT eligible reflection and counts the rest. resolveUserTzContext + listUserFoundryHistory are
 * mocked; userDayKey is the real domain function so the boundary is genuinely exercised.
 */

const mockTz = vi.fn(async () => ({ timezone: "UTC", tzFallback: false }));
const mockHistory = vi.fn();

vi.mock("./userDay", () => ({ resolveUserTzContext: (...a: unknown[]) => mockTz(...a) }));
vi.mock("@/lib/bty/foundry/events/foundryHistoryService", () => ({
  listUserFoundryHistory: (...a: unknown[]) => mockHistory(...a),
}));

import { loadYesterdayReflection } from "./yesterdayReflection.server";

function item(entryId: string, completedAt: string, responseText = "text") {
  return { entryId, eventId: "e", eventTitle: "T", contentType: "youtube" as const, sharedUnderstanding: null, completedAt, responseText, responseExcerpt: "", aiReflection: null, aiReflectionLine: null, completionState: null };
}

beforeEach(() => {
  mockTz.mockReset().mockResolvedValue({ timezone: "UTC", tzFallback: false });
  mockHistory.mockReset();
});

describe("loadYesterdayReflection", () => {
  const admin = {} as never;
  const now = new Date("2026-07-22T12:00:00Z"); // today (UTC, after 05:00) → yesterday = 2026-07-21

  it("selects yesterday's MOST RECENT reflection and counts the rest (05:00 boundary)", async () => {
    // newest-first, as listUserFoundryHistory returns
    mockHistory.mockResolvedValue([
      item("today", "2026-07-22T06:00:00Z"),        // today → excluded
      item("y-late", "2026-07-21T23:00:00Z"),       // yesterday, most recent ✓
      item("y-early", "2026-07-21T08:00:00Z"),      // yesterday ✓
      item("pre-open", "2026-07-21T03:00:00Z"),     // 03:00 < 05:00 → belongs to 2026-07-20 → excluded
    ]);
    const r = await loadYesterdayReflection(admin, "u1", now, "UTC");
    expect(r?.entryId).toBe("y-late");
    expect(r?.additionalCount).toBe(1); // only y-early also counts
  });

  it("returns null when no reflection falls on the prior BTY day", async () => {
    mockHistory.mockResolvedValue([
      item("today", "2026-07-22T09:00:00Z"),
      item("older", "2026-07-19T09:00:00Z"),
    ]);
    expect(await loadYesterdayReflection(admin, "u1", now, "UTC")).toBeNull();
  });

  it("ignores empty reflections (no body → not eligible)", async () => {
    mockHistory.mockResolvedValue([item("y", "2026-07-21T10:00:00Z", "   ")]);
    expect(await loadYesterdayReflection(admin, "u1", now, "UTC")).toBeNull();
  });

  it("fail-soft: a read error yields null (Today never breaks)", async () => {
    mockHistory.mockRejectedValue(new Error("db"));
    expect(await loadYesterdayReflection(admin, "u1", now, "UTC")).toBeNull();
  });
});
