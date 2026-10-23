import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import catalog from "@/domain/clinical-pilot/catalog.json";
import { applyPilotAction, hasRequest, PILOT_SCHEMA, publicCase, referenceFor, startPilot,
  type AuthorCase, type PilotAction, type PilotTrace } from "@/domain/clinical-pilot/pilot";

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
  const at = new Date().toISOString();
  const snapshot = publicCase(c);
  const t = startPilot(input.traceId, snapshot, hash(snapshot), input.requestId, at, prior);
  const result = await db.from(table).insert({ trace_id: t.traceId, user_id: userId, case_id: c.caseId, case_version: c.version,
    trace_schema_version: PILOT_SCHEMA, trace_role: "learner", raw_trace: t, derived_metrics: {}, status: "active",
    source_product: "BTY Clinical Cases Author Pilot", content_provenance: { caseHash: t.caseHash, source: "Dr. Chi author capture", sourceSections: c.sourceSections, referenceReviewStatus: "pending" },
    started_at: at, completed_at: null, updated_at: at }).select("trace_id").maybeSingle();
  if (result.error || !result.data) throw Error(result.error?.code === "23505" ? "CONFLICT" : "SAVE_FAILED");
  return t;
}
export async function mutatePilot(db: SupabaseClient, userId: string, traceId: string, requestId: string, action: PilotAction) {
  const old = await scope(db, userId).eq("trace_id", traceId).maybeSingle();
  if (old.error) throw Error("LOAD_FAILED");
  if (!old.data) throw Error("NOT_FOUND");
  const row = old.data as Stored;
  if (hasRequest(row.raw_trace, requestId)) return row.raw_trace;
  const c = requireCase(row.raw_trace.caseId, row.raw_trace.caseVersion);
  const at = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString();
  const prior = action.operation === "submit" && await priorSubmission(db, userId, row.raw_trace.caseId, traceId);
  const t = applyPilotAction(prior ? { ...row.raw_trace, priorReferenceExposure: "prior_submission" } : row.raw_trace, action, requestId, at, referenceFor(c));
  // Optimistic concurrency: preserve the previous raw-event prefix, including across tabs.
  const result = await db.from(table).update({ raw_trace: t, status: t.phase === "completed" ? "completed" : "active",
    completed_at: t.phase === "completed" ? at : null, updated_at: at,
    derived_metrics: { method: "side-by-side-author-reference/v1", referenceVersion: c.version, medicalAccuracyScore: null } })
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
