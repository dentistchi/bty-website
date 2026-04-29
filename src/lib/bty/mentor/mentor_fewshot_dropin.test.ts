import { describe, it, expect } from "vitest";
import {
  ALL_BUNDLES,
  inferLang,
  routeByWeightedRules,
  buildMentorMessagesDual,
  BASE_CONVERSATION_RULES,
  type BundleKey,
} from "./mentor_fewshot_dropin";

describe("mentor_fewshot_dropin", () => {
  describe("ALL_BUNDLES", () => {
    it("has clinical, learning, relationship keys", () => {
      expect(ALL_BUNDLES.clinical).toBeDefined();
      expect(ALL_BUNDLES.learning).toBeDefined();
      expect(ALL_BUNDLES.relationship).toBeDefined();
    });

    it("each bundle has key, name.en, name.ko, system, examples", () => {
      const keys: BundleKey[] = ["clinical", "learning", "relationship"];
      for (const k of keys) {
        const b = ALL_BUNDLES[k];
        expect(b.key).toBe(k);
        expect(typeof b.name.en).toBe("string");
        expect(typeof b.name.ko).toBe("string");
        expect(b.system.en.role).toBe("system");
        expect(b.system.ko.role).toBe("system");
        expect(Array.isArray(b.examples.en)).toBe(true);
        expect(Array.isArray(b.examples.ko)).toBe(true);
      }
    });
  });

  describe("inferLang", () => {
    it("returns ko when text contains Korean", () => {
      expect(inferLang("한글")).toBe("ko");
      expect(inferLang("치과 관계 갈등")).toBe("ko");
      expect(inferLang("Hello 관계")).toBe("ko");
    });

    it("returns en when text has no Korean", () => {
      expect(inferLang("hello")).toBe("en");
      expect(inferLang("clinical extraction")).toBe("en");
      expect(inferLang("")).toBe("en");
    });
  });

  describe("routeByWeightedRules", () => {
    it("returns bundle, scores, matchedRuleIds", () => {
      const r = routeByWeightedRules("random text");
      expect(r.bundle).toBeDefined();
      expect(r.bundle.key).toBeDefined();
      expect(r.scores).toBeDefined();
      expect(r.scores.clinical).toBeDefined();
      expect(r.scores.learning).toBeDefined();
      expect(r.scores.relationship).toBeDefined();
      expect(Array.isArray(r.matchedRuleIds)).toBe(true);
    });

    it("matches clinical bundle for dental/clinical terms", () => {
      const r = routeByWeightedRules("extraction and flap suture");
      expect(r.bundle.key).toBe("clinical");
      expect(r.matchedRuleIds.length).toBeGreaterThan(0);
    });

    it("matches relationship bundle for relationship terms", () => {
      const r = routeByWeightedRules("conflict with my leader");
      expect(r.bundle.key).toBe("relationship");
    });
  });

  describe("buildMentorMessagesDual", () => {
    it("returns bundleKey, lang, messages array", () => {
      const out = buildMentorMessagesDual("test question");
      expect(out.bundleKey).toBeDefined();
      expect(["clinical", "learning", "relationship"]).toContain(out.bundleKey);
      expect(["en", "ko"]).toContain(out.lang);
      expect(Array.isArray(out.messages)).toBe(true);
      expect(out.messages.length).toBeGreaterThan(0);
      expect(out.messages[0].role).toBe("system");
      const last = out.messages[out.messages.length - 1];
      expect(last.role).toBe("user");
      expect(last.content).toBe("test question");
    });

    it("uses opts.lang when provided", () => {
      const out = buildMentorMessagesDual("hello", { lang: "ko" });
      expect(out.lang).toBe("ko");
    });
  });

  describe("BASE_CONVERSATION_RULES", () => {
    it("has en and ko strings", () => {
      expect(typeof BASE_CONVERSATION_RULES.en).toBe("string");
      expect(typeof BASE_CONVERSATION_RULES.ko).toBe("string");
      expect(BASE_CONVERSATION_RULES.en.length).toBeGreaterThan(0);
      expect(BASE_CONVERSATION_RULES.ko.length).toBeGreaterThan(0);
    });
  });
});
