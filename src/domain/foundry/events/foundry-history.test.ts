import { describe, it, expect } from "vitest";
import {
  isHistoricalEventStatus,
  compareHistoryRecency,
  historyParticipationCounts,
  FOUNDRY_HISTORY_TERMINAL_STATUSES,
  type HistoryOrderable,
} from "./foundry-history";

describe("foundry history — qualification", () => {
  it("only `closed` qualifies as historical", () => {
    expect(isHistoricalEventStatus("closed")).toBe(true);
    expect(isHistoricalEventStatus("open")).toBe(false);
  });

  it("unknown/legacy statuses are non-historical (never thrown)", () => {
    expect(isHistoricalEventStatus("cancelled")).toBe(false);
    expect(isHistoricalEventStatus("expired")).toBe(false);
    expect(isHistoricalEventStatus("")).toBe(false);
  });

  it("terminal-status set is exactly [closed] in V1", () => {
    expect([...FOUNDRY_HISTORY_TERMINAL_STATUSES]).toEqual(["closed"]);
  });
});

describe("foundry history — ordering", () => {
  const mk = (id: string, endedAt: string | null, createdAt: string): HistoryOrderable => ({
    eventId: id,
    endedAt,
    createdAt,
  });

  it("sorts most-recently-ended first", () => {
    const rows = [
      mk("a", "2026-07-10T00:00:00.000Z", "2026-07-01T00:00:00.000Z"),
      mk("b", "2026-07-15T00:00:00.000Z", "2026-07-02T00:00:00.000Z"),
      mk("c", "2026-07-12T00:00:00.000Z", "2026-07-03T00:00:00.000Z"),
    ];
    expect([...rows].sort(compareHistoryRecency).map((r) => r.eventId)).toEqual(["b", "c", "a"]);
  });

  it("falls back to createdAt when endedAt is null (null ends sort last)", () => {
    const rows = [
      mk("a", null, "2026-07-20T00:00:00.000Z"),
      mk("b", "2026-07-15T00:00:00.000Z", "2026-07-02T00:00:00.000Z"),
      mk("c", null, "2026-07-25T00:00:00.000Z"),
    ];
    // both null-ended sort after the ended one; among nulls, newer createdAt first.
    expect([...rows].sort(compareHistoryRecency).map((r) => r.eventId)).toEqual(["b", "c", "a"]);
  });

  it("is deterministic on identical timestamps (id asc tie-break)", () => {
    const t = "2026-07-15T00:00:00.000Z";
    const rows = [mk("z", t, t), mk("a", t, t), mk("m", t, t)];
    expect([...rows].sort(compareHistoryRecency).map((r) => r.eventId)).toEqual(["a", "m", "z"]);
  });
});

describe("foundry history — participation counts", () => {
  it("computes incomplete honestly", () => {
    expect(historyParticipationCounts(5, 3)).toEqual({
      participantCount: 5,
      completionCount: 3,
      incompleteCount: 2,
    });
  });

  it("zero participants behaves honestly (no negative, no rate)", () => {
    expect(historyParticipationCounts(0, 0)).toEqual({
      participantCount: 0,
      completionCount: 0,
      incompleteCount: 0,
    });
  });

  it("completions exceeding joined => incomplete is null, never negative", () => {
    expect(historyParticipationCounts(2, 3)).toEqual({
      participantCount: 2,
      completionCount: 3,
      incompleteCount: null,
    });
  });

  it("guards non-finite / negative inputs", () => {
    expect(historyParticipationCounts(-1, Number.NaN)).toEqual({
      participantCount: 0,
      completionCount: 0,
      incompleteCount: 0,
    });
  });
});
