import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectLearningRewardEvidence } from "./sources.server";

vi.mock("@/lib/bty/daily/userDay", () => ({ readUserTzContext: vi.fn(async () => ({ timezone: "America/Los_Angeles", tzFallback: false })) }));
type Row = Record<string, unknown>;
const USER = "user-1", START = "2026-10-30T00:00:00.000Z", DONE = "2026-10-30T10:00:00.000Z", NOW = new Date("2026-10-31T00:00:00.000Z");

type Read = { table: string; operations: [string, string, unknown][] };
function database(tables: Record<string, Row[]> = {}, fail?: (read: Read) => boolean) {
  const reads: Read[] = [];
  const client = {
    from(table: string) {
      const read: Read = { table, operations: [] };
      reads.push(read);
      let limit = Infinity;
      let ordering: { key: string; ascending: boolean }[] = [];
      const ops: ((row: Row) => boolean)[] = [];
      const query = {
        select(columns: string) { read.operations.push(["select", columns, null]); return query; },
        eq(key: string, value: unknown) { read.operations.push(["eq", key, value]); ops.push(row => row[key] === value); return query; },
        gte(key: string, value: unknown) { read.operations.push(["gte", key, value]); ops.push(row => row[key] != null && String(row[key]) >= String(value)); return query; },
        lte(key: string, value: unknown) { read.operations.push(["lte", key, value]); ops.push(row => row[key] != null && String(row[key]) <= String(value)); return query; },
        gt(key: string, value: unknown) { read.operations.push(["gt", key, value]); ops.push(row => row[key] != null && String(row[key]) > String(value)); return query; },
        in(key: string, values: unknown[]) { read.operations.push(["in", key, values]); ops.push(row => values.includes(row[key])); return query; },
        order(key: string, options: { ascending: boolean }) { ordering.push({ key, ...options }); return query; },
        limit(n: number) { limit = n; return query; },
        then(resolve: (result: { data: Row[] | null; error: unknown }) => unknown, reject?: (e: unknown) => unknown) {
          if (fail?.(read)) return Promise.resolve({ data: null, error: { message: "offline" } }).then(resolve, reject);
          const rows = (tables[table] ?? []).filter(row => ops.every(op => op(row))).sort((a, b) => {
            for (const { key, ascending } of ordering) {
              const n = String(a[key]).localeCompare(String(b[key]));
              if (n) return ascending ? n : -n;
            }
            return 0;
          }).slice(0, limit);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { db: client as unknown as SupabaseClient, reads };
}

const progress = (overrides: Row = {}): Row => ({ id: "p-1", event_id: "e-1", participant_id: "pt-1", linked_user_id: USER, completed_at: DONE, response_text: "PRIVATE: my own words", video_completed_at: "2026-10-30T09:58:00.000Z", ...overrides });
const followup = (overrides: Row = {}): Row => ({ id: "f-1", event_id: "e-1", progress_id: "p-1", assignment_id: "a-1", user_id_snapshot: USER, follow_up_days: 7, due_at: "2026-10-30T09:00:00.000Z", status: "RESPONDED", outcome: "APPLIED", responded_at: DONE, ...overrides });
const audit = (overrides: Row = {}): Row => ({ id: "au-1", followup_id: "f-1", user_id_snapshot: USER, event_type: "RESPONDED", outcome: "APPLIED", created_at: DONE, ...overrides });
const trace = (overrides: Row = {}): Row => {
  const raw: Row = { traceId: "t-1", caseId: "drchi-001", caseVersion: "2026-10-23.1", schemaVersion: "clinical-author-pilot/v1", phase: "completed", priorReferenceExposure: "not_recorded", discovery: { interactionVersion: "clinical-discovery/v1", packVersion: "case-001/fixed", priorCaseContextExposure: "not_recorded" }, events: [
    { sequence: 1, type: "case_presented", at: "2026-10-30T09:50:00.000Z", payload: {} },
    { sequence: 2, type: "discovery_turn", at: "2026-10-30T09:51:00.000Z", payload: { question: "PRIVATE patient question", reply: { resolution: "unavailable" } } },
    { sequence: 3, type: "assessment_submitted", at: "2026-10-30T09:57:00.000Z", payload: { text: "PRIVATE assessment" } },
    { sequence: 4, type: "reference_released", at: "2026-10-30T09:57:00.000Z", payload: { reference: { version: "2026-10-23.1", original: "PRIVATE reference" } } },
    { sequence: 5, type: "reaction_submitted", at: DONE, payload: { reaction: { helpful: "no", comment: "PRIVATE opinion", revisedPlan: "" } } },
  ] };
  return { trace_id: "t-1", user_id: USER, case_id: "drchi-001", case_version: "2026-10-23.1", trace_schema_version: "clinical-author-pilot/v1", trace_role: "learner", status: "completed", completed_at: DONE, raw_trace: raw, ...overrides };
};
const rawOf = (row: Row) => row.raw_trace as Row;
function learnTables(row = progress()): Record<string, Row[]> {
  return { foundry_event_training_progress: [row], foundry_events: [{ id: "e-1", content_type: "youtube" }], foundry_event_participants: [{ id: "pt-1", event_id: "e-1", user_id: USER }], foundry_event_training_content: [{ event_id: "e-1", completion_prompt: "Your own summary?" }] };
}

beforeEach(() => vi.clearAllMocks());
describe("Learning Rewards · independently verified source reconciliation", () => {
  it("collects canonical Learn, Discovery practice and due follow-up without any private text", async () => {
    const { db } = database({ ...learnTables(), clinical_reasoning_traces: [trace()], foundry_participant_followups: [followup()], foundry_participant_followup_audit: [audit()] });
    const results = await collectLearningRewardEvidence(db, USER, START, NOW);
    expect(results.map(r => r.action).sort()).toEqual(["followup", "learn", "practice"]);
    expect(results.every(r => r.policy_version === "learning-rewards/v1" && r.timezone === "America/Los_Angeles")).toBe(true);
    expect(JSON.stringify(results)).not.toContain("PRIVATE");
    expect(results.find(r => r.action === "practice")?.metadata).toEqual({ clinicalCaseId: "drchi-001" });
    expect(results.every(r => !r.metadata.requiredSteps && !r.metadata.path && !r.metadata.revisitVariant)).toBe(true);
  });

  it("every account-bearing source query is scoped to canonical user identity", async () => {
    const { db, reads } = database({ clinical_reasoning_traces: [trace({ user_id: "someone-else" })], foundry_event_training_progress: [progress({ linked_user_id: "someone-else" })], foundry_participant_followups: [followup({ user_id_snapshot: "someone-else" })] });
    expect(await collectLearningRewardEvidence(db, USER, START, NOW)).toEqual([]);
    expect(reads.find(r => r.table === "clinical_reasoning_traces")?.operations).toContainEqual(["eq", "user_id", USER]);
    expect(reads.find(r => r.table === "foundry_event_training_progress")?.operations).toContainEqual(["eq", "linked_user_id", USER]);
    expect(reads.find(r => r.table === "foundry_participant_followups")?.operations).toContainEqual(["eq", "user_id_snapshot", USER]);
  });

  it.each([
    ["no completion", { completed_at: null }], ["no own-language response", { response_text: null, quiz_attempt_id: "q-1" }],
    ["empty response", { response_text: "  " }], ["page/view without exposure", { video_completed_at: null }],
    ["exposure after completion", { video_completed_at: "2026-10-30T11:00:00.000Z" }],
    ["before policy activation", { completed_at: "2026-10-29T23:59:59.999Z" }], ["future completion", { completed_at: "2026-11-01T00:00:00.000Z" }],
  ])("does not award Learn for %s", async (_label, overrides) => {
    const { db } = database(learnTables(progress(overrides)));
    expect(await collectLearningRewardEvidence(db, USER, START, NOW)).toEqual([]);
  });

  it("refuses a progress linked to another participant account or event", async () => {
    for (const participant of [{ id: "pt-1", event_id: "e-1", user_id: "other" }, { id: "pt-1", event_id: "other", user_id: USER }]) {
      const { db } = database({ ...learnTables(), foundry_event_participants: [participant] });
      expect(await collectLearningRewardEvidence(db, USER, START, NOW)).toEqual([]);
    }
  });

  it("accepts a properly claimed anonymous participant without rewriting its identity", async () => {
    const { db } = database({ ...learnTables(), foundry_event_participants: [{ id: "pt-1", event_id: "e-1", user_id: null }] });
    expect((await collectLearningRewardEvidence(db, USER, START, NOW))[0]?.action).toBe("learn");
  });

  it("uses the document's own exposure and frozen module version", async () => {
    const { db } = database({ ...learnTables(progress({ video_completed_at: null, document_read_completed_at: "2026-10-30T09:58:00.000Z" })), foundry_events: [{ id: "e-1", content_type: "document" }], foundry_event_module: [{ event_id: "e-1", module_version: 3, module_snapshot: {} }], foundry_event_document_content: [{ event_id: "e-1", completion_prompt: "Summary?" }] });
    const results = await collectLearningRewardEvidence(db, USER, START, NOW);
    expect(results[0]?.content_version).toBe("3");
    expect(results[0]?.metadata.moduleKey).toBe("foundry:e-1");
  });

  it.each(["written_guidance", "live_discussion"])("validates the frozen %s contract before using an exposure declaration", async contentType => {
    const column = contentType === "written_guidance" ? "written_guidance_read_at" : "discussion_self_reported_at";
    const tables = { ...learnTables(progress({ video_completed_at: null, [column]: "2026-10-30T09:58:00.000Z" })), foundry_events: [{ id: "e-1", content_type: contentType }], foundry_event_module: [{ event_id: "e-1", module_version: 1, module_snapshot: { publishedGuidanceV1: { version: 1, contentType, materialText: "Approved text", completionPrompt: "Explain it?", completionEvidence: "response", sharedQuestion: null } } }] };
    expect((await collectLearningRewardEvidence(database(tables).db, USER, START, NOW))[0]?.action).toBe("learn");
    tables.foundry_event_module[0].module_snapshot.publishedGuidanceV1.contentType = contentType === "written_guidance" ? "live_discussion" : "written_guidance";
    expect(await collectLearningRewardEvidence(database(tables).db, USER, START, NOW)).toEqual([]);
  });

  it("does not penalize unavailable or uninterpreted questions, disagreement, or short/no reaction comment", async () => {
    const row = trace();
    const events = rawOf(row).events as Row[];
    events.splice(2, 0, { sequence: 3, type: "discovery_turn", at: "2026-10-30T09:52:00.000Z", payload: { reply: { resolution: "clarify" } } });
    expect((await collectLearningRewardEvidence(database({ clinical_reasoning_traces: [row] }).db, USER, START, NOW))[0]?.action).toBe("practice");
  });

  it.each(["submitted-only", "written-case", "reference-first", "missing-reaction", "mismatched-case", "missing-assessment"])("does not claim independent Discovery completion for %s", async kind => {
    const row = trace(), raw = rawOf(row), events = raw.events as Row[];
    if (kind === "submitted-only") row.status = raw.phase = "submitted";
    if (kind === "written-case") delete raw.discovery;
    if (kind === "reference-first") [events[2], events[3]] = [events[3], events[2]];
    if (kind === "missing-reaction") events.pop();
    if (kind === "mismatched-case") raw.caseId = "drchi-002";
    if (kind === "missing-assessment") (events[2].payload as Row).text = "";
    expect(await collectLearningRewardEvidence(database({ clinical_reasoning_traces: [row] }).db, USER, START, NOW)).toEqual([]);
  });

  it("preserves prior-exposure provenance while accepting a new post-policy assessment; the old completion is never backfilled", async () => {
    const previous = trace({ trace_id: "old-trace", completed_at: "2026-10-29T10:00:00.000Z" });
    (previous.raw_trace as Row).traceId = "old-trace";
    const current = trace({ trace_id: "new-trace" });
    const raw = rawOf(current);
    raw.traceId = "new-trace";
    raw.priorReferenceExposure = "prior_submission";
    (raw.discovery as Row).priorCaseContextExposure = "prior-written-case";
    const before = structuredClone(current);
    const { db } = database({ clinical_reasoning_traces: [previous, current] });
    const evidence = await collectLearningRewardEvidence(db, USER, START, NOW);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ source_id: "new-trace", assignment_key: "clinical:drchi-001", content_key: "clinical:drchi-001", action: "practice" });
    expect(current).toEqual(before);
  });

  it.each(["APPLIED", "PARTLY_APPLIED", "NOT_YET", "BLOCKED"])("accepts the same due follow-up participation evidence for %s", async outcome => {
    const { db } = database({ foundry_participant_followups: [followup({ outcome })], foundry_participant_followup_audit: [audit({ outcome })] });
    expect((await collectLearningRewardEvidence(db, USER, START, NOW))[0]).toMatchObject({ source_type: "foundry_followup", action: "followup", completed_at: DONE, metadata: { followupDays: 7 } });
  });

  it("keeps 7/30-day checkpoints on one original assignment for Follow-through distinct counting", async () => {
    const { db } = database({ foundry_participant_followups: [followup(), followup({ id: "f-30", follow_up_days: 30 })], foundry_participant_followup_audit: [audit(), audit({ id: "au-30", followup_id: "f-30" })] });
    const evidence = await collectLearningRewardEvidence(db, USER, START, NOW);
    expect(evidence).toHaveLength(2);
    expect(new Set(evidence.map(e => e.assignment_key)).size).toBe(1);
    expect(new Set(evidence.map(e => e.source_id)).size).toBe(2);
    expect(new Set(evidence.map(e => e.content_version)).size).toBe(2);
  });

  it("uses the first audit time, not a later mutable check-in timestamp", async () => {
    const later = "2026-10-30T22:00:00.000Z";
    const { db } = database({ foundry_participant_followups: [followup({ responded_at: later, outcome: "APPLIED" })], foundry_participant_followup_audit: [audit({ created_at: DONE, outcome: "BLOCKED" }), audit({ id: "au-2", created_at: later })] });
    expect((await collectLearningRewardEvidence(db, USER, START, NOW))[0]?.completed_at).toBe(DONE);
  });

  it("never moves a pre-policy first response into the new ledger when it is checked in later", async () => {
    const { db } = database({ foundry_participant_followups: [followup({ due_at: "2026-10-28T00:00:00.000Z" })], foundry_participant_followup_audit: [audit({ created_at: "2026-10-29T12:00:00.000Z" }), audit({ id: "au-2" })] });
    expect(await collectLearningRewardEvidence(db, USER, START, NOW)).toEqual([]);
  });

  it.each(["before-due", "pending", "missing-audit", "foreign-audit", "invalid-days"])("does not qualify follow-up %s", async kind => {
    const row = followup(), a = audit();
    if (kind === "before-due") row.due_at = "2026-10-30T11:00:00.000Z";
    if (kind === "pending") row.status = "PENDING";
    if (kind === "foreign-audit") a.user_id_snapshot = "other";
    if (kind === "invalid-days") row.follow_up_days = 3;
    const { db } = database({ foundry_participant_followups: [row], foundry_participant_followup_audit: kind === "missing-audit" ? [] : [a] });
    expect(await collectLearningRewardEvidence(db, USER, START, NOW)).toEqual([]);
  });

  it("qualifies a first response exactly at its actual due instant", async () => {
    const { db } = database({ foundry_participant_followups: [followup({ due_at: DONE })], foundry_participant_followup_audit: [audit()] });
    expect((await collectLearningRewardEvidence(db, USER, START, NOW))[0]?.action).toBe("followup");
  });

  it("does not manufacture a revisit from a repeated attempt or elapsed time", async () => {
    const { db } = database({ clinical_reasoning_traces: [trace()] });
    expect((await collectLearningRewardEvidence(db, USER, "2026-10-01T00:00:00.000Z", NOW)).some(e => e.action === "revisit")).toBe(false);
  });

  it.each(["clinical_reasoning_traces", "foundry_event_training_progress", "foundry_participant_followups", "foundry_events", "foundry_event_participants", "foundry_event_module", "foundry_event_training_content", "foundry_event_document_content", "foundry_participant_followup_audit"])("a %s read error rejects reconciliation rather than returning a false empty/success", async table => {
    const { db } = database({ ...learnTables(), foundry_participant_followups: [followup()], foundry_participant_followup_audit: [audit()] }, read => read.table === table);
    await expect(collectLearningRewardEvidence(db, USER, START, NOW)).rejects.toThrow("LEARNING_REWARD_SOURCE_UNAVAILABLE");
  });

  it("reads beyond the first 500 records with a stable keyset and bounds related IN queries", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => trace({ trace_id: `t-${String(i).padStart(4, "0")}` }));
    for (const row of rows) (row.raw_trace as Row).traceId = row.trace_id;
    const { db, reads } = database({ clinical_reasoning_traces: rows });
    const results = await collectLearningRewardEvidence(db, USER, START, NOW);
    expect(results).toHaveLength(501);
    expect(reads.filter(r => r.table === "clinical_reasoning_traces")).toHaveLength(2);
    expect(reads.filter(r => r.table === "clinical_reasoning_traces")[1].operations).toContainEqual(["gt", "trace_id", "t-0499"]);
  });

  it("bounds related IN queries while preserving all completions after 100 items", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => progress({ id: `p-${i}`, event_id: `e-${i}`, participant_id: `pt-${i}` }));
    const tables = {
      foundry_event_training_progress: rows,
      foundry_events: rows.map(row => ({ id: row.event_id, content_type: "youtube" })),
      foundry_event_participants: rows.map(row => ({ id: row.participant_id, event_id: row.event_id, user_id: USER })),
      foundry_event_training_content: rows.map(row => ({ event_id: row.event_id, completion_prompt: "Summary?" })),
    };
    const { db, reads } = database(tables);
    expect(await collectLearningRewardEvidence(db, USER, START, NOW)).toHaveLength(201);
    const batches = reads.flatMap(read => read.operations.filter(([operation]) => operation === "in"));
    expect(batches.length).toBeGreaterThan(5);
    expect(batches.every(([, , values]) => (values as unknown[]).length <= 100)).toBe(true);
  });

  it("does not return a partial first page when a later page fails", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => trace({ trace_id: `t-${String(i).padStart(4, "0")}` }));
    for (const row of rows) (row.raw_trace as Row).traceId = row.trace_id;
    const { db } = database({ clinical_reasoning_traces: rows }, r => r.operations.some(([op]) => op === "gt"));
    await expect(collectLearningRewardEvidence(db, USER, START, NOW)).rejects.toThrow("LEARNING_REWARD_SOURCE_UNAVAILABLE");
  });

  it("rejects an invalid reconciliation window before querying", async () => {
    const { db, reads } = database();
    await expect(collectLearningRewardEvidence(db, USER, "bad-time", NOW)).rejects.toThrow("LEARNING_REWARD_SOURCE_WINDOW");
    expect(reads).toEqual([]);
  });
});
