/**
 * Edge-case tests for mentorRequest (Arena 3차 — 미커버 1모듈).
 * 상수·경계만 검증. 기존 동작만 검증, 비즈니스/XP 로직 변경 금지.
 */
import { describe, it, expect } from "vitest";
import {
  MENTOR_REQUEST_STATUSES,
  DEFAULT_MENTOR_ID,
  MENTOR_REQUEST_MESSAGE_MAX_LENGTH,
  canTransitionStatus,
} from "./mentorRequest";

describe("mentorRequest (edges)", () => {
  it("MENTOR_REQUEST_STATUSES has pending, approved, rejected", () => {
    expect(MENTOR_REQUEST_STATUSES).toContain("pending");
    expect(MENTOR_REQUEST_STATUSES).toContain("approved");
    expect(MENTOR_REQUEST_STATUSES).toContain("rejected");
    expect(MENTOR_REQUEST_STATUSES).toHaveLength(3);
  });

  it("DEFAULT_MENTOR_ID is dr_chi", () => {
    expect(DEFAULT_MENTOR_ID).toBe("dr_chi");
  });

  it("MENTOR_REQUEST_MESSAGE_MAX_LENGTH is 500", () => {
    expect(MENTOR_REQUEST_MESSAGE_MAX_LENGTH).toBe(500);
  });

  it("canTransitionStatus denies non-pending -> any", () => {
    expect(canTransitionStatus("approved", "rejected")).toBe(false);
    expect(canTransitionStatus("rejected", "approved")).toBe(false);
    expect(canTransitionStatus("approved", "approved")).toBe(false);
  });

  it("canTransitionStatus allows pending -> approved and pending -> rejected", () => {
    expect(canTransitionStatus("pending", "approved")).toBe(true);
    expect(canTransitionStatus("pending", "rejected")).toBe(true);
  });
});
