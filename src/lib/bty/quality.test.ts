import { describe, it, expect } from "vitest";
import {
  severityForReason,
  issueForReason,
  recordQualityEventApp,
  type QualityEventReason,
} from "./quality";

describe("quality", () => {
  describe("severityForReason", () => {
    it("returns high for error", () => {
      expect(severityForReason("error")).toBe("high");
    });

    it("returns medium for fallback, empty_response, timeout", () => {
      expect(severityForReason("fallback")).toBe("medium");
      expect(severityForReason("empty_response")).toBe("medium");
      expect(severityForReason("timeout")).toBe("medium");
    });

    it("returns low for low_quality", () => {
      expect(severityForReason("low_quality")).toBe("low");
    });
  });

  describe("issueForReason", () => {
    it("uses chat prefix when route is chat", () => {
      expect(issueForReason("fallback", "chat")).toMatch(/^chat_/);
      expect(issueForReason("error", "chat")).toMatch(/^chat_/);
      expect(issueForReason("low_quality", "chat")).toBe("chat_low_quality");
    });

    it("uses mentor prefix when route is mentor", () => {
      expect(issueForReason("fallback", "mentor")).toMatch(/^mentor_/);
      expect(issueForReason("error", "mentor")).toMatch(/^mentor_/);
      expect(issueForReason("low_quality", "mentor")).toBe("mentor_low_quality");
    });

    it("returns expected issue strings for chat route", () => {
      expect(issueForReason("fallback", "chat")).toBe(
        "chat_fallback: OpenAI unreachable or no key"
      );
      expect(issueForReason("empty_response", "chat")).toBe(
        "chat_empty: model returned no content"
      );
      expect(issueForReason("error", "chat")).toBe("chat_error: exception in handler");
      expect(issueForReason("timeout", "chat")).toBe(
        "chat_timeout: OpenAI request aborted after timeout"
      );
      expect(issueForReason("low_quality", "chat")).toBe("chat_low_quality");
    });

    it("returns expected issue strings for mentor route", () => {
      expect(issueForReason("fallback", "mentor")).toBe(
        "mentor_fallback: OpenAI unreachable or no key"
      );
      expect(issueForReason("empty_response", "mentor")).toBe(
        "mentor_empty: model returned no content"
      );
      expect(issueForReason("error", "mentor")).toBe("mentor_error: exception in handler");
      expect(issueForReason("timeout", "mentor")).toBe(
        "mentor_timeout: OpenAI request aborted after timeout"
      );
      expect(issueForReason("low_quality", "mentor")).toBe("mentor_low_quality");
    });
  });

  describe("recordQualityEventApp", () => {
    it("does not throw when called with valid payload", () => {
      expect(() =>
        recordQualityEventApp({ route: "chat", reason: "error" })
      ).not.toThrow();
      expect(() =>
        recordQualityEventApp({ route: "mentor", reason: "timeout", intent: "custom" })
      ).not.toThrow();
    });
  });
});
