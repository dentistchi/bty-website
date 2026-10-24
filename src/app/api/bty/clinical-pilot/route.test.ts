import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import catalog from "@/domain/clinical-pilot/catalog.json";
import { PILOT_SCHEMA, initialAnswers, publicCase, startPilot, type AuthorCase, type PilotTrace } from "@/domain/clinical-pilot/pilot";
import { discoveryTurns, initialAssessment } from "@/domain/clinical-pilot/discovery";

// This double executes the real route, service, domain transitions and authored router.
// It has no remote connection. Auth and the database transport are replaced at the boundary.
const state = vi.hoisted(() => ({ user: "owner" as string | null, admin: false, unavailable: false,
  failWrite: false, race: false, rows: [] as Record<string, any>[] }));
vi.mock("@/lib/authz", () => ({
  requireUser: async () => state.user ? { ok: true, user: { id: state.user } } : { ok: false, status: 401 },
  requirePlatformAdmin: async () => state.user && state.admin ? { ok: true, user: { id: state.user } } : { ok: false, status: state.user ? 403 : 401 },
  isActivePlatformAdmin: async () => state.admin,
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => state.unavailable ? null : { from: () => {
  let mode = "read", values: Record<string, any> = {}, max = Infinity;
  let sort: { key: string; ascending: boolean } | undefined;
  const filters: ((r: Record<string, any>) => boolean)[] = [];
  const value = (row: Record<string, any>, key: string) => {
    if (key === "raw_trace->>phase") return row.raw_trace.phase;
    if (key === "raw_trace->events->0->payload->>mode") return row.raw_trace.events[0]?.payload.mode;
    return row[key];
  };
  const execute = () => {
    if (mode !== "read" && state.failWrite) return { data: null, error: { code: "FAIL" } };
    if (mode === "update" && state.race) { state.rows[0].updated_at = new Date(Date.parse(state.rows[0].updated_at) + 1).toISOString(); state.race = false; }
    let rows = state.rows.filter(row => filters.every(f => f(row)));
    if (mode === "insert") {
      if (state.rows.some(r => r.trace_id === values.trace_id)) return { data: null, error: { code: "23505" } };
      state.rows.push(structuredClone(values)); rows = [state.rows.at(-1)!];
    }
    if (mode === "update") rows.forEach(row => Object.assign(row, structuredClone(values)));
    if (sort) {
      const { key, ascending } = sort;
      rows.sort((a, b) => String(value(a, key)).localeCompare(String(value(b, key))) * (ascending ? 1 : -1));
    }
    return { data: structuredClone(rows.slice(0, max)), error: null };
  };
  const q = {
    select: () => q,
    eq: (key: string, expected: unknown) => { filters.push(row => value(row, key) === expected); return q; },
    neq: (key: string, expected: unknown) => { filters.push(row => value(row, key) !== expected); return q; },
    in: (key: string, expected: unknown[]) => { filters.push(row => expected.includes(value(row, key))); return q; },
    order: (key: string, options: { ascending: boolean }) => { sort = { key, ascending: options.ascending }; return q; },
    limit: (n: number) => { max = n; return q; },
    insert: (data: object) => { mode = "insert"; values = data; return q; },
    update: (data: object) => { mode = "update"; values = data; return q; },
    maybeSingle: async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; },
    then: (resolve: (x: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return q;
} } }));

const c = catalog[0] as AuthorCase;
const id = "11111111-1111-4111-8111-111111111111";
const req = (body: object) => new NextRequest("https://bty.test/api/bty/clinical-pilot", { method: "POST", body: JSON.stringify(body) });
const post = (operation: string, extra = {}, requestId = crypto.randomUUID(), traceId = id) => POST(req({ operation, traceId, requestId,
  ...(["message", "decision", "conclude"].includes(operation) ? { expectedEventCount: state.rows.find(r => r.trace_id === traceId)?.raw_trace.events.length ?? 1 } : {}), ...extra }));
const start = (traceId = id) => post("start", { caseId: c.caseId, caseVersion: c.version }, crypto.randomUUID(), traceId);
const message = (text: string, channel: "patient" | "exam" = "patient", requestId = crypto.randomUUID(), traceId = id) => post("message", { text, channel }, requestId, traceId);
const get = (query = "") => GET(new NextRequest(`https://bty.test/api/bty/clinical-pilot${query}`));
const assessment = "  Working diagnosis uncertain. Evaluate restorability and discuss options before treatment.  ";
const answers = { evaluation: " Check contact ", diagnosis: "Open contact", plan: "Assess #29", rationale: "Keep functioning crown if appropriate" };
const trace = () => state.rows.find(r => r.trace_id === id)!.raw_trace as PilotTrace;

function seedWritten(traceId = id, userId = "owner") {
  const raw = startPilot(traceId, publicCase(c), "legacy-written-hash", crypto.randomUUID(), "2026-10-23T10:00:00.000Z", false);
  state.rows.push({ trace_id: traceId, user_id: userId, case_id: c.caseId, case_version: c.version,
    trace_schema_version: PILOT_SCHEMA, trace_role: "learner", status: "active", raw_trace: raw, updated_at: "2026-10-23T10:00:00.000Z" });
  return raw;
}

beforeEach(() => {
  vi.stubEnv("CLINICAL_AUTHOR_PILOT_ENABLED", "1");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_BASE_URL", "");
  vi.stubEnv("CLINICAL_DISCOVERY_LLM_MODEL", "");
  state.user = "owner"; state.admin = false; state.unavailable = false; state.failWrite = false; state.race = false; state.rows = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticated question-led clinical discovery API", () => {
  it("fails closed until the pilot is enabled and the server database transport is available", async () => {
    vi.stubEnv("CLINICAL_AUTHOR_PILOT_ENABLED", "0");
    expect((await start()).status).toBe(503);
    expect((await (await get()).json()).error).toBe("PILOT_NOT_ENABLED");
    expect(state.rows).toEqual([]);
    vi.stubEnv("CLINICAL_AUTHOR_PILOT_ENABLED", "1"); state.unavailable = true;
    expect((await start()).status).toBe(503);
    expect((await get()).status).toBe(503);
    expect(state.rows).toEqual([]);
  });

  it("publishes only neutral labels and chief complaints for all 23 cases, including in a new owner-readable trace", async () => {
    const response = await get();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const data = await response.json();
    expect(data.cases).toHaveLength(23);
    for (const visible of data.cases) {
      const source = catalog.find(row => row.caseId === visible.caseId)!;
      expect(visible.title).toMatch(/^Patient encounter \d{3}$/);
      expect(visible.findings).toEqual([]);
      expect(visible).not.toHaveProperty("authorParaphrase");
      expect(visible).not.toHaveProperty("facts");
      expect(visible.scenario).not.toBe(source.scenario);
    }
    const opened = await (await start()).json();
    expect(opened.trace.discovery.interactionVersion).toBe("clinical-discovery/v1");
    expect(opened.trace.caseSnapshot.findings).toEqual([]);
    expect(opened.trace.caseSnapshot).toEqual(data.cases[0]);
    expect(opened.trace.events).toHaveLength(1);
    const raw = JSON.stringify(opened.trace);
    expect(raw).not.toContain("large MOD");
    expect(raw).not.toContain("periapical radiolucency");
    expect(raw).not.toContain(c.authorOriginal);
    expect(raw).not.toContain(c.authorParaphrase);
    expect(raw).not.toContain('"facts"');
    expect(state.rows[0].user_id).toBe("owner");
    expect(state.rows[0].trace_schema_version).toBe(PILOT_SCHEMA);
    expect((await (await get(`?caseId=${c.caseId}`)).json()).traces[0].raw_trace).toEqual(opened.trace);
  });

  it("records the original question and releases only its requested authored finding, with no duplicate on retry", async () => {
    await start();
    const before = structuredClone(trace());
    const requestId = crypto.randomUUID();
    const text = "  Check percussion.  ";
    const result = await (await message(text, "exam", requestId)).json();
    const turn = discoveryTurns(result.trace)[0];
    expect(turn.question).toBe(text);
    expect(turn.channel).toBe("exam");
    expect(turn.reply.text).toMatch(/negative|not tender|no.*tender/i);
    expect(turn.reply.availableFactIds.length).toBeGreaterThan(0);
    expect(result.trace.events.slice(0, before.events.length)).toEqual(before.events);
    expect(result.trace.caseSnapshot).toEqual(before.caseSnapshot);
    expect(JSON.stringify(result)).not.toContain(c.authorOriginal);
    expect(result.trace.events.some((e: { type: string }) => e.type === "reference_released")).toBe(false);
    const saved = structuredClone(trace());
    expect((await message("A replacement question must not overwrite this turn", "patient", requestId)).status).toBe(200);
    expect(trace()).toEqual(saved);
    expect(discoveryTurns(trace())).toHaveLength(1);
  });

  it("separates symptom questions from examination requests and retains unavailable requests without inventing results", async () => {
    await start();
    const symptom = await (await message("Does cold cause sensitivity?", "patient")).json();
    expect(discoveryTurns(symptom.trace).at(-1)!.reply.text).toMatch(/cold|brief|short/i);
    const unavailable = await (await message("What is the salivary lead isotope concentration?", "patient")).json();
    const turn = discoveryTurns(unavailable.trace).at(-1)!;
    expect(turn.question).toBe("What is the salivary lead isotope concentration?");
    expect(turn.reply.resolution).toBe("clarify");
    expect(turn.reply.availableFactIds).toEqual([]);
    const noExamResult = await (await message("Assess root extension and definitive restorability", "exam")).json();
    expect(discoveryTurns(noExamResult.trace).at(-1)!.reply.availableFactIds).toEqual([]);
    expect(discoveryTurns(noExamResult.trace).at(-1)!.reply.resolution).toBe("unavailable");
    expect(JSON.stringify(noExamResult)).not.toContain(c.authorOriginal);
  });

  it("saves working assessments with only information available at that moment, then freezes the final assessment before comparison", async () => {
    await start();
    const first = await (await message("Does cold cause sensitivity?", "patient")).json();
    const firstIds = discoveryTurns(first.trace)[0].reply.availableFactIds;
    expect(firstIds.length).toBeGreaterThan(0);
    const checkpoint = await (await post("decision", { text: "Consider a structural problem; diagnosis uncertain." })).json();
    const working = checkpoint.trace.events.find((e: { type: string }) => e.type === "working_assessment");
    expect(working.payload.informationAvailable).toEqual(firstIds);
    expect(working.payload.turnCount).toBe(1);
    expect(checkpoint.trace.phase).toBe("draft");
    expect(checkpoint.trace.events.some((e: { type: string }) => e.type === "reference_released")).toBe(false);
    await message("Check percussion", "exam");
    const beforeFinal = structuredClone(trace());
    const requestId = crypto.randomUUID();
    const concluded = await (await post("conclude", { text: assessment }, requestId)).json();
    expect(concluded.trace.phase).toBe("submitted");
    expect(initialAssessment(trace())).toBe(assessment);
    expect(concluded.trace.events.slice(0, beforeFinal.events.length)).toEqual(beforeFinal.events);
    expect(concluded.trace.events.at(-2).type).toBe("assessment_submitted");
    expect(concluded.trace.events.at(-1).type).toBe("reference_released");
    expect(concluded.trace.events.at(-2).payload.informationAvailable).toEqual([...new Set(discoveryTurns(beforeFinal).flatMap(t => t.reply.availableFactIds))]);
    expect(concluded.trace.events.at(-2).payload.turnCount).toBe(2);
    expect(JSON.stringify(concluded)).toContain(c.authorOriginal);
    const frozen = structuredClone(trace());
    expect((await post("conclude", { text: "Replacement" }, requestId)).status).toBe(200);
    expect(trace()).toEqual(frozen);
    expect((await message("Another question", "patient")).status).toBe(409);
    expect((await post("decision", { text: "Replace original" })).status).toBe(409);
    expect((await post("react", { reaction: { helpful: "partly", comment: "Different priority", revisedPlan: "Ask about bite too" } })).status).toBe(200);
    expect(state.rows[0].status).toBe("completed");
    expect(initialAssessment(trace())).toBe(assessment);
    expect(trace().events.slice(0, frozen.events.length)).toEqual(frozen.events);
    expect(trace().events.at(-1)!.type).toBe("reaction_submitted");
  });

  it("does not require a minimum number of questions or release a reference via a premature reaction", async () => {
    await start();
    expect((await post("react", { reaction: { helpful: "yes", comment: "", revisedPlan: "" } })).status).toBe(409);
    expect((await post("conclude", { text: assessment })).status).toBe(200);
    const final = trace().events.find(e => e.type === "assessment_submitted")!;
    expect(final.payload.turnCount).toBe(0);
    expect(final.payload.informationAvailable).toEqual([]);
    expect(trace().events.at(-1)!.type).toBe("reference_released");
  });

  it("returns no answer if a message write fails and allows the same request to be retried exactly once", async () => {
    await start(); const before = structuredClone(trace()); state.failWrite = true;
    const requestId = crypto.randomUUID();
    const response = await message("Check percussion", "exam", requestId);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "UNAVAILABLE" });
    expect(trace()).toEqual(before);
    state.failWrite = false;
    expect((await message("Check percussion", "exam", requestId)).status).toBe(200);
    expect(discoveryTurns(trace())).toHaveLength(1);
    expect((await message("Check percussion", "exam", requestId)).status).toBe(200);
    expect(discoveryTurns(trace())).toHaveLength(1);
  });

  it("does not release the author reference if final persistence fails and permits an identical retry", async () => {
    await start(); state.failWrite = true;
    const requestId = crypto.randomUUID();
    const failed = await post("conclude", { text: assessment }, requestId);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ ok: false, error: "UNAVAILABLE" });
    expect(trace().phase).toBe("draft");
    expect(trace().events.some(e => e.type === "reference_released")).toBe(false);
    state.failWrite = false;
    expect((await post("conclude", { text: assessment }, requestId)).status).toBe(200);
    expect(initialAssessment(trace())).toBe(assessment);
  });

  it("enforces ownership, authentication, and a separate platform-admin review/export gate", async () => {
    await start(); state.user = "other";
    expect((await message("Check percussion", "exam")).status).toBe(404);
    expect((await post("conclude", { text: assessment })).status).toBe(404);
    expect((await (await get(`?caseId=${c.caseId}`)).json()).traces).toEqual([]);
    expect((await get("?view=review")).status).toBe(403);
    state.admin = true;
    const reviewed = await (await get("?view=review")).json();
    expect(reviewed.rows).toHaveLength(1);
    expect(reviewed.limit).toBe(50);
    expect(reviewed.rows[0]).not.toHaveProperty("user_id");
    expect(reviewed.rows[0].doctorRef).toMatch(/^subject-/);
    state.user = null;
    expect((await start()).status).toBe(401);
    expect((await get()).status).toBe(401);
    expect((await get("?view=review")).status).toBe(401);
  });

  it("rejects invalid cases, empty reasoning, forged findings and caller identity without mutation", async () => {
    expect((await post("start", { caseId: "no", caseVersion: "1" })).status).toBe(400);
    expect((await post("start", { caseId: c.caseId, caseVersion: "unknown-version" })).status).toBe(400);
    await start(); const before = structuredClone(trace());
    for (const body of [
      { operation: "conclude", text: "  " },
      { operation: "decision", text: "\n" },
      { operation: "message", text: "", channel: "patient" },
      { operation: "message", text: "Check percussion", channel: "exam", reply: { text: "Normal", factIds: ["forged"] } },
      { operation: "message", text: "Check percussion", channel: "exam", factIds: ["forged"] },
      { operation: "message", text: "Check percussion", channel: "exam", user_id: "other" },
      { operation: "conclude", text: assessment, user_id: "other" },
    ]) expect((await POST(req({ traceId: id, requestId: crypto.randomUUID(), expectedEventCount: before.events.length, ...body }))).status).toBe(400);
    expect((await POST(req({ traceId: id, requestId: crypto.randomUUID(), operation: "conclude", text: assessment }))).status).toBe(400);
    expect((await post("save", { answers })).status).toBe(400);
    expect(trace()).toEqual(before);
  });

  it("prevents a concurrent message or final decision from replacing a newer raw history", async () => {
    await start(); const before = structuredClone(trace()); state.race = true;
    expect((await message("Check percussion", "exam")).status).toBe(409);
    expect(trace()).toEqual(before);
    state.race = true;
    expect((await post("conclude", { text: assessment })).status).toBe(409);
    expect(trace()).toEqual(before);
  });

  it("rejects an already stale tab before attributing another tab's findings to its decision", async () => {
    await start(); const observed = trace().events.length;
    const requestId = crypto.randomUUID();
    expect((await post("message", { text: "Check percussion", channel: "exam", expectedEventCount: observed }, requestId)).status).toBe(200);
    const saved = structuredClone(trace());
    for (const action of [
      { operation: "message", text: "Does cold bother you?", channel: "patient" },
      { operation: "decision", text: "A judgment made without seeing the newer reply." },
      { operation: "conclude", text: assessment },
    ]) {
      const response = await POST(req({ traceId: id, requestId: crypto.randomUUID(), expectedEventCount: observed, ...action }));
      expect(response.status).toBe(409);
      expect(trace()).toEqual(saved);
    }
    // A lost acknowledgement still retries successfully with its original cursor.
    expect((await post("message", { text: "Check percussion", channel: "exam", expectedEventCount: observed }, requestId)).status).toBe(200);
    expect(trace()).toEqual(saved);
    expect((await post("conclude", { text: assessment, expectedEventCount: saved.events.length })).status).toBe(200);
  });

  it("detects prior submissions beyond recent drafts and rechecks exposure when concluding", async () => {
    await start(); await post("conclude", { text: assessment });
    for (let i = 0; i < 21; i++) state.rows.unshift({ ...structuredClone(state.rows[0]), trace_id: crypto.randomUUID(), raw_trace: { ...state.rows[0].raw_trace, phase: "draft" } });
    const nextId = crypto.randomUUID();
    const next = await (await start(nextId)).json();
    expect(next.trace.priorReferenceExposure).toBe("prior_submission");
    const nextRow = state.rows.find(row => row.trace_id === nextId)!;
    nextRow.raw_trace.priorReferenceExposure = "not_recorded";
    const submitted = await (await post("conclude", { text: assessment }, crypto.randomUUID(), nextId)).json();
    expect(submitted.trace.priorReferenceExposure).toBe("prior_submission");
  });

  it("preserves historical written snapshots and their original four-field submission contract", async () => {
    const old = structuredClone(seedWritten());
    expect((await message("Check percussion", "exam")).status).toBe(400);
    expect((await post("save", { answers })).status).toBe(200);
    const savedPrefix = structuredClone(trace());
    const submitted = await (await post("submit", { answers })).json();
    expect(initialAnswers(submitted.trace)).toEqual(answers);
    expect(submitted.trace.caseSnapshot).toEqual(old.caseSnapshot);
    expect(submitted.trace.caseHash).toBe(old.caseHash);
    expect(submitted.trace).not.toHaveProperty("discovery");
    expect(submitted.trace.events.slice(0, savedPrefix.events.length)).toEqual(savedPrefix.events);
    expect((await post("save", { answers })).status).toBe(409);
    expect((await post("react", { reaction: { helpful: "no", comment: "Different approach", revisedPlan: "" } })).status).toBe(200);
    expect(initialAnswers(trace())).toEqual(answers);
    const loaded = await (await get(`?caseId=${c.caseId}`)).json();
    expect(loaded.traces[0].raw_trace.caseSnapshot).toEqual(old.caseSnapshot);
  });

  it("flags prior full written-case exposure independently from author-reference exposure", async () => {
    const legacyId = crypto.randomUUID();
    seedWritten(legacyId);
    await start();
    expect(trace().discovery!.priorCaseContextExposure).toBe("prior-written-case");
    expect(trace().priorReferenceExposure).toBe("not_recorded");
    trace().discovery!.priorCaseContextExposure = "not_recorded";
    const concluded = await (await post("conclude", { text: assessment })).json();
    expect(concluded.trace.discovery.priorCaseContextExposure).toBe("prior-written-case");
    expect(state.rows.find(row => row.trace_id === legacyId)!.raw_trace.discovery).toBeUndefined();
  });
});
