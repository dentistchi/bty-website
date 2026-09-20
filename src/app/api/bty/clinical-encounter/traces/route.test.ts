import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { completeEncounter, emptyDecision, startEncounter } from "@/domain/clinical-encounter/session";
import { encounterRecord } from "@/domain/clinical-encounter/serverPersistence";
import { GET as exportGET } from "../export/route";

const state = vi.hoisted(() => ({
  user: "owner" as string | null, available: true, failRead: false, failWrite: false, race: false,
  rows: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/authz", () => ({
  requireUser: async () => state.user ? { ok: true, user: { id: state.user } } : { ok: false, status: 401 },
  requirePlatformAdmin: async () => ({ ok: true, user: { id: "admin" } }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => state.available ? { from: () => {
    let mode = "read";
    let row: Record<string, unknown> = {};
    const filters: [string, unknown][] = [];
    let max = Infinity;
    let sorted = false;
    const execute = () => {
      if (mode === "read" && state.failRead || mode !== "read" && state.failWrite) return { data: null, error: { code: "FAIL" } };
      if (mode === "update" && state.race) {
        state.rows[0].status = "completed"; state.race = false;
      }
      let matching = state.rows.filter(r => filters.every(([key, value]) => value === null ? r[key] == null : r[key] === value));
      if (mode === "insert") {
        if (state.rows.some(r => r.trace_id === row.trace_id)) return { data: null, error: { code: "23505" } };
        state.rows.push(structuredClone(row)); matching = [state.rows.at(-1)!];
      } else if (mode === "update") matching.forEach(r => Object.assign(r, structuredClone(row)));
      if (sorted) matching = [...matching].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return { data: structuredClone(matching.slice(0, max)), error: null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      is: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => { sorted = true; return query; },
      limit: (n: number) => { max = n; return query; },
      insert: (r: Record<string, unknown>) => { mode = "insert"; row = r; return query; },
      update: (r: Record<string, unknown>) => { mode = "update"; row = r; return query; },
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then: (resolve: (x: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
    };
    return query;
  } } : null,
}));
const active = () => startEncounter("trace-1", "2026-09-19T00:00:00Z");
const completed = () => completeEncounter(active(), { ...emptyDecision, diagnosis: "Fracture", treatment: "Protect", followup: "Review", confidence: "Moderate", rationale: "History" }, "2026-09-19T00:01:00Z");
const request = (body: unknown) => new NextRequest("https://example.test/api/bty/clinical-encounter/traces", { method: "POST", body: JSON.stringify(body) });
const post = (operation: string, trace = active()) => POST(request({ operation, trace, user_id: "attacker" }));
const restart = () => POST(request({ operation: "restart", caseId: active().caseId, caseVersion: active().caseVersion, user_id: "attacker" }));
beforeEach(() => { state.rows = []; state.user = "owner"; state.available = true; state.failRead = false; state.failWrite = false; state.race = false; });

describe("authenticated V2 trace persistence", () => {
  it("creates and updates active traces with server-derived ownership", async () => {
    expect((await post("save")).status).toBe(200);
    expect(state.rows[0]).toMatchObject({ user_id: "owner", status: "active", completed_at: null });
    expect((await post("save")).status).toBe(200);
    expect(state.rows).toHaveLength(1);
  });
  it("completes durably, exports the identical raw trace, and rejects all subsequent mutations", async () => {
    await post("save");
    const trace = completed();
    expect(await (await post("complete", trace)).json()).toEqual({ ok: true, status: "completed" });
    expect(state.rows[0]).toMatchObject({ status: "completed", completed_at: "2026-09-19T00:01:00Z", raw_trace: trace });
    const exportResponse = await exportGET(new NextRequest("https://example.test/api/bty/clinical-encounter/export?traceId=trace-1"));
    expect((await exportResponse.json()).events).toEqual(trace.events);
    const before = structuredClone(state.rows);
    for (const operation of ["save", "complete"]) {
      const response = await post(operation, operation === "save" ? active() : trace);
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("IMMUTABLE");
    }
    expect(state.rows).toEqual(before);
  });
  it("can complete after an earlier active save failed", async () => {
    expect((await post("complete", completed())).status).toBe(200);
    expect(state.rows[0].status).toBe("completed");
  });
  it("requires exactly one terminal completion event and rejects completion in active saves", async () => {
    expect((await post("complete")).status).toBe(400);
    expect((await post("save", completed())).status).toBe(400);
    const trace = completed();
    trace.events.push({ sequence: trace.events.length + 1, type: "doctor_message", timestamp: "2026-09-19T00:01:01Z", elapsedMs: 61000 });
    expect((await post("complete", trace)).status).toBe(400);
    expect(state.rows).toEqual([]);
  });
  it("rejects other users and case/schema substitution", async () => {
    await post("save");
    state.user = "other";
    expect((await post("save")).status).toBe(403);
    expect((await post("complete", completed())).status).toBe(403);
    const result = await GET(new NextRequest("https://example.test/api/bty/clinical-encounter/traces?traceId=trace-1"));
    expect((await result.json()).traces).toEqual([]);
    state.user = "owner";
    expect((await post("save", { ...active(), caseId: "other-case" })).status).toBe(409);
    state.rows[0].trace_schema_version = "clinical-reasoning-trace/v1";
    expect((await post("save")).status).toBe(409);
  });
  it("uses an atomic active/owner guard when completion races an active update", async () => {
    await post("save"); state.race = true;
    expect((await post("save")).status).toBe(409);
    expect(state.rows[0].status).toBe("completed");
  });
  it("resumes only the current owner's active learner trace for the case version", async () => {
    state.rows = [
      { ...encounterRecord("owner", active()), updated_at: "2026-09-19" },
      encounterRecord("other", { ...active(), traceId: "other" }),
      encounterRecord("owner", { ...active(), traceId: "wrong-case", caseId: "wrong" }),
      encounterRecord("owner", { ...active(), traceId: "wrong-version", caseVersion: "1" }),
      encounterRecord("owner", { ...completed(), traceId: "completed" }, "completed"),
    ];
    const response = await GET(new NextRequest(`https://example.test/api/bty/clinical-encounter/traces?caseId=${active().caseId}&caseVersion=2.0.0&status=active`));
    const result = await response.json();
    expect(result.traces.map((r: { raw_trace: { traceId: string } }) => r.raw_trace.traceId)).toEqual(["trace-1"]);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("supersedes every matching active V2 attempt and creates a clean server-owned replacement", async () => {
    const first: Record<string, unknown> = { ...encounterRecord("owner", active()), updated_at: "2026-09-19" };
    const duplicate: Record<string, unknown> = { ...encounterRecord("owner", { ...active(), traceId: "duplicate" }), updated_at: "2026-09-20" };
    const other: Record<string, unknown> = { ...encounterRecord("other", { ...active(), traceId: "other" }), updated_at: "2026-09-20" };
    const completedRow: Record<string, unknown> = encounterRecord("owner", { ...completed(), traceId: "completed" }, "completed");
    state.rows = [first, duplicate, other, completedRow];
    const response = await restart(); const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.trace.traceId).not.toBe("trace-1");
    expect(result.trace.events.map((event: { type: string }) => event.type)).toEqual(["encounter_started", "chief_complaint_presented"]);
    expect(first).toMatchObject({ superseded_by_trace_id: result.trace.traceId });
    expect(duplicate).toMatchObject({ superseded_by_trace_id: result.trace.traceId });
    expect(other.superseded_at).toBeUndefined();
    expect(completedRow.superseded_at).toBeUndefined();
    expect((first.raw_trace as { events: unknown[] }).events).toEqual(active().events);
    expect(state.rows.filter(row => row.status === "active" && row.superseded_at == null).map(row => row.trace_id)).toEqual(expect.arrayContaining([result.trace.traceId, "other"]));
  });
  it("never auto-resumes a superseded trace and prevents its later write", async () => {
    const old = { ...encounterRecord("owner", active()), superseded_at: "2026-09-20", superseded_by_trace_id: "replacement" };
    state.rows = [old];
    const response = await GET(new NextRequest(`https://example.test/api/bty/clinical-encounter/traces?caseId=${active().caseId}&caseVersion=2.0.0&status=active`));
    expect((await response.json()).traces).toEqual([]);
    const save = await post("save");
    expect(save.status).toBe(409);
    expect((await save.json()).error).toBe("SUPERSEDED");
  });
  it("fails closed for missing authentication, database failures, and malformed requests", async () => {
    state.user = null;
    expect((await post("save")).status).toBe(401);
    expect((await GET(new NextRequest("https://example.test"))).status).toBe(401);
    state.user = "owner"; state.available = false;
    expect((await post("save")).status).toBe(503);
    expect((await GET(new NextRequest("https://example.test"))).status).toBe(503);
    state.available = true; state.failRead = true;
    expect((await post("save")).status).toBe(500);
    expect((await GET(new NextRequest("https://example.test"))).status).toBe(500);
    state.failRead = false; state.failWrite = true;
    expect((await post("save")).status).toBe(500);
    expect((await POST(request({ operation: "save", trace: { ...active(), events: [null] } }))).status).toBe(400);
    expect((await POST(request({ operation: "unknown", trace: active() }))).status).toBe(400);
    expect(state.rows).toEqual([]);
  });
});
