import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningRewardEvidence } from "@/domain/learning-rewards/types";
import { PILOT_SCHEMA } from "@/domain/clinical-pilot/pilot";
import { DISCOVERY_INTERACTION_VERSION } from "@/domain/clinical-pilot/discovery";
import catalog from "@/domain/clinical-pilot/catalog.json";
import { readPublishedGuidance } from "@/domain/foundry/module/module-publish";
import { readUserTzContext } from "@/lib/bty/daily/userDay";

/**
 * Reconcile already committed, account-owned learning evidence. This adapter is read-only:
 * opening a page, claiming a different account, or asking the browser for points cannot produce
 * a completion. No response, reflection, patient answer or author reference leaves this module.
 *
 * Existing modules do not assign a delayed, distinct revisit variant or a four-step reward path.
 * Consequently they cannot emit assigned_revisit, requiredSteps, or a communication path here.
 * That absence is an integration limit, never evidence that the learner failed a step.
 */
const POLICY = "learning-rewards/v1" as const;
const PAGE_SIZE = 500;
const RELATED_BATCH_SIZE = 100;
type Result = { data: unknown; error: unknown };
type Row = Record<string, unknown>;
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const stamp = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
const object = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const inWindow = (at: unknown, start: number, end: number): at is string => stamp(at) && Date.parse(at) >= start && Date.parse(at) <= end;

/** Keyset paging avoids Supabase's default row limit and never silently drops a later page. */
async function pages<T extends Row>(build: (after: string | null) => PromiseLike<Result>, key: string): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    const result = await build(after);
    if (result.error || !Array.isArray(result.data)) throw Error("LEARNING_REWARD_SOURCE_UNAVAILABLE");
    rows.push(...result.data as unknown as T[]);
    if (result.data.length < PAGE_SIZE) return rows;
    const last = result.data[result.data.length - 1] as Row;
    const next = last?.[key];
    if (!text(next) || after !== null && next <= after) throw Error("LEARNING_REWARD_SOURCE_PAGINATION");
    after = next;
  }
}

async function related<T extends Row>(db: SupabaseClient, table: string, columns: string, key: string, values: string[]): Promise<T[]> {
  const unique = [...new Set(values)];
  const rows: T[] = [];
  for (let at = 0; at < unique.length; at += RELATED_BATCH_SIZE) {
    const result = await db.from(table).select(columns).in(key, unique.slice(at, at + RELATED_BATCH_SIZE));
    if (result.error || !Array.isArray(result.data)) throw Error("LEARNING_REWARD_SOURCE_UNAVAILABLE");
    rows.push(...result.data as unknown as T[]);
  }
  return rows;
}

const knownCases = new Set((catalog as { caseId: string; version: string }[]).map(c => `${c.caseId}@${c.version}`));

async function clinical(db: SupabaseClient, userId: string, start: string, end: string, timezone: string): Promise<LearningRewardEvidence[]> {
  const rows = await pages<Row>(after => {
    let query = db.from("clinical_reasoning_traces")
      .select("trace_id,user_id,case_id,case_version,trace_schema_version,trace_role,status,completed_at,raw_trace")
      .eq("user_id", userId).eq("trace_schema_version", PILOT_SCHEMA).eq("trace_role", "learner")
      .eq("status", "completed").gte("completed_at", start).lte("completed_at", end)
      .order("trace_id", { ascending: true }).limit(PAGE_SIZE);
    if (after) query = query.gt("trace_id", after);
    return query;
  }, "trace_id");
  const found: LearningRewardEvidence[] = [];
  const lower = Date.parse(start), upper = Date.parse(end);
  for (const row of rows) {
    const trace = row.raw_trace;
    // The trace's immutable identity and event order must agree with its owned storage row.
    if (row.user_id !== userId || row.trace_schema_version !== PILOT_SCHEMA || row.trace_role !== "learner" || row.status !== "completed"
      || !object(trace) || trace.traceId !== row.trace_id || trace.caseId !== row.case_id || trace.caseVersion !== row.case_version
      || trace.schemaVersion !== PILOT_SCHEMA || trace.phase !== "completed" || !object(trace.discovery)
      || trace.discovery.interactionVersion !== DISCOVERY_INTERACTION_VERSION || !text(trace.discovery.packVersion)
      || !text(row.trace_id) || !text(row.case_id) || !text(row.case_version) || !knownCases.has(`${row.case_id}@${row.case_version}`)
      || !Array.isArray(trace.events) || !inWindow(row.completed_at, lower, upper)) continue;
    const events = trace.events;
    const assessmentIndex = events.findIndex(e => object(e) && e.type === "assessment_submitted");
    const referenceIndex = events.findIndex(e => object(e) && e.type === "reference_released");
    const reactionIndex = events.findIndex(e => object(e) && e.type === "reaction_submitted");
    if (assessmentIndex < 0 || referenceIndex <= assessmentIndex || reactionIndex <= referenceIndex) continue;
    const assessment = events[assessmentIndex] as Row, reference = events[referenceIndex] as Row, reaction = events[reactionIndex] as Row;
    if (!object(assessment.payload) || !text(assessment.payload.text) || !object(reference.payload)
      || !object(reference.payload.reference) || reference.payload.reference.version !== row.case_version
      || !object(reaction.payload) || !object(reaction.payload.reaction)
      || !["yes", "partly", "no"].includes(String(reaction.payload.reaction.helpful))
      || !stamp(assessment.at) || !stamp(reference.at) || !stamp(reaction.at)
      || Date.parse(assessment.at) > Date.parse(reference.at) || Date.parse(reference.at) > Date.parse(reaction.at)
      || Date.parse(reaction.at) !== Date.parse(row.completed_at)) continue;
    found.push({ policy_version: POLICY, source_type: "clinical_practice", source_id: row.trace_id,
      assignment_key: `clinical:${row.case_id}`, content_key: `clinical:${row.case_id}`, content_version: row.case_version,
      action: "practice", completed_at: reaction.at, timezone, metadata: { clinicalCaseId: row.case_id } });
  }
  return found;
}

