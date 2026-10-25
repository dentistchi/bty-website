import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import catalog from "@/domain/clinical-pilot/catalog.json";
import { applyPilotAction, hasRequest, PILOT_SCHEMA, publicCase, referenceFor,
  type AuthorCase, type PilotAction, type PilotTrace, type PilotCase } from "@/domain/clinical-pilot/pilot";
import { applyDiscoveryAction, discoveryTurns, isDiscoveryTrace, startDiscoveryPilot } from "@/domain/clinical-pilot/discovery";
import { discoveryPatients, founderPreviewPackVersions } from "./discovery-cases.server";
import { isClinicalFounder } from "./founder-preview.server";
import { respondToDiscovery } from "./discovery-router.server";

// Append versions; never replace an entry referenced by an in-flight or historical trace.
const allVersions = catalog as AuthorCase[];
export const authorCases = [...new Map(allVersions.map(c => [c.caseId, c])).values()];
const table = "clinical_reasoning_traces";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const cases = new Map(authorCases.map(c => [c.caseId, c]));
const versions = new Map(allVersions.map(c => [`${c.caseId}@${c.version}`, c]));
export function requireCase(id: string, version?: string) {
  const c = version ? versions.get(`${id}@${version}`) : cases.get(id);
  if (!c || !c.available) throw Error("INVALID_CASE");
  return c;
}
/** A frozen attempt resolves its own pack by version. A new attempt takes the latest pack open to this
 * user: Founder-preview packs are skipped for everyone not on the allowlist. */
