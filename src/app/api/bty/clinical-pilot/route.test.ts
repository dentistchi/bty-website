import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { initialAnswers } from "@/domain/clinical-pilot/pilot";

const state = vi.hoisted(() => ({ user: "owner" as string | null, admin: false, unavailable: false, failWrite: false, race: false, rows: [] as Record<string, any>[] }));
vi.mock("@/lib/authz", () => ({
  requireUser: async () => state.user ? { ok: true, user: { id: state.user } } : { ok: false, status: 401 },
  requirePlatformAdmin: async () => state.user && state.admin ? { ok: true, user: { id: state.user } } : { ok: false, status: state.user ? 403 : 401 },
  isActivePlatformAdmin: async () => state.admin,
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => state.unavailable ? null : { from: () => {
  let mode = "read", values: Record<string, any> = {}, max = Infinity;
  const filters: ((r: Record<string, any>) => boolean)[] = [];
  const value = (row: Record<string, any>, key: string) => key === "raw_trace->>phase" ? row.raw_trace.phase : row[key];
  const execute = () => {
    if (mode !== "read" && state.failWrite) return { data: null, error: { code: "FAIL" } };
    if (mode === "update" && state.race) { state.rows[0].updated_at = "2099-01-01T00:00:00Z"; state.race = false; }
    let rows = state.rows.filter(row => filters.every(f => f(row)));
    if (mode === "insert") {
      if (state.rows.some(r => r.trace_id === values.trace_id)) return { data: null, error: { code: "23505" } };
      state.rows.push(structuredClone(values)); rows = [state.rows.at(-1)!];
    }
    if (mode === "update") rows.forEach(row => Object.assign(row, structuredClone(values)));
    return { data: structuredClone(rows.slice(0, max)), error: null };
  };
  const q = {
    select: () => q,
    eq: (key: string, expected: unknown) => { filters.push(row => value(row, key) === expected); return q; },
    neq: (key: string, expected: unknown) => { filters.push(row => value(row, key) !== expected); return q; },
    in: (key: string, expected: unknown[]) => { filters.push(row => expected.includes(value(row, key))); return q; },
    order: () => q,
    limit: (n: number) => { max = n; return q; },
    insert: (data: object) => { mode = "insert"; values = data; return q; },
    update: (data: object) => { mode = "update"; values = data; return q; },
    maybeSingle: async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; },
    then: (resolve: (x: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return q;
} } }));
const id = "11111111-1111-4111-8111-111111111111";
const req = (body: object) => new NextRequest("https://bty.test/api/bty/clinical-pilot", { method: "POST", body: JSON.stringify(body) });
const post = (operation: string, extra = {}, requestId = crypto.randomUUID(), traceId = id) => POST(req({ operation, traceId, requestId, ...extra }));
const start = (traceId = id) => post("start", { caseId: "drchi-023", caseVersion: "2026-10-23.1" }, crypto.randomUUID(), traceId);
const answers = { evaluation: " Check contact ", diagnosis: "Open contact", plan: "Assess #29", rationale: "Keep functioning crown if appropriate" };
const get = (query = "") => GET(new NextRequest(`https://bty.test/api/bty/clinical-pilot${query}`));
beforeEach(() => { vi.stubEnv("CLINICAL_AUTHOR_PILOT_ENABLED", "1"); state.user = "owner"; state.admin = false; state.unavailable = false; state.failWrite = false; state.race = false; state.rows = []; });
afterEach(() => vi.unstubAllEnvs());

describe("pilot authenticated capture API", () => {
  it("fails closed until the migration prerequisite has been approved and the pilot enabled", async () => {
    vi.stubEnv("CLINICAL_AUTHOR_PILOT_ENABLED", "0");
    expect((await start()).status).toBe(503);
    expect((await (await get()).json()).error).toBe("PILOT_NOT_ENABLED");
    expect(state.rows).toEqual([]);
  });
  it("hides every reference before submission, including in server responses to start/save", async () => {
    const catalog = await (await get()).json();
    expect(catalog.cases).toHaveLength(23);
    expect(JSON.stringify(catalog)).not.toContain("authorParaphrase");
    expect(JSON.stringify(catalog)).not.toContain("#29 filling 다시");
    expect((await start()).status).toBe(200);
    const saved = await (await post("save", { answers })).json();
    expect(saved.trace.events.some((e: { type: string }) => e.type === "reference_released")).toBe(false);
    expect(JSON.stringify(saved)).not.toContain("#29 filling 다시");
    expect(state.rows[0].user_id).toBe("owner");
  });
  it("commits initial reasoning before returning its reference; reacts without overwriting it", async () => {
    await start();
    const requestId = crypto.randomUUID();
    const submitted = await (await post("submit", { answers }, requestId)).json();
    expect(submitted.trace.phase).toBe("submitted");
    expect(initialAnswers(state.rows[0].raw_trace)).toEqual(answers);
    expect(JSON.stringify(submitted)).toContain("#29 filling 다시");
    const count = submitted.trace.events.length;
    expect((await post("submit", { answers }, requestId)).status).toBe(200);
    expect(state.rows[0].raw_trace.events).toHaveLength(count);
    expect((await post("save", { answers })).status).toBe(409);
    expect((await post("react", { reaction: { helpful: "no", comment: "different approach", revisedPlan: "same plan" } })).status).toBe(200);
    expect(state.rows[0].status).toBe("completed");
    expect(initialAnswers(state.rows[0].raw_trace)).toEqual(answers);
  });
  it("does not release a reference if persistence fails and permits an identical retry", async () => {
    await start(); state.failWrite = true;
    const requestId = crypto.randomUUID();
    const failed = await post("submit", { answers }, requestId);
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain("recorded approach");
    expect(state.rows[0].raw_trace.phase).toBe("draft");
    state.failWrite = false;
    expect((await post("submit", { answers }, requestId)).status).toBe(200);
  });
  it("enforces ownership, authentication, and a separate platform-admin review gate", async () => {
    await start(); state.user = "other";
    expect((await post("submit", { answers })).status).toBe(404);
    expect((await (await get("?caseId=drchi-023")).json()).traces).toEqual([]);
    expect((await get("?view=review")).status).toBe(403);
    state.admin = true;
    const reviewed = await (await get("?view=review")).json();
    expect(reviewed.rows).toHaveLength(1);
    expect(reviewed.rows[0]).not.toHaveProperty("user_id");
    state.user = null;
    expect((await start()).status).toBe(401);
    expect((await get()).status).toBe(401);
  });
  it("rejects malformed, missing reasoning and unsupported cases without mutations", async () => {
    expect((await post("start", { caseId: "no", caseVersion: "1" })).status).toBe(400);
    await start();
    expect((await post("submit", { answers: { ...answers, evaluation: "  " } })).status).toBe(400);
    expect((await post("submit", { answers, user_id: "other" })).status).toBe(400);
    expect(state.rows[0].raw_trace.phase).toBe("draft");
  });
  it("prevents a concurrent save from replacing the newer raw history", async () => {
    await start(); const before = structuredClone(state.rows[0].raw_trace); state.race = true;
    expect((await post("submit", { answers })).status).toBe(409);
    expect(state.rows[0].raw_trace).toEqual(before);
  });
  it("detects prior submissions beyond recent drafts and rechecks at submission", async () => {
    await start();
    await post("submit", { answers });
    // Many newer drafts must not hide an older released reference.
    for (let i = 0; i < 21; i++) state.rows.unshift({ ...structuredClone(state.rows[0]), trace_id: crypto.randomUUID(), raw_trace: { ...state.rows[0].raw_trace, phase: "draft" } });
    const nextId = crypto.randomUUID();
    const next = await (await start(nextId)).json();
    expect(next.trace.priorReferenceExposure).toBe("prior_submission");
    const draft = state.rows.at(-1)!.raw_trace; draft.priorReferenceExposure = "not_recorded";
    const submitted = await (await post("submit", { answers }, crypto.randomUUID(), nextId)).json();
    expect(submitted.trace.priorReferenceExposure).toBe("prior_submission");
  });
});
