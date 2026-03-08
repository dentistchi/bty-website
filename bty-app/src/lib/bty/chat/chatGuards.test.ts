import { describe, it, expect } from "vitest";
import {
  isMetaQuestion,
  getMetaReply,
  getIntroQuestionKind,
  getIntroReply,
} from "./chatGuards";

describe("chatGuards", () => {
  describe("isMetaQuestion", () => {
    it("detects who are you", () => {
      expect(isMetaQuestion("너 누구야?")).toBe(true);
      expect(isMetaQuestion("Who are you")).toBe(true);
    });
    it("detects bot/AI questions", () => {
      expect(isMetaQuestion("챗봇이야?")).toBe(true);
      expect(isMetaQuestion("Are you a bot?")).toBe(true);
      expect(isMetaQuestion("이거 AI야?")).toBe(true);
    });
    it("returns false for normal content", () => {
      expect(isMetaQuestion("오늘 기분이 좋아요")).toBe(false);
      expect(isMetaQuestion("BTY가 뭐야?")).toBe(false);
    });
  });

  describe("getIntroQuestionKind / getIntroReply", () => {
    it("detects BTY intro and returns reply", () => {
      expect(getIntroQuestionKind("BTY가 뭐야?")).toBe("bty");
      expect(getIntroQuestionKind("what is BTY")).toBe("bty");
      expect(getIntroReply("bty", "ko")).toContain("리더십");
      expect(getIntroReply("bty", "en")).toContain("leadership");
    });
    it("detects Foundry intro and returns reply", () => {
      expect(getIntroQuestionKind("Foundry가 뭐야?")).toBe("foundry");
      expect(getIntroReply("foundry", "ko")).toContain("훈련");
      expect(getIntroReply("foundry", "en")).toContain("Foundry");
    });
    it("detects Center intro and returns reply", () => {
      expect(getIntroQuestionKind("Center가 뭐야?")).toBe("center");
      expect(getIntroReply("center", "ko")).toContain("안전");
      expect(getIntroReply("center", "en")).toContain("safe");
    });
    it("returns null for non-intro", () => {
      expect(getIntroQuestionKind("오늘 뭐해?")).toBe(null);
    });
  });

  describe("getMetaReply", () => {
    it("returns ko reply when lang is ko", () => {
      const msg = getMetaReply("ko");
      expect(msg).toContain("BTY Chat");
      expect(msg.length).toBeGreaterThan(10);
    });
    it("returns en reply when lang is en", () => {
      const msg = getMetaReply("en");
      expect(msg).toContain("BTY Chat");
      expect(msg.length).toBeGreaterThan(10);
    });
  });
});