async function learned(db: SupabaseClient, userId: string, start: string, end: string, timezone: string): Promise<LearningRewardEvidence[]> {
  const rows = await pages<Row>(after => {
    let query = db.from("foundry_event_training_progress")
      .select("id,event_id,participant_id,linked_user_id,completed_at,response_text,video_completed_at,document_read_completed_at,written_guidance_read_at,discussion_self_reported_at,quiz_attempt_id")
      .eq("linked_user_id", userId).gte("completed_at", start).lte("completed_at", end)
      .order("id", { ascending: true }).limit(PAGE_SIZE);
    if (after) query = query.gt("id", after);
    return query;
  }, "id");
  const candidates = rows.filter(row => row.linked_user_id === userId && text(row.id) && text(row.event_id) && text(row.participant_id)
    && text(row.response_text) && inWindow(row.completed_at, Date.parse(start), Date.parse(end)));
  if (!candidates.length) return [];
  const eventIds = candidates.map(r => r.event_id as string), participantIds = candidates.map(r => r.participant_id as string);
  const [events, participants, modules, video, documents] = await Promise.all([
    related<Row>(db, "foundry_events", "id,content_type", "id", eventIds),
    related<Row>(db, "foundry_event_participants", "id,event_id,user_id", "id", participantIds),
    related<Row>(db, "foundry_event_module", "event_id,module_version,module_snapshot", "event_id", eventIds),
    related<Row>(db, "foundry_event_training_content", "event_id,completion_prompt", "event_id", eventIds),
    related<Row>(db, "foundry_event_document_content", "event_id,completion_prompt", "event_id", eventIds),
  ]);
  const eventById = new Map(events.map(e => [e.id, e])), participantById = new Map(participants.map(p => [p.id, p]));
  const moduleById = new Map(modules.map(m => [m.event_id, m]));
  const videoById = new Map(video.map(v => [v.event_id, v])), documentById = new Map(documents.map(d => [d.event_id, d]));
  const found: LearningRewardEvidence[] = [];
  for (const row of candidates) {
    const event = eventById.get(row.event_id), participant = participantById.get(row.participant_id), mod = moduleById.get(row.event_id);
    // An anonymous completion may be claimed, but a participant belonging to another account may not.
    if (!event || !participant || participant.event_id !== row.event_id || participant.user_id != null && participant.user_id !== userId) continue;
    const contentType = event.content_type ?? "youtube";
    let exposure: unknown = null;
    if (contentType === "youtube" && text(videoById.get(row.event_id)?.completion_prompt)) exposure = row.video_completed_at;
    else if (contentType === "document" && text(documentById.get(row.event_id)?.completion_prompt)) exposure = row.document_read_completed_at;
    else if (contentType === "written_guidance" || contentType === "live_discussion") {
      const guidance = readPublishedGuidance(mod?.module_snapshot);
      if (guidance?.contentType === contentType && guidance.completionEvidence === "response") {
        exposure = contentType === "written_guidance" ? row.written_guidance_read_at : row.discussion_self_reported_at;
      }
    }
    if (!stamp(exposure) || Date.parse(exposure) > Date.parse(row.completed_at as string)) continue;
    const moduleVersion = mod && Number.isInteger(mod.module_version) && Number(mod.module_version) > 0 ? String(mod.module_version) : "published-event/v1";
    found.push({ policy_version: POLICY, source_type: "foundry_learn", source_id: row.id as string,
      assignment_key: `foundry:${row.event_id}`, content_key: `foundry:${row.event_id}`, content_version: moduleVersion,
      action: "learn", completed_at: row.completed_at as string, timezone, metadata: { moduleKey: `foundry:${row.event_id}` } });
  }
  return found;
}

