import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

/** Interpretation metadata only. These IDs point to existing patient statements;
 * no examination finding, author recommendation, provider or procedure is inferred.
 * An empty row explicitly records that this pack supplies no procedure history.
 */
type ProcedureSource = { suffix: string; teeth?: readonly number[]; recent?: boolean };
export const DENTAL_PROCEDURE_SOURCES: Readonly<Record<string, readonly ProcedureSource[]>> = {
  "drchi-001": [], "drchi-002": [],
  "drchi-003": [{ suffix: "treatment-history" }], "drchi-004": [{ suffix: "rct-timing" }],
  "drchi-005": [{ suffix: "rct-history" }], "drchi-006": [{ suffix: "restoration-history" }],
  "drchi-007": [], "drchi-008": [], "drchi-009": [], "drchi-010": [],
  "drchi-011": [{ suffix: "history", teeth: [30] }, { suffix: "recurrence", teeth: [30], recent: true }],
  "drchi-012": [], "drchi-013": [{ suffix: "history" }],
  "drchi-014": [], "drchi-015": [], "drchi-016": [], "drchi-017": [], "drchi-018": [],
  "drchi-019": [{ suffix: "procedure", teeth: [32] }], "drchi-020": [],
  "drchi-021": [{ suffix: "history" }], "drchi-022": [{ suffix: "history", teeth: [3] }],
  "drchi-023": [{ suffix: "history", teeth: [30] }],
};
const VERSION = "discovery-2026-10-23.1";
const variantSource: readonly ProcedureSource[] = [{ suffix: "restoration-age" }];
const normalized = (text: string) => text.normalize("NFKC").replace(/[‘’]/gu, "'").trim();

