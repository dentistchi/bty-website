/**
 * chat/types — API 계약 타입 shape 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import type {
  ChatMode,
  ChatConversationMessage,
  ChatRequestBody,
  ChatResponseBody,
  ChatErrorBody,
  OpenAIChatMessage,
} from "./types";

describe("chat/types", () => {
  it("ChatMode is center | foundry | arena", () => {
    const modes: ChatMode[] = ["center", "foundry", "arena"];
    expect(modes).toHaveLength(3);
    expect(modes).toContain("center");
    expect(modes).toContain("arena");
  });

  it("ChatConversationMessage has role and content", () => {
    const msg: ChatConversationMessage = { role: "user", content: "hello" };
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hello");
    const asst: ChatConversationMessage = { role: "assistant", content: "hi" };
    expect(asst.role).toBe("assistant");
  });

  it("ChatRequestBody has messages array, optional mode and lang", () => {
    const body: ChatRequestBody = { messages: [] };
    expect(body.messages).toEqual([]);
    const withOpt: ChatRequestBody = {
      messages: [{ role: "user", content: "x" }],
      mode: "center",
      lang: "ko",
    };
    expect(withOpt.mode).toBe("center");
    expect(withOpt.lang).toBe("ko");
  });

  it("ChatResponseBody has message string, optional flags", () => {
    const res: ChatResponseBody = { message: "ok" };
    expect(res.message).toBe("ok");
    const withFlags: ChatResponseBody = {
      message: "reply",
      suggestCenter: true,
      usedFallback: false,
    };
    expect(withFlags.suggestCenter).toBe(true);
  });

  it("ChatErrorBody has error string", () => {
    const err: ChatErrorBody = { error: "Unauthorized" };
    expect(err.error).toBe("Unauthorized");
  });

  it("OpenAIChatMessage has role system|user|assistant and content", () => {
    const system: OpenAIChatMessage = { role: "system", content: "You are..." };
    expect(system.role).toBe("system");
    expect(system.content).toBeDefined();
  });
});