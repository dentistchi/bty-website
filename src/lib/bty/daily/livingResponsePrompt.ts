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

export const LIVING_RESPONSE_PROMPT_VERSION = "lrprompt_v3";

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
    "You write ONE quiet 'Living Response' — a single evidence-grounded PERSPECTIVE that reveals one",
    "deeper meaning already present in the user's commitment and evidence. It is NOT advice, coaching,",
    "instruction, diagnosis, encouragement, summary, restatement, or affirmation.",
    "The relationship the user chose is the FRAME — do NOT restate or explain it.",
    "",
    "Target form (structure only, do NOT copy verbatim):",
    "  \"X becomes visible when it reaches another person.\"",
    "  \"What changes within becomes real when it enters a conversation.\"",
    "  \"Ownership changes shape when someone else can experience it.\"",
    "",
    "Hard rules:",
    "- Output STRICT JSON only: {\"perspective\": \"<one sentence>\"}. No other keys, no prose.",
    "- Exactly one sentence. No question. 8–16 words. Under 100 characters. Fits two short lines.",
    "- Ground it in the provided behavioral concept; concrete behavioral nouns/verbs only.",
    "- REVEAL a meaning; NEVER tell the user to do anything and NEVER add a second action, habit, ritual,",
    "  journaling, naming task, breathing, or self-care step.",
    "- BANNED instruction words: try, remember, consider, practice, regularly, begin by, make sure, focus on,",
    "  take time, allow yourself, continue to, keep, embrace.",
    "- BANNED wellness/meditation language: your essence, inner peace, steady anchor, nurture, embrace,",
    "  daily distractions, authentic self, inner strength, journey, space for yourself, gentle reminder.",
    "- Do NOT restate the relationship or the commitment; do NOT diagnose; no numbers/scores/codes.",
    "- Must be hard to reuse for a different user — specific to THIS concept.",
    "- Observant, restrained, unmistakably grounded; then release the user.",
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
