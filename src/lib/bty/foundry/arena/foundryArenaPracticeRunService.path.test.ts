import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSelectedPath, startPracticeRun } from "./foundryArenaPracticeRunService";
import type { ArenaScenarioDraft, ScenarioBranch } from "@/domain/foundry/arena-draft/types";

type Row = Record<string, unknown>;

function branch(p: string): ScenarioBranch {
  return {
    escalationText: `${p} escalation`,
    tradeoffChoices: [{ id: `${p}_t1`, label: "x" }, { id: `${p}_t2`, label: "y" }],
    actionDecision: { prompt: "p", choices: [{ id: `${p}_a1`, label: "x", isActionCommitment: true }, { id: `${p}_a2`, label: "y", isActionCommitment: false }] },
  };
}
const SNAPSHOT: ArenaScenarioDraft = {
  title: "t", opening: "o",
  primary: { choices: [{ id: "primary_1", label: "A" }, { id: "primary_2", label: "B" }] },
  tradeoff: { escalationText: "flat", choices: [{ id: "ft1", label: "x" }, { id: "ft2", label: "y" }] },
  actionDecision: { prompt: "p", choices: [{ id: "fa1", label: "x", isActionCommitment: true }, { id: "fa2", label: "y", isActionCommitment: false }] },
  branches: { primary_1: branch("p1"), primary_2: branch("p2") },
};

function makeAdmin(runs: Row[]) {
  const tables: Record<string, Row[]> = {
    foundry_published_arena_practices: [
      { id: "prac-1", status: "published", scenario_snapshot: SNAPSHOT, published_by: "host-1", practice_title: "t", source_training_title: "T", source_event_id: "e", source_module_version: 1 },
    ],
    foundry_arena_practice_runs: runs,
  };
  type QB = {
    _f: Array<{ c: string; v: unknown }>;
    _op: string;
    _patch: Row;
    select: () => QB;
    update: (p: Row) => QB;
    eq: (c: string, v: unknown) => QB;
    order: () => QB;
    limit: () => QB;
    returns: () => QB;
    _match: (r: Row) => boolean;
    _run: () => Row[];
    maybeSingle: () => Promise<{ data: Row | null; error: null }>;
    then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise<unknown>;
  };
  function from(table: string): QB {
    const rows = tables[table] ?? (tables[table] = []);
    const b: QB = {
      _f: [], _op: "select", _patch: {},
      select() { return b; },
      update(p: Row) { b._op = "update"; b._patch = p; return b; },
      eq(c: string, v: unknown) { b._f.push({ c, v }); return b; },
      order() { return b; },
      limit() { return b; },
      returns() { return b; },
      _match(r: Row) { return b._f.every((f) => r[f.c] === f.v); },
      _run(): Row[] {
        if (b._op === "update") { const u: Row[] = []; for (const r of rows) if (b._match(r)) { Object.assign(r, b._patch); u.push(r); } return u; }
        return rows.filter((r) => b._match(r));
      },
      maybeSingle() { return Promise.resolve({ data: b._run()[0] ?? null, error: null }); },
      then(res: (v: { data: Row[]; error: null }) => unknown) { return Promise.resolve({ data: b._run(), error: null }).then(res); },
    };
    return b;
  }
  return { admin: { from } as unknown as SupabaseClient, tables };
}

const RUN = () => ({ id: "run-1", practice_id: "prac-1", user_id: "learner-1", status: "in_progress", completed_at: null, selected_path: null });

describe("recordSelectedPath — snapshot-validated, fail-closed", () => {
  it("persists a valid path and returns the canonical stored path", async () => {
    const { admin, tables } = makeAdmin([RUN()]);
    const r = await recordSelectedPath(admin, "learner-1", "prac-1", "run-1", { primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t2", actionChoiceId: "p1_a1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.selectedPath).toEqual({ v: 1, primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t2", actionChoiceId: "p1_a1" });
    expect(tables.foundry_arena_practice_runs[0].selected_path).toMatchObject({ primaryChoiceId: "primary_1" });
  });

  it("rejects a cross-branch tradeoff (Tradeoff from branch 2 under Primary 1)", async () => {
    const { admin } = makeAdmin([RUN()]);
    const r = await recordSelectedPath(admin, "learner-1", "prac-1", "run-1", { primaryChoiceId: "primary_1", tradeoffChoiceId: "p2_t1" });
    expect(r).toMatchObject({ ok: false, reason: "tradeoff_not_in_branch" });
  });

  it("rejects another user's run (cross-user)", async () => {
    const { admin } = makeAdmin([RUN()]);
    const r = await recordSelectedPath(admin, "intruder", "prac-1", "run-1", { primaryChoiceId: "primary_1" });
    expect(r).toMatchObject({ ok: false, reason: "practice_run_not_found" });
  });

  it("rejects a primary change mid-run", async () => {
    const { admin } = makeAdmin([{ ...RUN(), selected_path: { v: 1, primaryChoiceId: "primary_1" } }]);
    const r = await recordSelectedPath(admin, "learner-1", "prac-1", "run-1", { primaryChoiceId: "primary_2" });
    expect(r).toMatchObject({ ok: false, reason: "primary_changed" });
  });
});

describe("startPracticeRun — returns stored path for restore", () => {
  it("resumes an in-progress run and returns its selected_path", async () => {
    const stored = { v: 1, primaryChoiceId: "primary_2", tradeoffChoiceId: "p2_t1" };
    const { admin } = makeAdmin([{ ...RUN(), selected_path: stored }]);
    const r = await startPracticeRun(admin, "learner-1", "prac-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.resumed).toBe(true);
      expect(r.value.selectedPath).toEqual(stored);
    }
  });
});
