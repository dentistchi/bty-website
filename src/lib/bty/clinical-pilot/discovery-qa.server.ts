/** Synthetic QA only. No service, database, auth, gateway listener or learner-store import. */
import { createHash, randomUUID } from "node:crypto";
import catalog from "@/domain/clinical-pilot/catalog.json";
import { applyDiscoveryAction, discoveryTurns, initialAssessment, startDiscoveryPilot, type DiscoveryChannel, type DiscoveryReply } from "@/domain/clinical-pilot/discovery";
import { applyPilotAction, referenceFor, releasedReference, type AuthorCase, type PilotReference, type Reaction } from "@/domain/clinical-pilot/pilot";
import { discoveryPatients } from "./discovery-cases.server";
import { respondToDiscovery } from "./discovery-router.server";

export type QaTurn = {
  question: string; channel: DiscoveryChannel; expectedFactIds: string[]; expectedAvailableFactIds: string[];
  acceptedFactIds?: string[]; answerPatterns?: string[]; expectedResolution?: DiscoveryReply["resolution"];
  required?: boolean; reason: string;
};
export type QaJourney = { caseId: string; packVersion: string; turns: QaTurn[]; contentGaps: { topic: string; reason: string }[] };
export type QaMode = "rules" | "model";
type Responder = typeof respondToDiscovery;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The only state is an in-memory synthetic trace, never a production session. */
export function createQaEncounter(journey: QaJourney, options: { mode?: QaMode; responder?: Responder; traceId?: string; requestId?: string } = {}) {
  const mode = options.mode ?? "rules";
  if (mode === "model" && (!process.env.CLINICAL_DISCOVERY_LLM_BASE_URL || !process.env.CLINICAL_DISCOVERY_LLM_MODEL)) {
    throw Error("Explicit local-model configuration is required for --mode model");
  }
  const patient = discoveryPatients.find(p => p.caseId === journey.caseId && p.version === journey.packVersion);
  const source = (catalog as AuthorCase[]).find(c => c.caseId === journey.caseId);
  if (!patient || !source) throw Error(`Unknown QA case/pack: ${journey.caseId}@${journey.packVersion}`);
  for (const turn of journey.turns) for (const id of [...turn.expectedFactIds, ...(turn.acceptedFactIds ?? [])]) {
    if (!patient.facts.some(f => f.id === id)) throw Error(`Unknown expected fact: ${id}`);
  }
  const patientHash = digest(patient);
  const snapshot = { caseId: source.caseId, number: source.number, version: source.version,
    title: `Patient encounter ${String(source.number).padStart(3, "0")}`, scenario: patient.chiefComplaint,
    findings: [], question: "Meet your patient. Decide what to ask and examine.", available: true };
  const start = Date.now();
  let tick = 0;
  const at = () => new Date(start + tick++ * 1000).toISOString();
  let trace = startDiscoveryPilot(options.traceId ?? randomUUID(), snapshot, digest({ source, patient }), options.requestId ?? randomUUID(), at(), false, patient.version);
  if (patient.facts.some(f => f.provenance)) {
    trace.discovery!.scenarioProvenance = "fictional-extension-awaiting-review";
    trace.events[0].payload.scenarioProvenance = "fictional-extension-awaiting-review";
  }
  const invariantErrors: string[] = [];
  const acquired = () => [...new Set(discoveryTurns(trace).flatMap(t => t.reply.availableFactIds))];
  function apply(action: Parameters<typeof applyDiscoveryAction>[1], reply?: DiscoveryReply) {
    const before = trace;
    const reference: PilotReference = referenceFor(source!);
    if (action.operation === "conclude") reference.interviewContext = { packVersion: patient!.version,
      facts: patient!.facts.map(f => ({ factId: f.id, channel: f.channel, label: f.topic, answer: f.answer,
        available: f.available !== false, provenance: f.provenance ?? "recorded-case-context" })) };
    trace = applyDiscoveryAction(trace, action, randomUUID(), at(), reference, reply);
    if (!same(trace.events.slice(0, before.events.length), before.events)) invariantErrors.push("raw-event-prefix-changed");
    if (trace.phase === "draft" && releasedReference(trace)) invariantErrors.push("reference-released-before-assessment");
    if (action.operation !== "message" && !same(trace.events[before.events.length].payload.informationAvailable, acquired())) {
      invariantErrors.push("assessment-information-does-not-match-issued-available-facts");
    }
    if (digest(patient) !== patientHash) invariantErrors.push("patient-pack-mutated");
  }
  return {
    patient, snapshot, patientHash, invariantErrors,
    get trace() { return trace; },
    async message(question: string, channel: DiscoveryChannel) {
      // Match the production service's context window, using actual prior issued replies.
      const context = discoveryTurns(trace).slice(-4).map(t => ({ question: t.question, channel: t.channel, factIds: t.reply.factIds }));
      const reply = await (options.responder ?? respondToDiscovery)(question, channel, patient, context, { allowModel: mode === "model" });
      const known = new Map(patient.facts.map(f => [f.id, f]));
      if (reply.factIds.some(id => !known.has(id))) invariantErrors.push("unknown-patient-fact-disclosed");
      if (reply.availableFactIds.some(id => !known.has(id) || known.get(id)!.available === false)) invariantErrors.push("unavailable-fact-recorded-as-acquired");
      if (reply.unavailableFactIds.some(id => !known.has(id) || known.get(id)!.available !== false)) invariantErrors.push("available-fact-recorded-as-unavailable");
      const available = reply.factIds.filter(id => known.get(id)?.available !== false);
      const unavailable = reply.factIds.filter(id => known.get(id)?.available === false);
      if (!same([...new Set(reply.availableFactIds)].sort(), [...new Set(available)].sort())
        || !same([...new Set(reply.unavailableFactIds)].sort(), [...new Set(unavailable)].sort())) {
        invariantErrors.push("issued-facts-and-availability-partition-disagree");
      }
      apply({ operation: "message", text: question, channel }, reply);
      return reply;
    },
    working(text = "Synthetic QA: gathering further information before concluding.") { apply({ operation: "decision", text }); },
    conclude(text = "Synthetic QA: assess the information obtained and retain uncertainty where the case is incomplete.") { apply({ operation: "conclude", text }); },
    react(reaction: Reaction = { helpful: "partly", comment: "Synthetic QA, not a doctor's training response.", revisedPlan: "" }) {
      const before = trace;
      const assessment = initialAssessment(trace);
      trace = applyPilotAction(trace, { operation: "react", reaction }, randomUUID(), at(), referenceFor(source));
      if (!same(trace.events.slice(0, before.events.length), before.events) || initialAssessment(trace) !== assessment) invariantErrors.push("reaction-mutated-initial-record");
      if (trace.phase !== "completed") invariantErrors.push("encounter-did-not-complete");
    },
  };
}

