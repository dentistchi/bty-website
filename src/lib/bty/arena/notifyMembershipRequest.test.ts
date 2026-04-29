import { describe, it, expect } from "vitest";
import {
  notifyMembershipRequestPending,
  type MembershipRequestPayload,
} from "./notifyMembershipRequest";

describe("notifyMembershipRequest", () => {
  describe("MembershipRequestPayload", () => {
    it("accepts required userEmail, jobFunction, joinedAt", () => {
      const payload: MembershipRequestPayload = {
        userEmail: "user@example.com",
        jobFunction: "doctor",
        joinedAt: "2026-01-15",
      };
      expect(payload.userEmail).toBe("user@example.com");
      expect(payload.jobFunction).toBe("doctor");
      expect(payload.joinedAt).toBe("2026-01-15");
    });

    it("accepts optional leaderStartedAt", () => {
      const payload: MembershipRequestPayload = {
        userEmail: "a@b.com",
        jobFunction: "hygienist",
        joinedAt: "2026-02-01",
        leaderStartedAt: "2025-06-01",
      };
      expect(payload.leaderStartedAt).toBe("2025-06-01");
    });
  });

  describe("notifyMembershipRequestPending", () => {
    it("resolves without throwing when called with valid payload", async () => {
      await expect(
        notifyMembershipRequestPending({
          userEmail: "test@example.com",
          jobFunction: "staff",
          joinedAt: "2026-03-01",
        })
      ).resolves.toBeUndefined();
    });

    it("resolves without throwing when leaderStartedAt is provided", async () => {
      await expect(
        notifyMembershipRequestPending({
          userEmail: "lead@example.com",
          jobFunction: "leader",
          joinedAt: "2026-01-01",
          leaderStartedAt: "2025-12-01",
        })
      ).resolves.toBeUndefined();
    });
  });
});
