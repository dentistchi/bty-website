import { CASE_001 } from "@/domain/clinical-reasoning/case001";

export type EncounterIntent = "patient_question" | "clinical_exam" | "diagnostic_test" | "imaging_request" | "media_request" | "differential_update" | "diagnosis" | "treatment_decision" | "followup_plan" | "confidence" | "rationale" | "unsupported";
/** `response` is the canonical clinical fact. Patient and objective wording are authored separately. */
export type EncounterFact = { id: string; kind: "patient" | "exam" | "test" | "imaging"; aliases: string[]; response: string; patientResponse?: string; objectiveResponse?: string };
export type EncounterMediaAsset = { id: string; aliases: string[]; asset: { url: string; alt: string } };
export type ClinicalEncounterCaseV2 = { caseId: string; version: string; chiefComplaint: string; patientFacts: EncounterFact[]; objectiveFindings: EncounterFact[]; tests: EncounterFact[]; media: EncounterMediaAsset[]; hiddenImagingTruth?: EncounterFact[]; hiddenReference: { rubric: string[]; clinicianValidationStatus: "pending" | "validated" } };

const evidence = (id: string) => CASE_001.evidence.find(e => e.id === id)!;
const fact = (id: string, kind: EncounterFact["kind"], options: Partial<Pick<EncounterFact, "aliases" | "response" | "patientResponse" | "objectiveResponse">> = {}): EncounterFact => {
  const source = evidence(id);
  return { id, kind, aliases: [...new Set([source.label, ...source.aliases, ...(options.aliases ?? [])])], response: options.response ?? source.result, patientResponse: options.patientResponse, objectiveResponse: options.objectiveResponse };
};

export const CASE_001_ENCOUNTER: ClinicalEncounterCaseV2 = {
  caseId: CASE_001.caseId, version: "2.0.0", chiefComplaint: "I fell earlier today and broke my two front teeth.",
  patientFacts: [
    fact("trauma-timing", "patient", { aliases: ["what happened", "how did this happen", "how did it happen", "how did you break your teeth", "when did this happen", "when was the accident", "how long ago did this happen", "tell me what happened"], patientResponse: "It happened about two hours ago. I fell and hit my front teeth. I did not lose consciousness." }),
    fact("previous-trauma-treatment", "patient", { patientResponse: "No, I haven't injured or had treatment on these teeth before." }),
    fact("spontaneous-pain", "patient", { patientResponse: "No, it doesn't hurt right now." }),
  ],
  objectiveFindings: [fact("fracture-extent", "exam"), fact("pulp-exposure", "exam", { objectiveResponse: "No visible pulp exposure is present." }), fact("mobility", "exam", { aliases: ["mobile", "is mobile", "check if mobile"] }), fact("displacement", "exam"), fact("probing", "exam"), fact("occlusion", "exam")],
  tests: [fact("cold-8", "test"), fact("cold-9", "test"), fact("cold-control", "test"), fact("percussion", "test"), fact("palpation", "test"), fact("bite-symptoms", "test")],
  // Learner-visible assets only. Case 001 has not yet authored a PA image or clinical photo.
  media: [],
  // Author truth remains separate and is never revealed by a media request.
  hiddenImagingTruth: [fact("radiograph", "imaging"), fact("root-fracture", "imaging"), fact("alveolar-fracture", "imaging")],
  hiddenReference: { rubric: CASE_001.rubric.criticalEvidenceIds, clinicianValidationStatus: "pending" },
};

export type EncounterEventV2 = { sequence: number; timestamp: string; elapsedMs: number; type: string; doctorMessage?: string; intent?: EncounterIntent; canonicalIds?: string[]; response?: string };
/** A future provider may propose only intent, canonical ids, targets, and ambiguity; Case Truth remains authoritative. */
export type EncounterInterpretation = { intent: EncounterIntent; canonicalIds: string[]; ambiguous: boolean; resolution: "resolved" | "ambiguous" | "unavailable" };

