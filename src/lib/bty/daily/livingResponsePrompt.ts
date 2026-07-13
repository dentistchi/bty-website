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
import type {
  LivingResponseProposition,
  LivingResponseMovement,
  LivingResponseDestination,
  LivingResponseAngle,
} from "@/domain/daily/livingResponseFrame";

// V2.1: expression-only. The provider no longer "reveals deeper meaning"; it renders the authorized
// proposition in one sentence, at one angle. Prompt version bumped so V1.x settled rows are distinct.
export const LIVING_RESPONSE_PROMPT_VERSION = "lrprompt_v4";

// Human, non-code phrasing for the movement the sentence must make visible.
const MOVEMENT_HINT: Record<LivingResponseMovement, string> = {
  unspoken_to_named: "an inward reality taking clear, honest form as it is named",
  private_to_relational: "care moving out of privacy so another person can actually receive it",
  decision_to_action: "responsibility taking form in what is actually built",
};

const DESTINATION_HINT: Record<LivingResponseDestination, string> = {
  self: "the user's own inward ground (no other person involved)",
  another_person: "one other person who can receive it",
  shared_reality: "the shared, made, external reality",
};

// One selected angle — the single lens the sentence takes. The provider gets exactly one.
const ANGLE_HINT: Record<LivingResponseAngle, string> = {
  boundary: "the moment it crosses from inside into reality",
  visibility: "how it becomes visible / takes form",
  consequence: "what becomes possible once it lands",
  continuity: "that it holds by being returned to, not that today is different",
};

export function buildLivingResponseMessages(
  packet: LivingResponsePacket,
  opts: { locale: string | null; recentTexts: string[]; proposition: LivingResponseProposition },
): LlmChatMessage[] {
  const lang = opts.locale === "ko" ? "Korean" : "English";
  const p = opts.proposition;

  const system = [
    "You render ONE quiet 'Living Response': you EXPRESS an already-decided meaning in a single sentence.",
    "You do NOT create, reveal, deepen, or add meaning. You do NOT analyze the user. It is NOT advice,",
    "coaching, instruction, diagnosis, encouragement, praise, summary, restatement, or affirmation.",
    "The chosen relationship is the FRAME — do NOT restate or explain it, and do NOT paraphrase the",
    "commitment wording.",
    "",
    "Hard rules:",
    "- Output STRICT JSON only: {\"perspective\": \"<one sentence>\"}. No other keys, no prose.",
    "- Exactly one sentence. No question. 8–16 words. Under 100 characters. Fits two short lines.",
    "- Use ONLY the supplied meaning and the ONE angle below. Add nothing not given.",
    "- Concrete behavioral nouns/verbs only — the sentence must surface the movement or destination,",
    "  not a generic abstraction (clarity, growth, presence, intention, alignment, awareness).",
    "- NEVER tell the user to do anything; NEVER add a second action, habit, ritual, journaling,",
    "  naming task, breathing, or self-care step.",
    "- Make NO claim about the past, about repetition, or about today being different (no contrast).",
    "- BANNED instruction words: try, remember, consider, practice, regularly, begin by, make sure,",
    "  focus on, take time, allow yourself, continue to, keep, embrace.",
    "- BANNED wellness/meditation language: your essence, inner peace, steady anchor, nurture, embrace,",
    "  authentic self, inner strength, journey, space for yourself, gentle reminder.",
    "- No numbers, scores, codes, names. Observant and restrained; then release the user.",
    `- Write in ${lang}.`,
  ].join("\n");

  const user = [
    `Express this authorized meaning about ${p.subject}: ${MOVEMENT_HINT[p.movement]}.`,
    `Where it lands: ${DESTINATION_HINT[packet.commitmentFrame.destination]}.`,
    `Take exactly this one angle: ${ANGLE_HINT[p.angle]}.`,
    `Ground the wording in these words (weave, do not list): ${p.meaningTokens.join(", ")}.`,
    p.prohibitedClaims.length
      ? `Do not imply any of: ${p.prohibitedClaims.join(", ")}.`
      : "",
    opts.recentTexts.length
      ? `Do not repeat the opening/shape of these recent lines: ${opts.recentTexts.slice(0, 3).map((t) => `"${t}"`).join("; ")}.`
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
