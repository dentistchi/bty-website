import { describe, it, expect } from "vitest";
import {
  canRequestMentorSession,
  validateMentorRequestPayload,
  canTransitionStatus,
  MENTOR_REQUEST_MESSAGE_MAX_LENGTH,
  DEFAULT_MENTOR_ID,
} from "./mentorRequest";

describe("mentorRequest domain", () => {
  describe("canRequestMentorSession", () => {
    it("allows elite with no existing request", () => {
      expect(canRequestMentorSession(true, null)).toBe(true);
      expect(canRequestMentorSession(true, "approved")).toBe(true);
      expect(canRequestMentorSession(true, "rejected")).toBe(true);
    });
    it("denies when existing is pending", () => {
      expect(canRequestMentorSession(true, "pending")).toBe(false);
    });
    it("denies non-elite", () => {
      expect(canRequestMentorSession(false, null)).toBe(false);
      expect(canRequestMentorSession(false, "rejected")).toBe(false);
    });
  });

  describe("validateMentorRequestPayload", () => {
    it("accepts empty or null message", () => {
      expect(validateMentorRequestPayload(undefined).valid).toBe(true);
      expect(validateMentorRequestPayload(null).valid).toBe(true);
      expect(validateMentorRequestPayload("").valid).toBe(true);
      expect(validateMentorRequestPayload("  ").valid).toBe(true);
    });
    it("accepts message within max length", () => {
      const short = "hello";
      expect(validateMentorRequestPayload(short).valid).toBe(true);
      const max = "x".repeat(MENTOR_REQUEST_MESSAGE_MAX_LENGTH);
      expect(validateMentorRequestPayload(max).valid).toBe(true);
    });
    it("rejects message over max length", () => {
      const over = "x".repeat(MENTOR_REQUEST_MESSAGE_MAX_LENGTH + 1);
      const r = validateMentorRequestPayload(over);
      expect(r.valid).toBe(false);
      expect(r.error).toBe("message_too_long");
    });
  });

  describe("canTransitionStatus", () => {
    it("allows pending -> approved or rejected", () => {
      expect(canTransitionStatus("pending", "approved")).toBe(true);
      expect(canTransitionStatus("pending", "rejected")).toBe(true);
    });
    it("denies non-pending current", () => {
      expect(canTransitionStatus("approved", "rejected")).toBe(false);
      expect(canTransitionStatus("rejected", "approved")).toBe(false);
    });
    it("denies invalid next status", () => {
      expect(canTransitionStatus("pending", "pending")).toBe(false);
    });
  });

  it("DEFAULT_MENTOR_ID is dr_chi", () => {
    expect(DEFAULT_MENTOR_ID).toBe("dr_chi");
  });
});