export async function runQaJourney(journey: QaJourney, options: { mode?: QaMode; responder?: Responder } = {}) {
  const session = createQaEncounter(journey, options);
  const startedAt = new Date().toISOString();
  const rows = [];
  for (const [index, turn] of journey.turns.entries()) {
    const previouslyIssued = new Set(discoveryTurns(session.trace).flatMap(t => t.reply.factIds));
    const before = performance.now();
    const reply = await session.message(turn.question, turn.channel);
    const allowed = [...turn.expectedFactIds, ...(turn.acceptedFactIds ?? [])];
    const extra = reply.factIds.filter(id => !allowed.includes(id));
    const missing = turn.expectedFactIds.filter(id => !reply.factIds.includes(id));
    const missingAvailable = turn.expectedAvailableFactIds.filter(id => !reply.availableFactIds.includes(id));
    const resolutionMismatch = !!turn.expectedResolution && turn.expectedResolution !== reply.resolution;
    const answerMismatches = (turn.answerPatterns ?? []).filter(pattern => !new RegExp(pattern, "iu").test(reply.text));
    const routingIssue = extra.length > 0 || missing.length > 0 || missingAvailable.length > 0 || resolutionMismatch;
    // A correct unavailable reply is still a case-content gap, not a usable clinical answer.
    const unavailableExpected = turn.expectedFactIds.filter(id => session.patient.facts.find(f => f.id === id)!.available === false);
    const contentGap = unavailableExpected.length > 0 || turn.expectedResolution === "unavailable"
      || !routingIssue && (answerMismatches.length > 0 || !!reply.unavailableTopicIds?.length);
    rows.push({ number: index + 1, question: turn.question, channel: turn.channel, reason: turn.reason,
      required: turn.required === true, expectedFactIds: turn.expectedFactIds, acceptedFactIds: turn.acceptedFactIds ?? [],
      actualFactIds: reply.factIds, availableFactIds: reply.availableFactIds, unavailableFactIds: reply.unavailableFactIds,
      unavailableTopicIds: reply.unavailableTopicIds ?? [], text: reply.text, resolution: reply.resolution,
      method: reply.routing.method, routerVersion: reply.routing.version, fallback: reply.routing.fallback ?? null,
      ms: Math.round(performance.now() - before), extra, missing, missingAvailable, resolutionMismatch,
      newExtraDisclosures: extra.filter(id => !previouslyIssued.has(id)),
      newExtraAvailableDisclosures: extra.filter(id => !previouslyIssued.has(id) && reply.availableFactIds.includes(id)), repeatedExtraSelections: extra.filter(id => previouslyIssued.has(id)),
      answerMismatches, answerChecked: !!turn.answerPatterns?.length, routingIssue, contentGap });
    if (index === Math.floor(journey.turns.length / 2)) session.working();
  }
  session.conclude();
  session.react();
  return { caseId: journey.caseId, packVersion: journey.packVersion, patientHash: session.patientHash, startedAt,
    finishedAt: new Date().toISOString(), mode: options.mode ?? "rules", synthetic: true, persistedToLearnerStore: false,
    assessmentTimestampsAreSynthetic: true, completedInMemory: session.trace.phase === "completed",
    routingIssueTurns: rows.filter(r => r.routingIssue).length,
    answerMismatchTurns: rows.filter(r => r.answerMismatches.length).length,
    requiredContentGapTurns: rows.filter(r => r.required && r.contentGap).length,
    declaredContentGaps: journey.contentGaps, invariantErrors: session.invariantErrors, rows };
}
