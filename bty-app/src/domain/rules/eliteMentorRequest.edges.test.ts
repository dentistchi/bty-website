/**
 * Elite 멘토 큐 — 수치·SLA 경계 (SPRINT 55 TASK 8 / 261 C3).
 */
import { describe, it, expect } from "vitest";
import {
  isEliteMentorApprovedActiveAtCap,
  canEliteMentorApproveWithoutCapViolation,
  eliteMentorResponseSlaWarningKey,
  isEliteMentorRequestPendingStale,
  ELITE_MENTOR_PENDING_STALE_DAYS,
  ELITE_MENTOR_APPROVED_ACTIVE_CAP,
  compareEliteMentorQueueRows,
} from "./eliteMentorRequest";

const MS_DAY = 86_400_000;

describe("eliteMentorRequest edges (261)", () => {
  it("approved cap: negative and fractional counts floor toward cap", () => {
    expect(isEliteMentorApprovedActiveAtCap(-1)).toBe(false);
    expect(isEliteMentorApprovedActiveAtCap(4.9)).toBe(false);
    expect(isEliteMentorApprovedActiveAtCap(ELITE_MENTOR_APPROVED_ACTIVE_CAP)).toBe(true);
    expect(canEliteMentorApproveWithoutCapViolation(ELITE_MENTOR_APPROVED_ACTIVE_CAP)).toBe(
      false
    );
  });

  it("SLA warning: non-pending or invalid time → null", () => {
    const now = Date.now();
    expect(eliteMentorResponseSlaWarningKey("approved", now, now)).toBeNull();
    expect(
      eliteMentorResponseSlaWarningKey("pending", Number.NaN, now)
    ).toBeNull();
  });

  it("pending stale: exactly 14 days not stale; 14d+1ms stale", () => {
    const now = 1_000_000_000_000;
    const created = now - ELITE_MENTOR_PENDING_STALE_DAYS * MS_DAY;
    expect(isEliteMentorRequestPendingStale("pending", created, now)).toBe(false);
    expect(isEliteMentorRequestPendingStale("pending", created - 1, now)).toBe(true);
  });

  it("compareEliteMentorQueueRows: same priority and createdAt → id lexicographic", () => {
    const a = { status: "pending" as const, createdAtMs: 100, id: "b" };
    const b = { status: "pending" as const, createdAtMs: 100, id: "a" };
    expect(compareEliteMentorQueueRows(a, b)).toBeGreaterThan(0);
  });
});
