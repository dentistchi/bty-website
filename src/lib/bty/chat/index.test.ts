/**
 * chat/index — barrel re-exports 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import {
  buildChatMessagesForModel,
  normalizeMode,
  getFallbackMessage,
  isMetaQuestion,
} from "./index";

describe("chat/index", () => {
  it("re-exports buildChatMessagesForModel and normalizeMode", () => {
    expect(typeof buildChatMessagesForModel).toBe("function");
    expect(normalizeMode("center", "")).toBe("center");
    expect(normalizeMode("foundry", "")).toBe("foundry");
  });

  it("re-exports getFallbackMessage", () => {
    expect(typeof getFallbackMessage).toBe("function");
    const msg = getFallbackMessage("center", "ko");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("re-exports chatGuards (isMetaQuestion)", () => {
    expect(typeof isMetaQuestion).toBe("function");
    expect(isMetaQuestion("챗봇이야?")).toBe(true);
    expect(isMetaQuestion("오늘 기분이 안 좋아")).toBe(false);
  });
});
