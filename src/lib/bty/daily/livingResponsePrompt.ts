/**
 * livingResponsePrompt (lib) — the NEW Living Response prompt. Does NOT touch the Today Mirror
 * prompt / Korean voice / Golden Set.
 *
 * Provider input is provenance-SAFE by construction: committed relationship + machine evidence codes
 * (bands, never counts) + locale. It contains NO raw counts-for-display, action text, letter body,
 * names, emails, identifiers, AIR/XP/TII, current_state, pattern labels, or inferred emotion.
 *
 * Output schema (strict): { "perspective": string } — one sentence, no rationale/summary/list.
 */
import type { LlmChatMessage } from "@/lib/bty/llm/client";
import type { LivingResponsePacket } from "@/domain/daily/livingResponse";

export const LIVING_RESPONSE_PROMPT_VERSION = "lrprompt_v1";

const FRAME: Record<string, string> = {
  self: "the user's relationship with themselves (returning to themselves)",
  others: "the user's relationship with the people around them (being there for someone)",
  world: "the user's relationship with the world (moving what matters forward)",
};

export function buildLivingResponseMessages(
  packet: LivingResponsePacket,
  opts: { locale: string | null; recentTexts: string[] },
): LlmChatMessage[] {
  const lang = opts.locale === "ko" ? "Korean" : "English";
  const evidenceCodes = packet.facts.map((f) => `${f.evidenceClass}:${f.code}(${f.confidence})`).join(", ") || "none";

  const system = [
    "You write ONE short 'Living Response' for a calm daily reflection app.",
    "It is a single grounded perspective that accompanies the relationship the user has already chosen to live today.",
    "The commitment is the FRAME, not something to explain or justify.",
    "",
    "Hard rules:",
    "- Output STRICT JSON only: {\"perspective\": \"<one sentence>\"}. No other keys, no prose.",
    "- Exactly one sentence. No question. Under 160 characters.",
    "- Do NOT diagnose, evaluate improvement, praise, or flatter.",
    "- Do NOT expose numbers, counts, scores, metrics, ranks, or streaks.",
    "- Do NOT explain WHY they chose this relationship.",
    "- Do NOT name a person, emotion, personality, or leadership state.",
    "- Do NOT give a detailed instruction or task.",
    "- Only imply what the provided evidence codes support; claim nothing beyond them.",
    "- Speak plainly and quietly; then release the user back into the day.",
    `- Write in ${lang}.`,
  ].join("\n");

  const user = [
    `Committed relationship frame: ${FRAME[packet.relationship] ?? packet.relationship}.`,
    `Canonical evidence codes (bands only, no raw values): ${evidenceCodes}.`,
    opts.recentTexts.length
      ? `Avoid repeating the phrasing/opening of these recent lines: ${opts.recentTexts.slice(0, 3).map((t) => `"${t}"`).join("; ")}.`
      : "",
    "Return only the JSON object.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
