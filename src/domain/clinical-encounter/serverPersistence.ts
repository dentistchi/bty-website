import type { EncounterTraceV2 } from "./encounter";
export const V2_SCHEMA = "clinical-encounter-trace/v2";
export function validateEncounterTrace(x: unknown): x is EncounterTraceV2 {
  if (!x || typeof x !== "object") return false;
  const t = x as EncounterTraceV2;
  return t.schemaVersion === V2_SCHEMA && [t.traceId, t.caseId, t.caseVersion].every(v => typeof v === "string" && v.trim().length > 0)
    && Array.isArray(t.events) && t.events.length > 0 && t.events.every((e, i) =>
      e && e.sequence === i + 1 && typeof e.type === "string" && e.type.length > 0
      && typeof e.timestamp === "string" && Number.isFinite(Date.parse(e.timestamp))
      && Number.isFinite(e.elapsedMs) && e.elapsedMs >= 0
      && (e.response === undefined || typeof e.response === "string")
      && (e.doctorMessage === undefined || typeof e.doctorMessage === "string")
      && (e.canonicalIds === undefined || (Array.isArray(e.canonicalIds) && e.canonicalIds.every(id => typeof id === "string"))));
}
export function encounterRecord(userId: string, t: unknown, status: "active" | "completed" = "active") {
  if (!validateEncounterTrace(t)) throw Error("INVALID_TRACE");
  const completions = t.events.filter(e => e.type === "encounter_completed");
  if (status === "completed" ? completions.length !== 1 || t.events.at(-1)?.type !== "encounter_completed" : completions.length !== 0) {
    throw Error("INVALID_COMPLETION");
  }
  return {
    trace_id: t.traceId, user_id: userId, case_id: t.caseId, case_version: t.caseVersion,
    trace_schema_version: V2_SCHEMA, trace_role: "learner", raw_trace: t,
    derived_metrics: { decisionEvidenceStates: t.events.filter(e => /diagnosis|treatment|followup/.test(e.type)).map(e => ({
      sequence: e.sequence, evidenceIds: t.events.filter(x => x.sequence < e.sequence).flatMap(x => x.canonicalIds ?? []),
    })) },
    status, source_product: "BTY Clinical Encounter Simulator", content_provenance: {},
    started_at: t.events[0].timestamp, completed_at: status === "completed" ? t.events.at(-1)!.timestamp : null,
  };
}
