import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publishPractice } from "./foundryArenaPublishService";
import {
  completePracticeRun,
  getPlayablePractice,
  getUserPracticeState,
  listAvailablePractices,
  startPracticeRun,
} from "./foundryArenaPracticeRunService";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

type Row = Record<string, unknown>;

function scenario(over: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "Speak up",
    opening: "A teammate proposes skipping a check.",
    primary: { choices: [{ id: "p1", label: "Raise it" }, { id: "p2", label: "Ask first" }] },
    tradeoff: {
      escalationText: "The manager backs the shortcut.",
      choices: [{ id: "t1", label: "Hold" }, { id: "t2", label: "Defer" }],
    },
    actionDecision: {
      prompt: "What will you do?",
      choices: [
        { id: "a1", label: "Act now", isActionCommitment: true },
        { id: "a2", label: "Wait", isActionCommitment: false },
      ],
    },
    ...over,
  };
}

/** Table-aware fake supporting the call shapes these services use, incl. limit(). */
function makeFakeAdmin(seed: { drafts?: Row[]; events?: Row[]; practices?: Row[]; runs?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    foundry_arena_scenario_drafts: (seed.drafts ?? []).map((r) => ({ ...r })),
    foundry_events: (seed.events ?? []).map((r) => ({ ...r })),
    foundry_published_arena_practices: (seed.practices ?? []).map((r) => ({ ...r })),
    foundry_arena_practice_runs: (seed.runs ?? []).map((r) => ({ ...r })),
  };
  let idSeq = 0;

  function applyDefaults(table: string, row: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_published_arena_practices") {
      return {
        id: row.id ?? `pub-${++idSeq}`,
        status: row.status ?? "published",
        availability: row.availability ?? "all_members",
        published_at: now,
        retired_at: null,
        ...row,
      };
    }
    if (table === "foundry_arena_practice_runs") {
      return {
        id: row.id ?? `run-${++idSeq}`,
        status: row.status ?? "in_progress",
        started_at: now,
        completed_at: null,
        ...row,
      };
    }
    return { id: row.id ?? `row-${++idSeq}`, ...row, created_at: now, updated_at: now };
  }

  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const b = {
      _op: "select" as "select" | "insert" | "update" | "delete",
      _filters: [] as Array<{ c: string; v: unknown }>,
      _patch: {} as Row,
      _insert: null as Row | null,
      _sort: null as { c: string; asc: boolean } | null,
      _limit: null as number | null,
      select() { return b; },
      insert(r: Row) { b._op = "insert"; b._insert = r; return b; },
      update(p: Row) { b._op = "update"; b._patch = p; return b; },
      delete() { b._op = "delete"; return b; },
      eq(c: string, v: unknown) { b._filters.push({ c, v }); return b; },
      order(c: string, opts?: { ascending?: boolean }) { b._sort = { c, asc: opts?.ascending ?? true }; return b; },
      limit(n: number) { b._limit = n; return b; },
      returns() { return b; },
      _match(r: Row) { return b._filters.every((f) => r[f.c] === f.v); },
      _run(): Row[] {
        if (b._op === "insert" && b._insert) {
          const row = applyDefaults(table, b._insert);
          rows.push(row);
          return [row];
        }
        if (b._op === "update") {
          const updated: Row[] = [];
          for (const r of rows) if (b._match(r)) { Object.assign(r, b._patch); updated.push(r); }
          return updated;
        }
        let out = rows.filter((r) => b._match(r));
        if (b._sort) {
          const { c, asc } = b._sort;
          out = [...out].sort((x, y) => String(x[c] ?? "").localeCompare(String(y[c] ?? "")) * (asc ? 1 : -1));
        }
        if (b._limit != null) out = out.slice(0, b._limit);
        return out;
      },
      maybeSingle() { return Promise.resolve({ data: b._run()[0] ?? null, error: null }); },
      single() {
        const res = b._run();
        return res[0] ? Promise.resolve({ data: res[0], error: null }) : Promise.resolve({ data: null, error: { message: "no_row" } });
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve({ data: b._run(), error: null }).then(resolve, reject);
      },
    };
    return b;
  }
  return { admin: { from } as unknown as SupabaseClient, tables };
}

const OWNER = "host-1";
const OTHER = "host-2";
const LEARNER = "learner-1";

function seedDraft(revision = 2, sc: ArenaScenarioDraft | null = scenario()) {
  return {
    id: "draft-1",
    owner_user_id: OWNER,
    source_event_id: "evt-1",
    source_module_version: 3,
    source_draft_id: "moduledraft-9",
    status: "draft",
    guided_answers: {},
    scenario_draft: sc,
    generation_source: "edited",
    revision,
    created_at: "t",
    updated_at: "t",
  };
}

