import {
  CASE_001_ENCOUNTER, appendEncounterEvent, respondToEncounter,
  type EncounterTraceV2,
} from "./encounter";

export const decisionEventTypes = {
  differential: "differential_updated",
  diagnosis: "diagnosis_submitted",
  treatment: "treatment_submitted",
  followup: "followup_submitted",
  confidence: "confidence_submitted",
  rationale: "rationale_submitted",
} as const;
export type EncounterDecision = Record<keyof typeof decisionEventTypes, string>;
export const emptyDecision: EncounterDecision = {
  differential: "", diagnosis: "", treatment: "", followup: "", confidence: "", rationale: "",
};

export function startEncounter(id: string, at = new Date().toISOString()): EncounterTraceV2 {
  return {
    traceId: id, caseId: CASE_001_ENCOUNTER.caseId, caseVersion: CASE_001_ENCOUNTER.version,
    schemaVersion: "clinical-encounter-trace/v2",
    events: [
      { sequence: 1, timestamp: at, elapsedMs: 0, type: "encounter_started" },
      { sequence: 2, timestamp: at, elapsedMs: 0, type: "chief_complaint_presented", response: CASE_001_ENCOUNTER.chiefComplaint },
    ],
  };
}

export function isEncounterCompleted(t: EncounterTraceV2) {
  return t.events.some(e => e.type === "encounter_completed");
}
/** JSONB can reorder object keys. Compare raw event values without changing the trace. */
export function sameEncounterTrace(a: EncounterTraceV2, b: EncounterTraceV2) {
  const events = (t: EncounterTraceV2) => JSON.stringify(t.events.map(e =>
    Object.fromEntries(Object.entries(e).sort(([left], [right]) => left.localeCompare(right)))));
  return a.traceId === b.traceId && a.caseId === b.caseId && a.caseVersion === b.caseVersion
    && a.schemaVersion === b.schemaVersion && events(a) === events(b);
}
function editable(t: EncounterTraceV2) {
  if (isEncounterCompleted(t)) throw new Error("IMMUTABLE");
}
export function submit(t: EncounterTraceV2, message: string, at = new Date().toISOString()) {
  editable(t);
  if (!message.trim()) return t;
  const r = respondToEncounter(message);
  let n = appendEncounterEvent(t, { type: "doctor_message", doctorMessage: message }, at);
  n = appendEncounterEvent(n, { type: "intent_interpreted", intent: r.intent, canonicalIds: r.canonicalIds }, at);
  const type = r.intent === "patient_question" ? "patient_answered"
    : r.intent === "diagnostic_test" ? "diagnostic_result_revealed"
    : r.intent === "imaging_request" || r.intent === "media_request" ? "media_requested" : "clinical_finding_revealed";
  return appendEncounterEvent(n, { type, response: r.response, canonicalIds: r.canonicalIds }, at);
}

export function decisionFromTrace(t: EncounterTraceV2): EncounterDecision {
  return Object.fromEntries(Object.entries(decisionEventTypes).map(([field, type]) => [
    field, t.events.filter(e => e.type === type).at(-1)?.response ?? "",
  ])) as EncounterDecision;
}

export function recordDecision(t: EncounterTraceV2, decision: EncounterDecision, at = new Date().toISOString()) {
  editable(t);
  const prior = decisionFromTrace(t);
  return (Object.keys(decisionEventTypes) as (keyof EncounterDecision)[]).reduce((trace, field) => {
    const value = decision[field].trim();
    return value === prior[field] ? trace : appendEncounterEvent(trace, {
      type: decisionEventTypes[field], response: value,
    }, at);
  }, t);
}

export function completeEncounter(t: EncounterTraceV2, decision: EncounterDecision, at = new Date().toISOString()) {
  editable(t);
  if (["diagnosis", "treatment", "followup", "confidence", "rationale"].some(k => !decision[k as keyof EncounterDecision].trim())) {
    throw new Error("FINAL_REASONING_REQUIRED");
  }
  let next = recordDecision(t, decision, at);
  // Keep an explicit differential checkpoint even when the learner reports none.
  if (!next.events.some(e => e.type === decisionEventTypes.differential)) {
    next = appendEncounterEvent(next, { type: decisionEventTypes.differential, response: decision.differential.trim() }, at);
  }
  return appendEncounterEvent(next, { type: "encounter_completed" }, at);
}
