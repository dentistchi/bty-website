/** The protected storage envelope also holds explicitly versioned discovery encounters. */
export const PILOT_SCHEMA = "clinical-author-pilot/v1" as const;
export type PilotCase = {
  caseId: string; number: number; version: string; title: string; scenario: string;
  findings: string[]; question: string; available: boolean;
};
export type AuthorCase = PilotCase & {
  authorOriginal: string; authorParaphrase: string; sourceSections: string[];
  limitations: string[]; evidenceNotes: string[];
};
export const responseFields = [
  ["evaluation", "Evaluation", "What would you ask, examine, or test next?"],
  ["diagnosis", "Working diagnosis", "Include uncertainty or insufficient information."],
  ["plan", "Treatment plan", "Include alternatives and what would change your plan."],
  ["rationale", "Reasoning", "Why this approach? What would you tell the patient?"],
] as const;
export type Answers = Record<typeof responseFields[number][0], string>;
export const blankAnswers = (): Answers => ({ evaluation: "", diagnosis: "", plan: "", rationale: "" });
export type Reaction = { helpful: "yes" | "partly" | "no"; comment: string; revisedPlan: string };
export type PilotEvent = {
  sequence: number; requestId: string; type: "case_presented" | "draft_saved" | "reasoning_submitted" | "reference_released" | "reaction_submitted" | "discovery_turn" | "working_assessment" | "assessment_submitted";
  at: string; payload: Record<string, unknown>;
};
export type PilotTrace = {
  traceId: string; caseId: string; caseVersion: string; schemaVersion: typeof PILOT_SCHEMA;
  phase: "draft" | "submitted" | "completed"; caseSnapshot: PilotCase; caseHash: string;
  priorReferenceExposure: "prior_submission" | "not_recorded";
  events: PilotEvent[];
  discovery?: { interactionVersion: "clinical-discovery/v1"; packVersion: string; priorCaseContextExposure: "prior-written-case" | "not_recorded"; scenarioProvenance?: "fictional-extension-awaiting-review" };
};
export type PilotReference = {
  author: "Dr. Chi"; referenceId: string; sourceSections: string[]; version: string; original: string; paraphrase: string;
  reviewStatus: "author-paraphrase-awaiting-review"; limitations: string[]; evidenceNotes: string[];
  label: "Recorded author perspective · clinical validation pending";
  caseContext?: { scenario: string; findings: string[]; question: string };
  interviewContext?: { packVersion: string; facts: { factId: string; channel: "patient" | "exam"; label: string; answer: string; available: boolean; provenance: "recorded-case-context" | "fictional-extension-awaiting-review" }[] };
};
export function publicCase(c: AuthorCase): PilotCase {
  const { caseId, number, version, title, scenario, findings, question, available } = c;
  return { caseId, number, version, title, scenario, findings, question, available };
}
export function referenceFor(c: AuthorCase): PilotReference {
  return { author: "Dr. Chi", referenceId: `${c.caseId}@${c.version}`, sourceSections: c.sourceSections, version: c.version, original: c.authorOriginal, paraphrase: c.authorParaphrase,
    reviewStatus: "author-paraphrase-awaiting-review", limitations: c.limitations, evidenceNotes: c.evidenceNotes,
    label: "Recorded author perspective · clinical validation pending", caseContext: { scenario: c.scenario, findings: c.findings, question: c.question } };
}
export function latestAnswers(t: PilotTrace): Answers {
  const event = [...t.events].reverse().find(e => e.type === "reasoning_submitted" || e.type === "draft_saved");
  return event ? event.payload.answers as Answers : blankAnswers();
}
export function initialAnswers(t: PilotTrace): Answers | null {
  return (t.events.find(e => e.type === "reasoning_submitted")?.payload.answers as Answers) ?? null;
}
export function hasRequest(t: PilotTrace, requestId: string) { return t.events.some(e => e.requestId === requestId); }
export function startPilot(traceId: string, c: PilotCase, caseHash: string, requestId: string, at: string, prior: boolean): PilotTrace {
  return { traceId, caseId: c.caseId, caseVersion: c.version, schemaVersion: PILOT_SCHEMA, phase: "draft", caseSnapshot: c, caseHash,
    priorReferenceExposure: prior ? "prior_submission" : "not_recorded",
    events: [{ sequence: 1, requestId, type: "case_presented", at, payload: { mode: "written-case", priorReferenceExposure: prior ? "prior_submission" : "not_recorded", externalReferenceExposure: "unknown" } }] };
}
export type PilotAction = { operation: "save" | "submit"; answers: Answers } | { operation: "react"; reaction: Reaction } | import("./discovery").DiscoveryAction;
export function applyPilotAction(t: PilotTrace, action: PilotAction, requestId: string, at: string, reference: PilotReference): PilotTrace {
  if (hasRequest(t, requestId)) return t;
  if (action.operation === "message" || action.operation === "decision" || action.operation === "conclude" || t.discovery && action.operation !== "react") throw Error("WRONG_FLOW");
  if (t.phase === "completed" || action.operation === "react" && t.phase !== "submitted"
    || action.operation !== "react" && t.phase !== "draft") throw Error("IMMUTABLE");
  const events = [...t.events];
  const append = (type: PilotEvent["type"], payload: PilotEvent["payload"]) => events.push({ sequence: events.length + 1, requestId, type, at, payload });
  if (action.operation === "react") append("reaction_submitted", { reaction: action.reaction });
  else if ("answers" in action) {
    if (action.operation === "submit" && responseFields.some(([key]) => !action.answers[key].trim())) throw Error("REASONING_REQUIRED");
    append(action.operation === "submit" ? "reasoning_submitted" : "draft_saved", { answers: action.answers });
    if (action.operation === "submit") append("reference_released", { reference });
  } else throw Error("WRONG_FLOW");
  return { ...t, phase: action.operation === "react" ? "completed" : action.operation === "submit" ? "submitted" : "draft", events };
}
export function releasedReference(t: PilotTrace): PilotReference | null {
  return (t.events.find(e => e.type === "reference_released")?.payload.reference as PilotReference) ?? null;
}