describe("publishPractice — idempotency, lineage, stale, validation, auth", () => {
  it("publishes the exact revision with full source lineage", async () => {
    const { admin } = makeFakeAdmin({ drafts: [seedDraft(2)], events: [{ id: "evt-1", title: "Safety First" }] });
    const r = await publishPractice(admin, OWNER, "draft-1", 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.alreadyPublished).toBe(false);
      expect(r.value.row.source_draft_id).toBe("draft-1");
      expect(r.value.row.source_draft_revision).toBe(2);
      expect(r.value.row.source_event_id).toBe("evt-1");
      expect(r.value.row.source_module_version).toBe(3);
      expect(r.value.row.source_training_title).toBe("Safety First");
      expect(r.value.row.practice_title).toBe("Speak up");
    }
  });

  it("is idempotent: a duplicate publish of the same revision returns the existing version", async () => {
    const { admin, tables } = makeFakeAdmin({ drafts: [seedDraft(2)], events: [{ id: "evt-1", title: "Safety First" }] });
    const first = await publishPractice(admin, OWNER, "draft-1", 2);
    const second = await publishPractice(admin, OWNER, "draft-1", 2);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.alreadyPublished).toBe(true);
      expect(second.value.row.id).toBe(first.value.row.id);
    }
    expect(tables.foundry_published_arena_practices.length).toBe(1); // no duplicate row
  });

  it("rejects a STALE expected revision", async () => {
    const { admin } = makeFakeAdmin({ drafts: [seedDraft(5)], events: [{ id: "evt-1", title: "X" }] });
    const r = await publishPractice(admin, OWNER, "draft-1", 4);
    expect(r).toEqual({ ok: false, reason: "stale_revision" });
  });

  it("rejects a malformed scenario (never published as valid)", async () => {
    const bad = scenario();
    bad.primary.choices = []; // invalid cardinality
    const { admin } = makeFakeAdmin({ drafts: [seedDraft(1, bad)], events: [{ id: "evt-1", title: "X" }] });
    const r = await publishPractice(admin, OWNER, "draft-1", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_structure");
      expect((r.errors ?? []).length).toBeGreaterThan(0);
    }
  });

  it("refuses a foreign/missing draft (non-disclosing)", async () => {
    const { admin } = makeFakeAdmin({ drafts: [seedDraft(2)], events: [{ id: "evt-1", title: "X" }] });
    const r = await publishPractice(admin, OTHER, "draft-1", 2);
    expect(r).toMatchObject({ ok: false, reason: "arena_draft_not_found" });
  });

  it("a NEW revision publishes a NEW row (past versions preserved)", async () => {
    const { admin, tables } = makeFakeAdmin({ drafts: [seedDraft(2)], events: [{ id: "evt-1", title: "X" }] });
    await publishPractice(admin, OWNER, "draft-1", 2);
    // bump the draft revision and publish again
    tables.foundry_arena_scenario_drafts[0].revision = 3;
    const r2 = await publishPractice(admin, OWNER, "draft-1", 3);
    expect(r2.ok).toBe(true);
    expect(tables.foundry_published_arena_practices.length).toBe(2);
  });
});

describe("practice discovery + run lifecycle (zero-XP, isolated)", () => {
  function seedPublished() {
    return makeFakeAdmin({
      practices: [
        {
          id: "pub-1",
          source_draft_id: "draft-1",
          source_draft_revision: 2,
          source_event_id: "evt-1",
          source_module_version: 3,
          published_by: OWNER,
          practice_title: "Speak up",
          source_training_title: "Safety First",
          scenario_snapshot: scenario(),
          status: "published",
          availability: "all_members",
          published_at: "2026-07-17T00:00:00Z",
        },
        {
          id: "pub-2",
          source_draft_id: "draft-2",
          source_draft_revision: 0,
          source_event_id: "evt-2",
          source_module_version: 1,
          published_by: OWNER,
          practice_title: "Retired one",
          source_training_title: "Old",
          scenario_snapshot: scenario(),
          status: "retired",
          availability: "all_members",
          published_at: "2026-07-16T00:00:00Z",
          retired_at: "2026-07-17T00:00:00Z",
        },
      ],
    });
  }

  it("lists only PUBLISHED practices with the user's completion flag", async () => {
    const { admin } = seedPublished();
    const list = await listAvailablePractices(admin, LEARNER);
    expect(list.map((p) => p.id)).toEqual(["pub-1"]); // retired excluded
    expect(list[0].completed).toBe(false);
  });

  it("getPlayablePractice returns published, null for retired", async () => {
    const { admin } = seedPublished();
    expect((await getPlayablePractice(admin, "pub-1"))?.id).toBe("pub-1");
    expect(await getPlayablePractice(admin, "pub-2")).toBeNull();
  });

  it("start creates a run; a duplicate tap RESUMES the same run (no duplicate)", async () => {
    const { admin, tables } = seedPublished();
    const first = await startPracticeRun(admin, LEARNER, "pub-1");
    const second = await startPracticeRun(admin, LEARNER, "pub-1");
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.resumed).toBe(true);
      expect(second.value.runId).toBe(first.value.runId);
    }
    expect(tables.foundry_arena_practice_runs.length).toBe(1);
  });

  it("start fails honestly for a retired/missing practice", async () => {
    const { admin } = seedPublished();
    expect(await startPracticeRun(admin, LEARNER, "pub-2")).toEqual({ ok: false, reason: "practice_not_available" });
  });

  it("complete marks the user's run done, is idempotent, and reflects in state", async () => {
    const { admin } = seedPublished();
    const start = await startPracticeRun(admin, LEARNER, "pub-1");
    if (!start.ok) throw new Error("setup");
    const runId = start.value.runId;

    const done = await completePracticeRun(admin, LEARNER, "pub-1", runId);
    expect(done.ok).toBe(true);
    expect(await getUserPracticeState(admin, LEARNER, "pub-1")).toBe("completed");
    // idempotent
    expect((await completePracticeRun(admin, LEARNER, "pub-1", runId)).ok).toBe(true);
    // completion now shows in the discovery flag
    const list = await listAvailablePractices(admin, LEARNER);
    expect(list[0].completed).toBe(true);
  });

  it("complete refuses another user's run", async () => {
    const { admin } = seedPublished();
    const start = await startPracticeRun(admin, LEARNER, "pub-1");
    if (!start.ok) throw new Error("setup");
    const r = await completePracticeRun(admin, "someone-else", "pub-1", start.value.runId);
    expect(r).toMatchObject({ ok: false, reason: "practice_run_not_found" });
  });
});
