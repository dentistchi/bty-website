import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAccessPractice,
  completedSourceTraining,
  hasCompletedPracticeForEvent,
  publishedPracticeForEvent,
  resolvePracticeAccess,
} from "./foundryArenaPracticeRunService";

/**
 * SLICE 3.2M-2 — a learner who did the training may practise it.
 *
 * Before this, access was `approved Arena member OR the creator`, so someone who finished a
 * training and was invited to "now try it" was refused by a membership rule that had nothing
 * to do with them. The third path is the narrowest the durable data supports.
 */
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function fakeAdmin(tables: Tables): SupabaseClient {
  function from(table: string) {
    const q = {
      _rows: (tables[table] ?? []).slice(),
      select() { return this; },
      eq(this: { _rows: Row[] }, c: string, v: unknown) { this._rows = this._rows.filter((r) => r[c] === v); return this; },
      in(this: { _rows: Row[] }, c: string, vs: unknown[]) { this._rows = this._rows.filter((r) => vs.includes(r[c])); return this; },
      maybeSingle(this: { _rows: Row[] }) { return Promise.resolve({ data: this._rows[0] ?? null, error: null }); },
      then(this: { _rows: Row[] }, onF: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: this._rows, error: null }).then(onF);
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const EVENT = "ev-1";
const LEARNER = "user-learner";
const STRANGER = "user-stranger";
const CREATOR = "user-creator";
const PRACTICE = { id: "pr-1", published_by: CREATOR, source_event_id: EVENT };

const seed = (over: Partial<Tables> = {}): Tables => ({
  foundry_published_arena_practices: [
    { id: "pr-1", practice_title: "Handing over under pressure", source_event_id: EVENT, status: "published", published_at: "2026-08-01T00:00:00Z" },
  ],
  foundry_event_training_progress: [
    { id: "p-1", event_id: EVENT, linked_user_id: LEARNER, completed_at: "2026-08-02T00:00:00Z" },
  ],
  foundry_arena_practice_runs: [],
  ...over,
});

describe("[3.2M-2] who may enter the practice", () => {
  it("A/B — the learner who completed the source training may enter, with no Arena membership", async () => {
    expect(canAccessPractice(PRACTICE, LEARNER, false), "the old rule refused them").toBe(false);
    expect(await resolvePracticeAccess(fakeAdmin(seed()), PRACTICE, LEARNER, false)).toBe(true);
  });

  it("C — joined but never completed does NOT get in", async () => {
    const t = seed({
      foundry_event_training_progress: [{ id: "p-1", event_id: EVENT, linked_user_id: LEARNER, completed_at: null }],
    });
    expect(await resolvePracticeAccess(fakeAdmin(t), PRACTICE, LEARNER, false)).toBe(false);
  });

  it("D — an unrelated user cannot get in by knowing the id", async () => {
    expect(await resolvePracticeAccess(fakeAdmin(seed()), PRACTICE, STRANGER, false)).toBe(false);
  });

  it("E — an anonymous participant has no account, so there is nothing to let in", async () => {
    const t = seed({
      foundry_event_training_progress: [{ id: "p-1", event_id: EVENT, linked_user_id: null, completed_at: "2026-08-02T00:00:00Z" }],
    });
    expect(await completedSourceTraining(fakeAdmin(t), "", EVENT)).toBe(false);
    expect(await resolvePracticeAccess(fakeAdmin(t), PRACTICE, LEARNER, false)).toBe(false);
  });

  it("the two existing paths are untouched — creator and approved member still enter", async () => {
    expect(await resolvePracticeAccess(fakeAdmin(seed()), PRACTICE, CREATOR, false)).toBe(true);
    expect(await resolvePracticeAccess(fakeAdmin(seed()), PRACTICE, STRANGER, true)).toBe(true);
  });

  it("completing a DIFFERENT training does not open this practice", async () => {
    const t = seed({
      foundry_event_training_progress: [{ id: "p-1", event_id: "ev-other", linked_user_id: LEARNER, completed_at: "2026-08-02T00:00:00Z" }],
    });
    expect(await resolvePracticeAccess(fakeAdmin(t), PRACTICE, LEARNER, false)).toBe(false);
  });
});

describe("[3.2M-2] the doorway", () => {
  it("finds the published practice built from this training", async () => {
    expect(await publishedPracticeForEvent(fakeAdmin(seed()), EVENT)).toEqual({
      id: "pr-1", title: "Handing over under pressure",
    });
  });

  it("a training with no practice offers none — never a dead CTA", async () => {
    expect(await publishedPracticeForEvent(fakeAdmin(seed({ foundry_published_arena_practices: [] })), EVENT)).toBeNull();
    expect(await publishedPracticeForEvent(fakeAdmin(seed()), "ev-other")).toBeNull();
  });

  it("a retired practice is not offered", async () => {
    const t = seed({
      foundry_published_arena_practices: [{ id: "pr-1", practice_title: "T", source_event_id: EVENT, status: "retired", published_at: "2026-08-01T00:00:00Z" }],
    });
    expect(await publishedPracticeForEvent(fakeAdmin(t), EVENT)).toBeNull();
  });
});

describe("[3.2M-2] what earns PRACTICED", () => {
  const withRun = (status: string, practiceId = "pr-1", userId = LEARNER) =>
    seed({ foundry_arena_practice_runs: [{ id: "run-1", practice_id: practiceId, user_id: userId, status }] });

  it("a COMPLETED run of this training's practice earns it", async () => {
    expect(await hasCompletedPracticeForEvent(fakeAdmin(withRun("completed")), LEARNER, EVENT)).toBe(true);
  });

  it("starting it, or abandoning it mid-way, earns nothing", async () => {
    expect(await hasCompletedPracticeForEvent(fakeAdmin(withRun("in_progress")), LEARNER, EVENT)).toBe(false);
    expect(await hasCompletedPracticeForEvent(fakeAdmin(seed()), LEARNER, EVENT)).toBe(false);
  });

  it("someone else's completed run is not yours", async () => {
    expect(await hasCompletedPracticeForEvent(fakeAdmin(withRun("completed", "pr-1", STRANGER)), LEARNER, EVENT)).toBe(false);
  });

  it("a completed run of a DIFFERENT training's practice is not this one", async () => {
    const t = seed({
      foundry_published_arena_practices: [
        { id: "pr-1", practice_title: "T", source_event_id: EVENT, status: "published", published_at: "2026-08-01T00:00:00Z" },
        { id: "pr-2", practice_title: "Other", source_event_id: "ev-other", status: "published", published_at: "2026-08-01T00:00:00Z" },
      ],
      foundry_arena_practice_runs: [{ id: "run-1", practice_id: "pr-2", user_id: LEARNER, status: "completed" }],
    });
    expect(await hasCompletedPracticeForEvent(fakeAdmin(t), LEARNER, EVENT)).toBe(false);
  });

  it("a training with no practice can never yield it", async () => {
    expect(await hasCompletedPracticeForEvent(fakeAdmin(seed({ foundry_published_arena_practices: [] })), LEARNER, EVENT)).toBe(false);
  });
});
