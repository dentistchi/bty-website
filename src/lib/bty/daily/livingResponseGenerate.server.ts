/**
 * livingResponseGenerate (server) — the single admitted provider path for a Living Response.
 *
 * Reuses the shared LLM client + the Today Mirror timeout/retry posture (12s, maxRetries 1,
 * fail-quiet, no evidence/prompt logging). Parses STRICT { perspective } JSON. Any transport/timeout/
 * parse failure returns { ok:false } — the caller settles a deterministic fallback, never retries
 * with looser validation and never makes a second same-day provider call.
 */
import { getLlmClient } from "@/lib/bty/llm/client";
import { buildLivingResponseMessages, LIVING_RESPONSE_PROMPT_VERSION } from "@/lib/bty/daily/livingResponsePrompt";
import type { LivingResponsePacket } from "@/domain/daily/livingResponse";

const TIMEOUT_MS = 12_000;
const MAX_RETRIES = 1;
const MODEL = process.env.LLM_MODEL?.trim() || "gpt-4o-mini";

export type LivingResponseGenerateResult =
  | { ok: true; perspective: string; modelVersion: string; promptVersion: string }
  | { ok: false; reason: "LLM_UNAVAILABLE" | "NO_OUTPUT" | "BAD_JSON" };

function parsePerspective(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(raw.slice(start, end + 1)) as { perspective?: unknown };
    const p = typeof obj.perspective === "string" ? obj.perspective.trim() : "";
    return p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function generateLivingResponse(
  packet: LivingResponsePacket,
  opts: { locale: string | null; recentTexts: string[] },
): Promise<LivingResponseGenerateResult> {
  let client;
  try {
    client = getLlmClient();
  } catch {
    return { ok: false, reason: "LLM_UNAVAILABLE" };
  }

  const messages = buildLivingResponseMessages(packet, opts);
  let perspective: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES && !perspective; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const completion = await client.chat.completions.create(
        { model: MODEL, messages, temperature: 0.7, max_tokens: 120 },
        { signal: controller.signal },
      );
      perspective = parsePerspective(completion.choices?.[0]?.message?.content);
    } catch {
      perspective = null; // timeout / network / API error → fail-quiet, maybe retry once
    } finally {
      clearTimeout(timer);
    }
  }

  if (!perspective) return { ok: false, reason: "NO_OUTPUT" };
  return { ok: true, perspective, modelVersion: MODEL, promptVersion: LIVING_RESPONSE_PROMPT_VERSION };
}