export function treatmentHistoryFacts(patient: DiscoveryPatient, question = ""): DiscoveryFact[] {
  const isVariant = patient.caseId === "drchi-001" && [VERSION + "-variant-a", VERSION + "-variant-b"].includes(patient.version);
  if (patient.version !== VERSION && !isVariant) return [];
  let sources = isVariant ? variantSource : DENTAL_PROCEDURE_SOURCES[patient.caseId] ?? [];
  // "Last time" asks about the repeat intervention, not the original delivery.
  if (/\b(?:last (?:time|visit|appointment|treatment|procedure)|most recent|latest)\b/iu.test(question) && sources.some(source => source.recent)) {
    sources = sources.filter(source => source.recent);
  }
  const teeth = [...question.matchAll(/(?:#\s*|\btooth\s*(?:number\s*)?)([1-9]|[12]\d|3[0-2])\b/giu)].map(match => Number(match[1]));
  return patient.facts.filter(fact => fact.channel === "patient" && sources.some(source => fact.id === `${patient.caseId}:${source.suffix}`
    // A tooth without authored subject metadata is unknown, not the focal tooth by assumption.
    && (!teeth.length || teeth.some(tooth => (fact.toothNumbers ?? source.teeth ?? []).includes(tooth)))));
}

// Split only a new request head; "root canal and crown" stays a single history topic.
export function treatmentHistoryClauses(text: string): string[] {
  return normalized(text).split(/[?;!]+|\.(?:\s|$)|\b(?:and|also|plus)\s+(?=(?:what|which|when|how|is|are|does|do|did|has|have|can|could|check|inspect|examine|assess|evaluate|obtain|order|take|get|perform|test|measure|probe|palpate|percuss)\b)/iu)
    .map(clause => clause.replace(/^[,\s]+|[,\s]+$/gu, "")).filter(Boolean);
}

/** Full-clause shapes keep a bare dental-encounter question useful while excluding
 * "what did we do at the meeting" and future treatment decisions. */
export function isTreatmentHistoryQuestion(text: string): boolean {
  const question = normalized(text);
  if (/\b(?:should|will|would|recommend|plan|options?|prognosis|prescribe|medical|medication|prolia|denosumab|meeting|dinner|parking)\b/iu.test(question)) return false;
  const target = String.raw`(?:(?:to|on|for)\s+(?:(?:this|that|the|my|your|his|her)\s+)?(?:tooth(?:\s*(?:number\s*)?#?\s*\d{1,2})?|teeth|crown|implant|pain|discomfort|#\s*\d{1,2})|here|before|previously|already|last time|(?:on |at )?(?:the |our |your |my )?last (?:visit|appointment))`;
  const tails = `(?:\\s+${target})*`;
  const actor = String.raw`(?:we|you|they|I|the dentist|my dentist)`;
  const shapes = [
    String.raw`what\s+did\s+${actor}\s+do${tails}`,
    String.raw`what\s+(?:(?:dental|prior|previous|past)\s+)?(?:treatment|work|procedure)s?\s+(?:did\s+${actor}\s+(?:do|perform|receive|have)|(?:was|were)\s+(?:done|performed|completed))${tails}`,
    String.raw`what\s+(?:was|has been|had been)\s+(?:done|performed|completed)${tails}`,
    String.raw`what\s+(?:have|had)\s+${actor}\s+(?:had\s+)?done${tails}`,
    String.raw`what\s+(?:(?:dental|prior|previous|past)\s+)?(?:treatment|work|procedure)s?\s+(?:have|had)\s+${actor}\s+(?:had|received)${tails}`,
    String.raw`any\s+(?:prior|previous|past)\s+work\s+(?:on|to)\s+(?:this|that|the)\s+tooth`,
    String.raw`what\s+was\s+(?:the\s+)?last\s+(?:dental\s+)?(?:treatment|procedure)${tails}`,
    String.raw`(?:any|what)\s+(?:(?:prior|previous|past)\s+)?dental\s+(?:work|treatment|procedures?)(?:\s+(?:have|had)\s+(?:you|they)\s+(?:had|received))?${tails}`,
    String.raw`what\s+(?:(?:prior|previous|past)\s+)?dental\s+(?:work|treatment|procedures?)\s+did\s+(?:#\s*\d{1,2}|tooth\s*\d{1,2})\s+have`,
  ];
  return shapes.some(shape => new RegExp(`^(?:please\\s+)?${shape}[.\\s]*$`, "iu").test(question));
}

type PriorRequest = { question: string; channel: "patient" | "exam"; factIds: string[] };
/** Timing follows one immediately preceding, authored procedure source only.
 * null asks for clarification; undefined means this is not a bare timing request. */
export function repeatTreatmentTiming(text: string, patient: DiscoveryPatient, context: readonly PriorRequest[]): DiscoveryFact | null | undefined {
  const question = normalized(text);
  const timing = /^(?:(?:and|so|roughly|about)\s+)?(?:how long ago(?:\s+was\s+(?:that|it|this)\s+(?:done|placed|put in|completed|performed))?|when\s+was\s+(?:that|it|this)\s+(?:done|placed|put in|completed|performed))(?:\s+(?:to|on)\s+(?:#\s*\d{1,2}|tooth\s*(?:number\s*)?\d{1,2}))?[?.!\s]*$/iu;
  if (!timing.test(question)) return;
  const last = context.at(-1);
  if (last?.factIds.length !== 1) return null;
  const previous = patient.facts.find(fact => fact.id === last.factIds[0] && fact.available !== false);
  // An examination can establish the presence of a restoration without revealing
  // its age. Keep the pre-existing, model-mediated explicit placement follow-up;
  // this repeat-only helper must neither answer nor block that separate request.
  if (previous?.channel === "exam" && /\brestoration\b/iu.test(`${previous.id.slice(previous.id.lastIndexOf(":") + 1)} ${previous.topic}`)
    && /\b(?:put in|placed|done|completed|performed)\b/iu.test(question)) return;
  return treatmentHistoryFacts(patient, question).find(fact => fact.id === last.factIds[0] && fact.available !== false) ?? null;
}

/** A provider is separate from the procedure. First-person wording in a doctor's
 * question does not establish that this doctor performed the recorded treatment. */
export function asksPriorTreatmentProvider(text: string, patient: DiscoveryPatient, context: readonly PriorRequest[]): boolean {
  if (!/^(?:and\s+)?who\s+(?:(?:did|performed)\s+(?:it|that|this|that treatment|the treatment|that procedure)|was\s+the\s+(?:dentist|clinician|provider))[?.!\s]*$/iu.test(normalized(text))) return false;
  const last = context.at(-1);
  return last?.factIds.length === 1 && treatmentHistoryFacts(patient).some(fact => fact.id === last.factIds[0] && fact.available !== false);
}
