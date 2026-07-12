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

export const LIVING_RESPONSE_PROMPT_VERSION = "lrprompt_v2";

// Human, non-code phrasing for each concept — the model anchors to these, never to the token.
const CONCEPT_HINT: Record<string, string> = {
  ownership: "owning / taking responsibility",
  accountability: "answering for what one does",
  repair: "repairing / addressing what was avoided",
  directness: "being direct / saying it clearly",
  communication: "putting it into a conversation",
  truth: "naming what is true",
  naming: "naming one thing clearly",
  follow_through: "following through / finishing",
  change: "a real change",
  consistency: "steadiness / returning again",
  return: "returning / beginning again",
  regard: "how one is seen by others",
};

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
  const conceptHints = packet.concepts.map((c) => CONCEPT_HINT[c] ?? c);

  const system = [
    "You write ONE short 'Living Response' for a calm daily reflection app.",
    "It is a single, specific, evidence-grounded perspective — NOT a summary, affirmation, or instruction.",
    "The relationship the user chose is the FRAME. Do NOT restate or explain it. Reveal a perspective",
    "about the SPECIFIC behavioral concept the evidence carries.",
    "",
    "Hard rules:",
    "- Output STRICT JSON only: {\"perspective\": \"<one sentence>\"}. No other keys, no prose.",
    "- Exactly one sentence. No question. Under 160 characters.",
    "- Ground it in the provided behavioral concept(s); use concrete behavioral nouns and verbs.",
    "- Do NOT restate the chosen relationship (self/others/world) or the commitment.",
    "- BANNED wellness/meditation/motivational language: embrace, nurture, your essence, inner self,",
    "  steady presence within, connect with yourself, honor your journey, step into your power, trust",
    "  the process, be present, cultivate, allow yourself, gentle reminder, authentic self, find balance,",
    "  hold space, radiate, manifest, abundance.",
    "- Do NOT diagnose, evaluate improvement, praise, flatter, or give an instruction (no 'try', 'remember').",
    "- Do NOT expose numbers, counts, scores, metrics, ranks, streaks, or any code.",
    "- The sentence must be hard to reuse for a different evidence set — make it specific to this concept.",
    "- Observant, calm, restrained; then release the user back into the day.",
    `- Write in ${lang}.`,
  ].join("\n");

  const user = [
    `Committed relationship frame (do not restate): ${FRAME[packet.relationship] ?? packet.relationship}.`,
    conceptHints.length
      ? `Ground the perspective in this behavioral evidence concept: ${conceptHints.join("; ")}.`
      : "Evidence is thin; keep it concrete and non-generic.",
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
