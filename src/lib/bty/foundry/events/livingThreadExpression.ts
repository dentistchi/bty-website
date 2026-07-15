/**
 * Foundry Living Thread — EXPRESSION layer (service).
 *
 * "Rules decide. AI expresses." The domain decides eligibility, the evidence
 * packet, and the validator; this module holds the display WORDS: the quiet
 * status lines, the date formatting, the always-safe deterministic fallback
 * thread, and the LLM prompt. English-only surface (the app language). Pure and
 * framework-free (no DB, no network) so it is safe to reuse anywhere.
 */

import type { EvidencePacket, LivingThread, ThreadStatus } from "@/domain/foundry/living-thread";
import type { LlmChatMessage } from "@/lib/bty/llm/client";

/**
 * Status copy for the insufficient-evidence states. `gathering` and `eligible`
 * are null: gathering shows history quietly with NO pattern claim; eligible shows
 * the generated thread instead. Never exaggerated growth language.
 */
export const THREAD_STATUS_COPY: Record<ThreadStatus, string | null> = {
  none: "No completed reflections yet.",
  one: "One reflection is being held here.",
  two: "Two moments now sit beside each other.",
  gathering: null,
  eligible: null,
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** ISO → "May 4" (UTC, stable). `new Date(iso)` takes an argument (deterministic). */
export function formatMomentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Choose up to three spread-out moments (first, middle, last) for support. */
function pickMoments(packet: EvidencePacket): EvidencePacket["moments"] {
  const m = packet.moments;
  if (m.length <= 3) return m.slice(0, 3);
  return [m[0], m[Math.floor(m.length / 2)], m[m.length - 1]];
}

/**
 * The deterministic fallback thread — the always-clean safety net when the LLM is
 * unavailable or its output fails the validator. It is HONEST: it anchors the real
 * dates and count and shows the user's own excerpts, but claims NO synthesized
 * pattern and asks NO forced question. The LLM path is where the named connection
 * and grounded question come from.
 */
export function renderFallbackThread(packet: EvidencePacket): LivingThread {
  const chosen = pickMoments(packet);
  const dates = chosen.map((m) => formatMomentDate(m.date)).filter(Boolean);
  const thread =
    dates.length >= 2
      ? `${packet.sourceCount} of your reflections now sit beside each other — from ${dates.join(", ")} — each in your own words.`
      : `Your reflections now sit beside each other — each in your own words.`;
  return {
    thread,
    supportingMoments: chosen.map((m) => ({ eventId: m.eventId, excerpt: m.userExcerpt })),
    nextQuestion: null,
  };
}

/** Build the LLM messages. User words are PRIMARY evidence; AI lines are reference only. */
export function buildThreadMessages(packet: EvidencePacket): LlmChatMessage[] {
  const system = [
    "You are the voice of a BTY Living Thread — you show ONE connection that is checkable across sentences the person actually wrote on different days. You are not a judge, a diagnostician, or a coach.",
    "PRIMARY EVIDENCE is the person's own words, quoted below with dates. Any prior AI reflection line is reference expression ONLY — never proof of a pattern.",
    "Speak to \"you\". Ground every claim in the dated evidence and invent nothing — no events, dates, people, or feelings that are not present.",
    "Do NOT diagnose identity or personality. Do NOT infer hidden feelings ('deep down', 'you fear'). Do NOT promise growth ('you are becoming', 'a pattern is emerging'). Do NOT use 'you always', 'you keep', 'you often', or 'you tend to'.",
    "Prefer date-anchored phrasing: 'Across these three reflections…' or 'In the reflections from [date], [date], and [date]…'.",
    "Return ONLY a compact JSON object with EXACTLY these keys:",
    '"thread": one connection in 1–2 sentences across the dated responses.',
    '"supportingMoments": an array of 2–3 objects {"eventId": <one of the exact eventIds below>, "excerpt": <a short exact quote from THAT moment\'s words>}.',
    '"nextQuestion": ONE grounded question ending in "?", tied directly to the evidence — or null. It must not repeat an action already named, must not be generic encouragement or therapy, and must not say "take your time" / "in your own time" when the evidence is about delay or a cost reaching other people.',
    "No markdown, no code fences, no extra keys, no commentary.",
  ].join("\n");

  const lines = packet.moments
    .map((m, i) => {
      const ref = m.aiReflectionLine ? `\n   (reference only) prior line: "${m.aiReflectionLine}"` : "";
      return `#${i + 1} eventId=${m.eventId} date=${formatMomentDate(m.date)} title="${m.eventTitle}"\n   YOUR WORDS: "${m.userExcerpt}"${ref}`;
    })
    .join("\n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `Evidence — ${packet.sourceCount} completed reflections across ${packet.spanDays} days:\n${lines}`,
    },
  ];
}
