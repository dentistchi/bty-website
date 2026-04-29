/**
 * systemMessages — getMessagesByLocale, BTY_SYSTEM_MESSAGES 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { getMessagesByLocale, BTY_SYSTEM_MESSAGES, type SystemMessage, type Locale } from "./systemMessages";

describe("systemMessages", () => {
  describe("BTY_SYSTEM_MESSAGES", () => {
    it("contains messages for both en and ko", () => {
      const enCount = BTY_SYSTEM_MESSAGES.filter((m) => m.locale === "en").length;
      const koCount = BTY_SYSTEM_MESSAGES.filter((m) => m.locale === "ko").length;
      expect(enCount).toBeGreaterThan(0);
      expect(koCount).toBeGreaterThan(0);
    });

    it("each message has required fields", () => {
      for (const m of BTY_SYSTEM_MESSAGES) {
        expect(m.id).toBeDefined();
        expect(["en", "ko"]).toContain(m.locale);
        expect(["hero", "toast", "feed", "milestone"]).toContain(m.channel);
        expect(Array.isArray(m.tags)).toBe(true);
        expect(typeof m.text).toBe("string");
        expect(typeof m.priority).toBe("number");
        expect(typeof m.cooldownSec).toBe("number");
        expect(m.trigger).toBeDefined();
        expect(m.trigger.type).toBeDefined();
      }
    });
  });

  describe("getMessagesByLocale", () => {
    it("returns only en messages when locale is en", () => {
      const messages = getMessagesByLocale("en");
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((m: SystemMessage) => m.locale === "en")).toBe(true);
    });

    it("returns only ko messages when locale is ko", () => {
      const messages = getMessagesByLocale("ko");
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((m: SystemMessage) => m.locale === "ko")).toBe(true);
    });

    it("en and ko subsets are disjoint", () => {
      const en = getMessagesByLocale("en" as Locale);
      const ko = getMessagesByLocale("ko" as Locale);
      const enIds = new Set(en.map((m) => m.id));
      for (const m of ko) {
        expect(enIds.has(m.id)).toBe(false);
      }
    });
  });
});
