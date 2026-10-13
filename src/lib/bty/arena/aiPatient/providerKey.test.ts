import { afterEach, describe, expect, it, vi } from "vitest";
import { getLlmClient } from "@/lib/bty/llm/client";
import { aiPatientOpenAIKey } from "./providerKey";
import { isSpeechAvailable, transcribeClip, synthesizePatientLine } from "./speech";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI Patient uses only its dedicated OpenAI project", () => {
  it("fails closed with only the shared key set", async () => {
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-shared-bty");
    vi.stubEnv("LLM_API_KEY", "other-key");
    expect(aiPatientOpenAIKey()).toBe("");
    expect(isSpeechAvailable()).toBe(false);
    expect(() => getLlmClient({ dedicatedOpenAiApiKey: aiPatientOpenAIKey() })).toThrow(/Dedicated OpenAI credential/);
    await expect(transcribeClip(new Blob(["voice"], { type: "audio/webm" }))).rejects.toMatchObject({ name: "SpeechUnavailableError" });
    await expect(synthesizePatientLine("hello")).rejects.toMatchObject({ name: "SpeechUnavailableError" });
  });

  it("uses the same isolated key for chat, feedback transport, transcription and TTS even if LLM_BASE_URL is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-shared-bty");
    vi.stubEnv("LLM_API_KEY", "sk-ollama");
    vi.stubEnv("LLM_BASE_URL", "http://127.0.0.1:11434/v1");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated-patient");
    const requests: Array<{ url: string; authorization: string | null }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      requests.push({ url, authorization: headers.get("authorization") });
      if (url.endsWith("/audio/transcriptions")) return Response.json({ text: "Hello, Dana." });
      if (url.endsWith("/audio/speech")) return new Response(new Uint8Array([1, 2, 3]));
      return Response.json({ choices: [{ message: { content: "I need to think." }, finish_reason: "stop" }] });
    }));
    const key = aiPatientOpenAIKey();
    await getLlmClient({ dedicatedOpenAiApiKey: key }).chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hello" }],
    });
    await transcribeClip(new Blob(["voice"], { type: "audio/webm" }));
    await synthesizePatientLine("I need to think.");
    expect(isSpeechAvailable()).toBe(true);
    expect(requests.map((r) => r.url)).toEqual([
      "https://api.openai.com/v1/chat/completions",
      "https://api.openai.com/v1/audio/transcriptions",
      "https://api.openai.com/v1/audio/speech",
    ]);
    expect(requests.every((r) => r.authorization === "Bearer sk-dedicated-patient")).toBe(true);
  });
});
