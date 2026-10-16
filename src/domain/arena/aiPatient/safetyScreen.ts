/**
 * AI PATIENT — the safety screen (pure contract).
 *
 * A SEPARATE, narrow review that runs beside the coaching feedback. It answers one question per
 * Treatment Coordinator line: did this line misrepresent the dentist's recommendation, promise
 * unconfirmed coverage, or pressure the patient?
 *
 * Measured reason it exists: in the first live run the coaching reviewer missed "the crack is tiny,
 * Dr. Patel is just being cautious… we could just do a filling instead" entirely — and quoted that
 * same line as evidence of GOOD behavior. A focused screen that sees what the dentist actually said is
 * far harder to talk past than a general coach.
 *
 * It reports LINE NUMBERS, never free-text quotes, so every flagged quote is the learner's exact words
 * by construction. It is still a model: it can miss things, and the screen never claims otherwise.
 */

import { CASE_ACCEPTANCE_01, type AiPatientCase } from "./caseAcceptance01";
import { CONCERN_KINDS, type ConcernKind } from "./feedback";
import type { Turn } from "./sessionRules";
import type { ChatMessage } from "./patientPrompt";
import { SAFETY_SCOPE_RULE } from "./safetyScope";
import { acceptOtherFinding, OTHER_ACTS } from "./otherEvidence";

export type ScreenFinding = { turnIndex: number; kind: ConcernKind; explanation: string };

export const SAFETY_SCREEN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line", "kind", "explanation", "act", "evidence"],
        properties: {
          line: { type: "integer" },
          kind: { type: "string", enum: [...CONCERN_KINDS] },
          explanation: { type: "string" },
          // Required for kind "other", where they are checked in code (otherEvidence.ts); null otherwise.
          act: { type: ["string", "null"], enum: [...OTHER_ACTS, null] },
          evidence: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

/** TC lines only, numbered by their position in the whole conversation. */
export function numberedLearnerLines(turns: Turn[]): string {
  return turns
    .map((t, i) => (t.role === "tc" ? `LINE ${i}: ${t.text}` : `(patient) ${t.text}`))
    .join("\n");
}

export function buildSafetyScreenMessages(turns: Turn[], kase: AiPatientCase = CASE_ACCEPTANCE_01): ChatMessage[] {
  const dentist = kase.dentistName ?? "the treating dentist";
  const signals = Object.entries(kase.safetySignals ?? {}).flatMap(([kind, list]) => (list ?? []).map((x) => `- ${kind} in this situation also includes: ${x}`));
  return [
    {
      role: "system",
      content: [
        "You check a Treatment Coordinator's (TC's) words in a PRACTICE conversation with a fictional dental patient. You are not a coach. Report only problems.",
        "",
        "WHAT IS ACTUALLY TRUE IN THIS CASE (anything the TC says that contradicts or goes beyond this is unsupported):",
        ...kase.reviewerFacts.map((f) => `- ${f}`),
        `- Only the treating dentist (${dentist}) decides diagnosis, treatment, alternatives and urgency. A TC may repeat what the dentist said, or offer to get the dentist; a TC may not add to it or change it.`,
        ...(kase.roleBoundaries ?? []).map((b) => `- ${b}`),
        "",
        "Flag a TC line (use its LINE number) when it does any of these:",
        "- clinical_misrepresentation: changes, softens, reinterprets or second-guesses the dentist's recommendation (e.g. calling the problem minor, saying the dentist is 'just being cautious', suggesting the patient can wait a long time, offering a different treatment such as a filling instead); invents clinical facts; or invents clinical urgency or fear (e.g. 'the tooth could break this week').",
        "- insurance_guarantee: promises, guarantees or confidently states what insurance will pay, or says the cost will be lower than the estimate, when coverage has not been confirmed.",
        "- pressure_or_urgency: pushes the patient to book or decide now, invents deadlines or price expiries, or keeps pushing after the patient asks for time.",
        "- other: anything else that disrespects the patient's right to accept, wait or decline, or invents a practice policy or payment option.",
        ...signals,
        "Do NOT flag: open questions, accurate statements that the estimate is unconfirmed, offering to get the dentist, offering to request a pre-estimate, offering follow-up without pressure.",
        SAFETY_SCOPE_RULE,
        "Explanations: one plain sentence addressed to the TC as 'you'. If nothing is wrong, return an empty list.",
        `For kind "other" only, also give act (one of: ${OTHER_ACTS.join(", ")}) and evidence (the exact words from that LINE that themselves express the act, copied character for character). For every other kind, act and evidence are null.`,
      ].join("\n"),
    },
    { role: "user", content: numberedLearnerLines(turns) },
  ];
}

/**
 * Keep only findings that point at a real TC line, with a known kind. One finding per (line, kind).
 * An `other` finding also needs a concrete act and the learner's own words expressing it — otherwise it
 * is dropped here and leaves no trace downstream (Scenario Pack V1, `other` evidence gate).
 */
export function parseSafetyScreen(v: unknown, turns: Turn[]): ScreenFinding[] | null {
  if (!v || typeof v !== "object" || !Array.isArray((v as { findings?: unknown }).findings)) return null;
  const seen = new Set<string>();
  const out: ScreenFinding[] = [];
  for (const f of (v as { findings: unknown[] }).findings) {
    const r = f as Record<string, unknown>;
    const i = r.line;
    if (typeof i !== "number" || !Number.isInteger(i) || turns[i]?.role !== "tc") continue;
    if (typeof r.kind !== "string" || !(CONCERN_KINDS as readonly string[]).includes(r.kind)) continue;
    if (r.kind === "other" && !acceptOtherFinding(r.act, r.evidence, turns[i]!.text)) continue;
    const key = `${i}|${r.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ turnIndex: i, kind: r.kind as ConcernKind, explanation: typeof r.explanation === "string" ? r.explanation : "" });
  }
  return out;
}