const tokenize = (value: string) => value.toLowerCase().match(/#?\d+|[a-z]+/g) ?? [];
const hasPhrase = (tokens: string[], phrase: string) => { const candidate = tokenize(phrase); return candidate.length > 0 && tokens.some((_, index) => { const window = tokens.slice(index, index + candidate.length); return window.length === candidate.length && window.every((value, offset) => value === candidate[offset]); }); };
const includesAnyPhrase = (tokens: string[], phrases: string[]) => phrases.some(phrase => hasPhrase(tokens, phrase));
const includesTokenPrefix = (tokens: string[], prefix: string) => tokens.some(token => token.startsWith(prefix));
const matchedAliasLength = (tokens: string[], aliases: string[]) => Math.max(0, ...aliases.filter(alias => hasPhrase(tokens, alias)).map(alias => tokenize(alias).length));
const factIdsFor = <T extends { id: string; aliases: string[] }>(tokens: string[], facts: T[]) => {
  const matches = facts.map(fact => ({ fact, score: matchedAliasLength(tokens, fact.aliases) })).filter(match => match.score > 0);
  const highestScore = Math.max(0, ...matches.map(match => match.score));
  return matches.filter(match => match.score === highestScore).map(match => match.fact.id);
};

function intentFor(tokens: string[]): EncounterIntent {
  if (includesAnyPhrase(tokens, ["x ray", "xray", "radiograph", "periapical", "pa"])) return "imaging_request";
  if (includesAnyPhrase(tokens, ["photo", "image"])) return "media_request";
  if (includesAnyPhrase(tokens, ["cold", "percussion", "palpation", "probe", "probing"])) return "diagnostic_test";
  if ((hasPhrase(tokens, "do you") || hasPhrase(tokens, "are you")) && !tokens.includes("pulp")) return "patient_question";
  if (includesAnyPhrase(tokens, ["pulp", "mobility", "check mobility", "assess mobility", "fracture", "occlusion", "occlusal", "displacement", "probing", "check if"])) return "clinical_exam";
  if (includesTokenPrefix(tokens, "diagnos")) return "diagnosis";
  if (includesTokenPrefix(tokens, "treat")) return "treatment_decision";
  if (includesAnyPhrase(tokens, ["follow up", "followup"])) return "followup_plan";
  if (includesAnyPhrase(tokens, ["differential"])) return "differential_update";
  return "patient_question";
}
function requestedTestIds(tokens: string[], tests: EncounterFact[]) { if (!tokens.includes("cold")) return factIdsFor(tokens, tests); const targets = ["#8", "#9"].filter(target => tokens.includes(target)); return targets.length ? targets.map(target => `cold-${target.slice(1)}`) : factIdsFor(tokens, tests); }
export function interpretEncounter(input: string, c = CASE_001_ENCOUNTER): EncounterInterpretation {
  const tokens = tokenize(input); const intent = intentFor(tokens);
  const canonicalIds = intent === "imaging_request" || intent === "media_request" ? factIdsFor(tokens, c.media) : intent === "clinical_exam" ? hasPhrase(tokens, "root fracture") ? [] : factIdsFor(tokens, c.objectiveFindings) : intent === "diagnostic_test" ? requestedTestIds(tokens, c.tests) : intent === "patient_question" ? factIdsFor(tokens, c.patientFacts) : [];
  const resolution = canonicalIds.length ? "resolved" : tokens.length ? "unavailable" : "ambiguous";
  return { intent, canonicalIds, ambiguous: canonicalIds.length === 0, resolution };
}
function unknownResponse(intent: EncounterIntent) { if (intent === "imaging_request") return "No PA image has been authored for this case yet."; if (intent === "media_request") return "No clinical photo has been authored for this case yet."; if (intent === "clinical_exam" || intent === "diagnostic_test") return "That exact finding is not available in this case. Request an authored examination, test, or image."; return "I don't know that. That exact information is not available in this case. Please ask about something I can report or request an examination, test, or image."; }
export function respondToEncounter(input: string, c = CASE_001_ENCOUNTER) {
  const interpretation = interpretEncounter(input, c);
  if (["diagnosis", "treatment_decision", "followup_plan", "differential_update"].includes(interpretation.intent)) return { ...interpretation, response: "Your clinical reasoning was recorded." };
  if (!interpretation.canonicalIds.length) return { ...interpretation, response: unknownResponse(interpretation.intent) };
  if (interpretation.intent === "imaging_request" || interpretation.intent === "media_request") {
    const mediaAssets = c.media.filter(asset => interpretation.canonicalIds.includes(asset.id)).map(asset => asset.asset);
    return { ...interpretation, response: "Authored media asset available.", mediaAssets };
  }
  const facts = [...c.patientFacts, ...c.objectiveFindings, ...c.tests];
  return { ...interpretation, response: interpretation.canonicalIds.map(id => { const fact = facts.find(candidate => candidate.id === id); return fact?.kind === "patient" ? fact.patientResponse ?? fact.response : fact?.objectiveResponse ?? fact?.response; }).join(" ") };
}
export const ENCOUNTER_TRACE_V2 = "clinical-encounter-trace/v2" as const;
export type EncounterTraceV2 = { traceId: string; caseId: string; caseVersion: string; schemaVersion: typeof ENCOUNTER_TRACE_V2; events: EncounterEventV2[] };
export function appendEncounterEvent(t: EncounterTraceV2, e: Omit<EncounterEventV2, "sequence" | "timestamp" | "elapsedMs">, at = new Date().toISOString()): EncounterTraceV2 { return { ...t, events: [...t.events, { ...e, sequence: t.events.length + 1, timestamp: at, elapsedMs: Math.max(0, new Date(at).getTime() - new Date(t.events[0]?.timestamp ?? at).getTime()) }] }; }
