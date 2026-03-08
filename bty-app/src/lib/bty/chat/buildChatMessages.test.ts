/**
 * buildChatMessages — normalizeMode, getFallbackMessage, RAG 의도/키워드 주입 연동 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { normalizeMode, getFallbackMessage, buildChatMessagesForModel } from "./buildChatMessages";

describe("buildChatMessages", () => {
  describe("normalizeMode", () => {
    it("returns bodyMode when center | foundry | arena", () => {
      expect(normalizeMode("center", "")).toBe("center");
      expect(normalizeMode("foundry", "")).toBe("foundry");
      expect(normalizeMode("arena", "")).toBe("arena");
    });
    it("maps today-me and dearme to center", () => {
      expect(normalizeMode("today-me", "")).toBe("center");
      expect(normalizeMode("dearme", "")).toBe("center");
    });
    it("maps bty and dojo to foundry", () => {
      expect(normalizeMode("bty", "")).toBe("foundry");
      expect(normalizeMode("dojo", "")).toBe("foundry");
    });
    it("infers center from user content when bodyMode not a known mode", () => {
      expect(normalizeMode(null, "불안해")).toBe("center");
      expect(normalizeMode(undefined, "안전한 곳")).toBe("center");
    });
    it("infers foundry from user content", () => {
      expect(normalizeMode("", "연습하고 싶어")).toBe("foundry");
    });
  });

  describe("getFallbackMessage", () => {
    it("returns center message for mode center", () => {
      expect(getFallbackMessage("center", "ko")).toContain("안전");
      expect(getFallbackMessage("center", "en")).toContain("safe");
    });
    it("returns foundry message for mode foundry", () => {
      expect(getFallbackMessage("foundry", "ko")).toBeDefined();
      expect(getFallbackMessage("foundry", "en")).toContain("perspective");
    });
    it("returns arena message for mode arena", () => {
      expect(getFallbackMessage("arena", "ko")).toBeDefined();
      expect(getFallbackMessage("arena", "en")).toContain("choices");
    });
    it("defaults to foundry for unknown mode (implementation detail)", () => {
      const msg = getFallbackMessage("foundry", "en");
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  describe("buildChatMessagesForModel — RAG 의도/키워드 주입 연동", () => {
    it("includes RAG spec in system message for center mode", () => {
      const messages = buildChatMessagesForModel(
        [{ role: "user", content: "요즘 불안해요" }],
        "center",
        "ko"
      );
      const system = messages.find((m) => m.role === "system");
      expect(system?.content).toBeDefined();
      expect(system!.content).toContain("정서 안정");
      expect(system!.content).toContain("Current mode: center");
    });
    it("passes last user content for intent-based RAG ordering", () => {
      const withKeyword = buildChatMessagesForModel(
        [{ role: "user", content: "트리거가 생각나요" }],
        "center",
        "ko"
      );
      const system = withKeyword.find((m) => m.role === "system");
      expect(system?.content).toBeDefined();
      expect(system!.content).toContain("트리거");
    });
  });
});
