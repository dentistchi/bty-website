/**
 * mentor_fewshot_router — detectBundleEN, buildMentorMessagesEN, debugRouteEN 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  detectBundleEN,
  buildMentorMessagesEN,
  debugRouteEN,
  CLINICAL_COACHING_EN,
  RELATIONSHIP_LEADERSHIP_EN,
  LEARNING_GROWTH_EN,
} from "./mentor_fewshot_router";

describe("mentor_fewshot_router", () => {
  describe("detectBundleEN", () => {
    it("returns CLINICAL_COACHING_EN when text contains clinical keywords", () => {
      const bundle = detectBundleEN("patient treatment and clinical protocol");
      expect(bundle.key).toBe("clinical");
      expect(bundle).toBe(CLINICAL_COACHING_EN);
    });

    it("returns LEARNING_GROWTH_EN when text contains learning keywords", () => {
      const bundle = detectBundleEN("I want to learn and improve my skills");
      expect(bundle.key).toBe("learning");
      expect(bundle).toBe(LEARNING_GROWTH_EN);
    });

    it("returns RELATIONSHIP_LEADERSHIP_EN when text contains relationship keywords", () => {
      const bundle = detectBundleEN("conflict with my coworker and team trust");
      expect(bundle.key).toBe("relationship");
      expect(bundle).toBe(RELATIONSHIP_LEADERSHIP_EN);
    });

    it("returns RELATIONSHIP_LEADERSHIP_EN as default when no keyword match", () => {
      const bundle = detectBundleEN("hello world");
      expect(bundle.key).toBe("relationship");
    });

    it("clinical takes precedence over learning when both match", () => {
      const bundle = detectBundleEN("tooth extraction and learn");
      expect(bundle.key).toBe("clinical");
    });
  });

  describe("buildMentorMessagesEN", () => {
    it("returns bundle and messages with system, examples, and user content", () => {
      const { bundle, messages } = buildMentorMessagesEN("I need help with conflict");
      expect(bundle.key).toBe("relationship");
      expect(messages.length).toBeGreaterThan(1);
      expect(messages[0].role).toBe("system");
      expect(messages[messages.length - 1]).toEqual({ role: "user", content: "I need help with conflict" });
    });

    it("last message is user text", () => {
      const { messages } = buildMentorMessagesEN("my custom question");
      expect(messages[messages.length - 1].content).toBe("my custom question");
    });
  });

  describe("debugRouteEN", () => {
    it("returns bundleKey and matchedExamples", () => {
      const out = debugRouteEN("clinical case");
      expect(["clinical", "relationship", "learning"]).toContain(out.bundleKey);
      expect(typeof out.matchedExamples).toBe("number");
    });
  });
});
