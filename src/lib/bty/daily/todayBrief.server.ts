/**
 * Today Brief (server) — the assistive-AI layer (Slice 3.1B-3J). Mirrors the Living Reflection
 * pattern: deterministic gating → LLM re-expresses → output validation → deterministic fallback →
 * TEXT-FREE logging. Ephemeral: nothing is stored. Consent-gated; owner-scoped.
 *
 * Boundaries: uses ONLY the previous BTY day's Private Reflections (max 3, most recent first),
 * runs a sensitive-text gate BEFORE any LLM send, validates output against diagnostic/personality/
 * health language, and NEVER logs the raw Reflection, the sensitive fragment, a hash, or the prompt.
 * The raw Reflection text never leaves the server — only the generated sentences do.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayKey } from "@/domain/daily/userDayKey";
import { listUserFoundryHistory } from "@/lib/bty/foundry/events/foundryHistoryService";
import { getLlmClient, getLlmModel, isLlmAvailable } from "@/lib/bty/llm/client";
import { looksSensitive, isSafeBrief, NEUTRAL_BRIEF } from "@/domain/daily/todayBriefSafety";

const OPEN_HOUR = 5;
const MAX_REFLECTIONS = 3;
const LLM_TIMEOUT_MS = 12_000;

export type TodayBrief = {
  yesterdayObservation: string;
  todaySuggestion: string;
  /** "ai" = model-generated + validated; "fallback" = deterministic neutral safety copy. */
  source: "ai" | "fallback";
};

function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Text-free outcome log — NEVER the reflection, fragment, hash, or prompt. */
function logOutcome(code: string): void {
  console.info("[today-brief] outcome", code);
}

/**
 * Compose the assistive brief for the authenticated caller. Returns null ONLY when consent is off
 * or there is no eligible prior-day reflection (→ Today omits the AI section; deterministic
 * reminders still render). Any safety/LLM/validation failure returns the neutral fallback.
 */
export async function composeTodayBrief(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  tz: string,
  locale: "en" | "ko",
  consent: boolean,
): Promise<TodayBrief | null> {
  if (!consent || !userId) return null;

  let safeTexts: string[] = [];
  try {
    const todayKey = userDayKey(now, tz, OPEN_HOUR);
    const yesterdayKey = previousDayKey(todayKey);
    const items = await listUserFoundryHistory(admin, userId); // owner-scoped, newest-first
    const yesterday = items.filter(
      (it) => it.responseText.trim().length > 0 && userDayKey(new Date(it.completedAt), tz, OPEN_HOUR) === yesterdayKey,
    );
    if (yesterday.length === 0) return null; // no prior-day reflection → omit the AI section

    // Gate 1: drop any reflection carrying sensitive identifiers BEFORE the LLM ever sees it.
    safeTexts = yesterday
      .slice(0, MAX_REFLECTIONS)
      .map((it) => it.responseText.trim())
      .filter((t) => !looksSensitive(t));
    if (safeTexts.length === 0) {
      logOutcome("blocked_sensitive");
      return { ...NEUTRAL_BRIEF[locale], source: "fallback" };
    }
  } catch {
    return null; // fail-soft: a read failure omits the AI section (reminders still render)
  }

  if (!isLlmAvailable()) {
    logOutcome("llm_unavailable");
    return { ...NEUTRAL_BRIEF[locale], source: "fallback" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const client = getLlmClient();
    const sys =
      "You write a learner's private daily brief. Given short private reflections the learner wrote " +
      "YESTERDAY, output STRICT JSON {\"yesterdayObservation\":string,\"todaySuggestion\":string}. " +
      "yesterdayObservation: ONE plain, calm, non-diagnostic sentence about what mattered yesterday. " +
      "todaySuggestion: ONE practical action for today. Rules: no diagnosis, no personality or mental-" +
      "health claims, no judgments about ability or loyalty, no names/emails/phones/patient or chart " +
      "identifiers, do NOT quote the reflection verbatim. " +
      (locale === "ko" ? "Write in Korean." : "Write in English.");
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Yesterday's private reflections:\n${safeTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}` },
        ],
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let parsed: { yesterdayObservation?: unknown; todaySuggestion?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      logOutcome("parse_failed");
      return { ...NEUTRAL_BRIEF[locale], source: "fallback" };
    }
    const obs = typeof parsed.yesterdayObservation === "string" ? parsed.yesterdayObservation.trim() : "";
    const sug = typeof parsed.todaySuggestion === "string" ? parsed.todaySuggestion.trim() : "";

    // Gate 2: reject diagnostic/personality/health language (and empty/overlong output).
    if (!isSafeBrief(obs, sug)) {
      logOutcome("validation_rejected");
      return { ...NEUTRAL_BRIEF[locale], source: "fallback" };
    }
    logOutcome("ai_ok");
    return { yesterdayObservation: obs, todaySuggestion: sug, source: "ai" };
  } catch {
    logOutcome("llm_error");
    return { ...NEUTRAL_BRIEF[locale], source: "fallback" };
  }
}
