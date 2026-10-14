import { afterEach, describe, expect, it, vi } from "vitest";
import { SPEECH_MODELS, synthesizePatientLine, VOICE_DIRECTION } from "./speech";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("[AI patient] Dana's speaking voice", () => {
  it("sends the warm, everyday direction with the configured model and voice", async () => {
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated-test");
    const f = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", f);
    await synthesizePatientLine("I think I need to think about it.");
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as Record<string, string>;
    expect(body).toMatchObject({ model: SPEECH_MODELS.speak, voice: SPEECH_MODELS.voice, input: "I think I need to think about it.", response_format: "mp3" });
    expect(body.instructions).toBe(VOICE_DIRECTION);
  });

  it("speaks in the Founder-chosen Marin voice by default", () => {
    expect(process.env.AI_PATIENT_TTS_VOICE ?? "").toBe("");
    expect(SPEECH_MODELS.voice).toBe("marin");
  });

  it("asks for a friendly front-desk conversation — not a grave, thoughtful or announcer delivery", () => {
    expect(VOICE_DIRECTION).toMatch(/warm, relaxed and conversational/);
    expect(VOICE_DIRECTION).toMatch(/never sad, heavy or dramatic/);
    expect(VOICE_DIRECTION).toMatch(/news anchor/);
    expect(VOICE_DIRECTION).not.toMatch(/thoughtful|calm office/);
  });
});