async function followedUp(db: SupabaseClient, userId: string, start: string, end: string, timezone: string): Promise<LearningRewardEvidence[]> {
  const rows = await pages<Row>(after => {
    let query = db.from("foundry_participant_followups")
      .select("id,event_id,progress_id,assignment_id,user_id_snapshot,follow_up_days,due_at,status,outcome,responded_at")
      .eq("user_id_snapshot", userId).eq("status", "RESPONDED").gte("responded_at", start).lte("responded_at", end)
      .order("id", { ascending: true }).limit(PAGE_SIZE);
    if (after) query = query.gt("id", after);
    return query;
  }, "id");
  const candidates = rows.filter(row => text(row.id) && row.user_id_snapshot === userId && row.status === "RESPONDED"
    && (row.follow_up_days === 7 || row.follow_up_days === 30) && stamp(row.due_at)
    && ["APPLIED", "PARTLY_APPLIED", "NOT_YET", "BLOCKED"].includes(String(row.outcome)));
  if (!candidates.length) return [];
  // responded_at changes on a later check-in. The earliest immutable response audit preserves the
  // original completion time, so an old response cannot be moved into this policy or a new BTY day.
  const audits: Row[] = [];
  const ids = candidates.map(r => r.id as string);
  for (let at = 0; at < ids.length; at += RELATED_BATCH_SIZE) {
    const batch = ids.slice(at, at + RELATED_BATCH_SIZE);
    audits.push(...await pages<Row>(after => {
      let query = db.from("foundry_participant_followup_audit")
        .select("id,followup_id,user_id_snapshot,event_type,outcome,created_at")
        .eq("user_id_snapshot", userId).eq("event_type", "RESPONDED").in("followup_id", batch)
        .lte("created_at", end).order("id", { ascending: true }).limit(PAGE_SIZE);
      if (after) query = query.gt("id", after);
      return query;
    }, "id"));
  }
  const firstResponse = new Map<string, Row>();
  for (const audit of audits) {
    if (!text(audit.followup_id) || audit.user_id_snapshot !== userId || audit.event_type !== "RESPONDED" || !stamp(audit.created_at)
      || !["APPLIED", "PARTLY_APPLIED", "NOT_YET", "BLOCKED"].includes(String(audit.outcome))) continue;
    const previous = firstResponse.get(audit.followup_id);
    if (!previous || Date.parse(audit.created_at) < Date.parse(previous.created_at as string)) firstResponse.set(audit.followup_id, audit);
  }
  const found: LearningRewardEvidence[] = [];
  for (const row of candidates) {
    const first = firstResponse.get(row.id as string);
    if (!first || !inWindow(first.created_at, Date.parse(start), Date.parse(end)) || Date.parse(first.created_at) < Date.parse(row.due_at as string)) continue;
    const moduleKey = text(row.event_id) ? `foundry:${row.event_id}` : undefined;
    const assignmentKey = text(row.assignment_id) ? `foundry-assignment:${row.assignment_id}`
      : moduleKey ?? (text(row.progress_id) ? `foundry-progress:${row.progress_id}` : `followup:${row.id}`);
    found.push({ policy_version: POLICY, source_type: "foundry_followup", source_id: row.id as string,
      assignment_key: assignmentKey, content_key: moduleKey ?? `followup:${row.progress_id ?? row.id}`,
      content_version: `followup-${row.follow_up_days}/v1`, action: "followup", completed_at: first.created_at,
      timezone, metadata: { ...(moduleKey ? { moduleKey } : {}), followupDays: row.follow_up_days as 7 | 30 } });
  }
  return found;
}

export async function collectLearningRewardEvidence(db: SupabaseClient, userId: string, startedAt: string, now: Date): Promise<LearningRewardEvidence[]> {
  if (!text(userId) || !stamp(startedAt) || !Number.isFinite(now.getTime()) || Date.parse(startedAt) > now.getTime()) throw Error("LEARNING_REWARD_SOURCE_WINDOW");
  const { timezone } = await readUserTzContext(db, userId, null);
  const end = now.toISOString();
  const parts = await Promise.all([learned(db, userId, startedAt, end, timezone), clinical(db, userId, startedAt, end, timezone), followedUp(db, userId, startedAt, end, timezone)]);
  return parts.flat().sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at) || a.source_type.localeCompare(b.source_type) || a.source_id.localeCompare(b.source_id));
}
