import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { aiPatientApiKey, aiPatientLlm, AiPatientProviderUnconfigured, isAiPatientProviderConfigured } from "./aiPatientProvider";
import { isLlmAvailable } from "@/lib/bty/llm/client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("[AI patient] dedicated provider key", () => {
  it("deployed: uses ONLY the dedicated key — the shared OPENAI_API_KEY is never a fallback", () => {
    vi.stubEnv("BTY_ENV", "staging");
    vi.stubEnv("OPENAI_API_KEY", "sk-shared");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "");
    expect(aiPatientApiKey()).toBeNull();
    expect(isAiPatientProviderConfigured()).toBe(false);
    expect(() => aiPatientLlm()).toThrow(AiPatientProviderUnconfigured);
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated");
    expect(aiPatientApiKey()).toBe("sk-dedicated");
  });

  it("production behaves the same as staging", () => {
    vi.stubEnv("BTY_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "sk-shared");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "");
    expect(isAiPatientProviderConfigured()).toBe(false);
  });

  it("local/test may fall back to OPENAI_API_KEY, but prefer the dedicated key", () => {
    vi.stubEnv("BTY_ENV", "");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-shared");
    expect(aiPatientApiKey()).toBe("sk-shared");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated");
    expect(aiPatientApiKey()).toBe("sk-dedicated");
  });

  it("chat goes to OpenAI on the dedicated key even when the shared client points at a local model", async () => {
    vi.stubEnv("BTY_ENV", "staging");
    vi.stubEnv("LLM_BASE_URL", "http://local-ollama:11434/v1");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated");
    const f = vi.fn(async () => Response.json({ choices: [{ message: { content: "hi" } }] }));
    vi.stubGlobal("fetch", f);
    await aiPatientLlm().chat.completions.create({ model: "m", messages: [] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-dedicated");
  });

  it("does not change the shared BTY client: the AI Patient key alone does not make it available", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("LLM_API_KEY", "");
    vi.stubEnv("LLM_BASE_URL", "");
    vi.stubEnv("AI_PATIENT_OPENAI_API_KEY", "sk-dedicated");
    expect(isLlmAvailable()).toBe(false);
  });

  it("no AI Patient source reaches the shared client or the shared key directly", () => {
    const dirs = ["src/lib/bty/arena/aiPatient", "src/app/api/arena/ai-patient", "src/domain/arena/aiPatient"];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p);
      }
    };
    dirs.forEach((d) => walk(join(process.cwd(), d)));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/getLlmClient|isLlmAvailable/);
      if (!f.endsWith("aiPatientProvider.ts")) expect(src, f).not.toMatch(/process\.env\.(OPENAI_API_KEY|LLM_API_KEY|AI_PATIENT_OPENAI_API_KEY)/);
    }
  });
});