function patientFor(id: string, version?: string, founder = false) {
  const p = [...discoveryPatients].reverse().find(p => p.caseId === id && (version ? p.version === version
    : founder || !founderPreviewPackVersions.has(`${p.caseId}@${p.version}`)));
  if (!p) throw Error("INVALID_CASE");
  return p;
}
/** This projection is the API boundary, not merely a UI concealment. */
export function publicDiscoveryCase(c: AuthorCase): PilotCase {
  const patient = patientFor(c.caseId);
  return { caseId: c.caseId, number: c.number, version: c.version, title: `Patient encounter ${String(c.number).padStart(3, "0")}`,
    scenario: patient.chiefComplaint, findings: [], question: "Meet your patient. Decide what to ask and examine.", available: c.available };
}
type Stored = { trace_id: string; raw_trace: PilotTrace; status: string; updated_at: string };
function scope(db: SupabaseClient, userId: string) {
  return db.from(table).select("trace_id,raw_trace,status,updated_at").eq("user_id", userId)
    .eq("trace_schema_version", PILOT_SCHEMA).eq("trace_role", "learner");
}
export async function readOwnPilot(db: SupabaseClient, userId: string, caseId: string) {
  requireCase(caseId);
  const result = await scope(db, userId).eq("case_id", caseId).order("updated_at", { ascending: false }).limit(20);
  if (result.error) throw Error("LOAD_FAILED");
  return (result.data ?? []) as Stored[];
}
async function priorSubmission(db: SupabaseClient, userId: string, caseId: string, exclude: string) {
  const result = await scope(db, userId).eq("case_id", caseId).neq("trace_id", exclude)
    .in("raw_trace->>phase", ["submitted", "completed"]).limit(1);
  if (result.error) throw Error("LOAD_FAILED");
  return !!result.data?.length;
}
async function priorWrittenContext(db: SupabaseClient, userId: string, caseId: string, exclude: string) {
  const result = await scope(db, userId).eq("case_id", caseId).neq("trace_id", exclude)
    .eq("raw_trace->events->0->payload->>mode", "written-case").limit(1);
  if (result.error) throw Error("LOAD_FAILED");
  return !!result.data?.length;
}
export async function createPilot(db: SupabaseClient, userId: string, input: { traceId: string; caseId: string; caseVersion: string; requestId: string }) {
  const c = requireCase(input.caseId, input.caseVersion);
  const old = await scope(db, userId).eq("trace_id", input.traceId).maybeSingle();
  if (old.error) throw Error("LOAD_FAILED");
  if (old.data) {
    const t = old.data.raw_trace as PilotTrace;
    if (t.caseId !== c.caseId || t.caseVersion !== c.version || !hasRequest(t, input.requestId)) throw Error("CONFLICT");
    return t;
  }
  const prior = await priorSubmission(db, userId, c.caseId, input.traceId);
  const priorContext = await priorWrittenContext(db, userId, c.caseId, input.traceId);
  const at = new Date().toISOString();
  const patient = patientFor(c.caseId, undefined, isClinicalFounder(userId));
  const snapshot = publicDiscoveryCase(c);
  const t = startDiscoveryPilot(input.traceId, snapshot, hash({ case: publicCase(c), patient }), input.requestId, at, prior, patient.version, priorContext);
  if (patient.facts.some(f => f.provenance)) {
    t.discovery!.scenarioProvenance = "fictional-extension-awaiting-review";
    t.events[0].payload.scenarioProvenance = "fictional-extension-awaiting-review";
  }
  const result = await db.from(table).insert({ trace_id: t.traceId, user_id: userId, case_id: c.caseId, case_version: c.version,
    trace_schema_version: PILOT_SCHEMA, trace_role: "learner", raw_trace: t, derived_metrics: {}, status: "active",
    source_product: "BTY Clinical Cases Author Pilot", content_provenance: { caseHash: t.caseHash, interactionVersion: t.discovery!.interactionVersion, packVersion: patient.version,
      scenarioProvenance: t.discovery!.scenarioProvenance ?? "recorded-case-context", patientFacts: "fixed fictional patient context; extensions are separately attributed, not Dr. Chi testimony", source: "Dr. Chi author capture with separately versioned interview context", sourceSections: c.sourceSections, referenceReviewStatus: "pending" },
    started_at: at, completed_at: null, updated_at: at }).select("trace_id").maybeSingle();
  if (result.error || !result.data) throw Error(result.error?.code === "23505" ? "CONFLICT" : "SAVE_FAILED");
  return t;
}
export async function mutatePilot(db: SupabaseClient, userId: string, traceId: string, requestId: string, action: PilotAction, expectedEventCount?: number) {
  const old = await scope(db, userId).eq("trace_id", traceId).maybeSingle();
  if (old.error) throw Error("LOAD_FAILED");
  if (!old.data) throw Error("NOT_FOUND");
  const row = old.data as Stored;
  if (hasRequest(row.raw_trace, requestId)) return row.raw_trace;
  const c = requireCase(row.raw_trace.caseId, row.raw_trace.caseVersion);
  const at = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString();
  const submitting = action.operation === "submit" || action.operation === "conclude";
  const prior = submitting && await priorSubmission(db, userId, row.raw_trace.caseId, traceId);
  const previous = prior ? { ...row.raw_trace, priorReferenceExposure: "prior_submission" as const } : row.raw_trace;
  let t: PilotTrace;
  if (action.operation === "message" || action.operation === "decision" || action.operation === "conclude") {
    if (!isDiscoveryTrace(previous)) throw Error("WRONG_FLOW");
    if (previous.phase !== "draft") throw Error("IMMUTABLE");
    // CAS alone cannot detect a client that was already stale before this read.
    // Do not attribute another tab's newly obtained information to this decision.
    if (expectedEventCount !== previous.events.length) throw Error("CONFLICT");
    const patient = patientFor(c.caseId, previous.discovery!.packVersion);
    if (hash({ case: publicCase(c), patient }) !== previous.caseHash) throw Error("CASE_VERSION_CHANGED");
    const priorContext = action.operation === "conclude" && await priorWrittenContext(db, userId, c.caseId, traceId);
    const current = priorContext ? { ...previous, discovery: { ...previous.discovery!, priorCaseContextExposure: "prior-written-case" as const } } : previous;
    const reply = action.operation === "message" ? await respondToDiscovery(action.text, action.channel, patient,
      discoveryTurns(previous).slice(-4).map(turn => ({ question: turn.question, channel: turn.channel, factIds: turn.reply.factIds })),
      { allowModel: isClinicalFounder(userId) }) : undefined;
    const reference = referenceFor(c);
    if (action.operation === "conclude") reference.interviewContext = { packVersion: patient.version,
      facts: patient.facts.map(f => ({ factId: f.id, channel: f.channel, label: f.topic, answer: f.answer, available: f.available !== false,
        provenance: f.provenance ?? "recorded-case-context" })) };
    t = applyDiscoveryAction(current, action, requestId, at, reference, reply);
  } else t = applyPilotAction(previous, action, requestId, at, referenceFor(c));
  // Optimistic concurrency: preserve the previous raw-event prefix, including across tabs.
  const result = await db.from(table).update({ raw_trace: t, status: t.phase === "completed" ? "completed" : "active",
    completed_at: t.phase === "completed" ? at : null, updated_at: at,
    derived_metrics: { method: isDiscoveryTrace(t) ? "question-led-discovery/v1" : "side-by-side-author-reference/v1", referenceVersion: c.version, medicalAccuracyScore: null } })
    .eq("trace_id", traceId).eq("user_id", userId).eq("trace_schema_version", PILOT_SCHEMA).eq("trace_role", "learner")
    .eq("status", "active").eq("updated_at", row.updated_at).select("trace_id").maybeSingle();
  if (result.error) throw Error("SAVE_FAILED");
  if (!result.data) throw Error("CONFLICT");
  return t;
}
export async function reviewPilots(db: SupabaseClient) {
  const result = await db.from(table).select("trace_id,user_id,raw_trace,status,updated_at,content_provenance,derived_metrics")
    .eq("trace_schema_version", PILOT_SCHEMA).eq("trace_role", "learner").order("updated_at", { ascending: false }).limit(50);
  if (result.error) throw Error("LOAD_FAILED");
  return (result.data ?? []).map(({ user_id, ...row }) => ({ ...row, doctorRef: `subject-${hash(`clinical-pilot:${user_id}`).slice(0, 24)}` }));
}
