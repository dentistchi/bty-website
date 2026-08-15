import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTodayReminders } from "./todayReminders.server";
import { sortReminders, type TodayReminder } from "@/domain/daily/todayReminders";
import { selectPrimaryAction } from "@/domain/daily/todayPrimaryAction";

/**
 * SLICE 3.2R-R2 — APPLY_DUE in Today: visibility, the follow-up handoff, ordering, and privacy.
 *
 * The three properties that would each individually break the product idea:
 *   1. the item must appear on the FIRST day of the window, not on its last;
 *   2. it must step aside once the follow-up is asking, without being deleted;
 *   3. it must carry the learner's own sentence and nothing private.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const LA = "America/Los_Angeles";
const USER = "user-1";
const DECISION = "Next time I will say the owner's name out loud before we break.";
const SECRET_RESPONSE = "SECRET COMPLETION CHECK ANSWER";
const SECRET_REFLECTION = "SECRET PRIVATE REFLECTION BODY";

function makeAdmin(tables: Tables, windows: Row[]) {
  function from(table: string) {
    const q: Record<string, unknown> = {
      _rows: (tables[table] ?? []).slice(),
      select() { return this; },
      returns() { return this; },
      order() { return this; },
      eq(this: { _rows: Row[] }, c: string, v: unknown) { this._rows = this._rows.filter((r) => r[c] === v); return this; },
      in(this: { _rows: Row[] }, c: string, vs: unknown[]) { this._rows = this._rows.filter((r) => vs.includes(r[c])); return this; },
      not(this: { _rows: Row[] }, c: string) { this._rows = this._rows.filter((r) => r[c] !== null && r[c] !== undefined); return this; },
      maybeSingle(this: { _rows: Row[] }) { return Promise.resolve({ data: this._rows[0] ?? null, error: null }); },
      then(this: { _rows: Row[] }, onF: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: this._rows, error: null }).then(onF);
      },
    };
    return q;
  }
  const rpc = async (name: string, args: Row) => {
    if (name === "bty_foundry_list_my_apply_windows") {
      return { data: windows.filter((w) => w.user_id_snapshot === args.p_auth_user_id), error: null };
    }
    if (name === "bty_foundry_list_my_assignments") return { data: [], error: null };
    return { data: null, error: null };
  };
  return { from, rpc } as unknown as SupabaseClient;
}

const WINDOW = {
  id: "w-1",
  user_id_snapshot: USER,
  event_id: "ev-1",
  progress_id: "prog-1",
  source_training_title: "Huddle ownership",
  completion_bty_day: "2026-08-14",
  due_bty_day: "2026-08-21",
  due_at: "2026-08-21T12:00:00.000Z",
};

/** A progress row carrying the decision AND both private columns, to prove the allow-list. */
function progressTables(over: Row = {}): Tables {
  return {
    foundry_event_training_progress: [
      {
        id: "prog-1",
        linked_user_id: USER,
        decision_response_text: DECISION,
        response_text: SECRET_RESPONSE,
        learner_reflection_text: SECRET_REFLECTION,
        ...over,
      },
    ],
    foundry_participant_followups: [],
    bty_action_contracts: [],
    arena_pending_outcomes: [],
  };
}

const build = (t: Tables, w: Row[], iso: string) =>
  buildTodayReminders(makeAdmin(t, w), USER, new Date(iso), LA, "en");

describe("APPLY_DUE — visible from day one", () => {
  it("J — appears on the FIRST day of the window, as `active`", async () => {
    const r = await build(progressTables(), [WINDOW], "2026-08-14T20:00:00Z");
    const apply = r.filter((x) => x.category === "APPLY_DUE");
    expect(apply).toHaveLength(1);
    expect(apply[0]!.state).toBe("active");
  });

  it("the learner's OWN SENTENCE is the title, and the training title is the note", async () => {
    const r = await build(progressTables(), [WINDOW], "2026-08-14T20:00:00Z");
    const a = r.find((x) => x.category === "APPLY_DUE")!;
    expect(a.title).toBe(DECISION);
    expect(a.note).toBe("Huddle ownership");
  });

  it("K — the day transition active → due_today → overdue is day-granular", async () => {
    const state = async (iso: string) =>
      (await build(progressTables(), [WINDOW], iso)).find((x) => x.category === "APPLY_DUE")?.state;
    expect(await state("2026-08-20T20:00:00Z")).toBe("active");
    expect(await state("2026-08-21T12:00:01Z")).toBe("due_today"); // 05:00:01 local — NOT overdue
    expect(await state("2026-08-22T11:59:00Z")).toBe("due_today"); // 04:59 local, still the due day
    // A CLOSED window leaves Today entirely — see the projection rule. It is not "overdue work".
    expect(await state("2026-08-22T12:00:00Z")).toBeUndefined();
  });

  it("a closed window LEAVES Today rather than pinning itself to the top forever", async () => {
    /*
      `sortReminders` ranks by state, not category, so projecting an overdue window would place it
      at rank 0 — above genuinely urgent work — and, with no follow-up to hand off to, it would
      stay there permanently.
    */
    const r = await build(progressTables(), [WINDOW], "2026-09-30T20:00:00Z");
    expect(r.filter((x) => x.category === "APPLY_DUE")).toHaveLength(0);
  });

  it("deep-links back to the learner's own record, never to Arena", async () => {
    const r = await build(progressTables(), [WINDOW], "2026-08-14T20:00:00Z");
    const a = r.find((x) => x.category === "APPLY_DUE")!;
    expect(a.canonicalDeepLink).toContain("tab=me");
    expect(a.canonicalDeepLink).toContain("my-learning");
    expect(a.canonicalDeepLink).not.toContain("arena");
  });

  it("a window whose decision cannot be read is NOT shown — never an empty commitment card", async () => {
    const r = await build(progressTables({ decision_response_text: null }), [WINDOW], "2026-08-14T20:00:00Z");
    expect(r.filter((x) => x.category === "APPLY_DUE")).toHaveLength(0);
  });

  it("another learner's window is never projected", async () => {
    const foreign = { ...WINDOW, user_id_snapshot: "user-2" };
    const r = await build(progressTables(), [foreign], "2026-08-14T20:00:00Z");
    expect(r.filter((x) => x.category === "APPLY_DUE")).toHaveLength(0);
  });
});

describe("L — the follow-up handoff", () => {
  const withFollowup = (status: string, dueAt: string): Tables => ({
    ...progressTables(),
    foundry_participant_followups: [
      { id: "fu-1", progress_id: "prog-1", user_id_snapshot: USER, status, due_at: dueAt, follow_up_days: 7, source_training_title: "Huddle ownership" },
    ],
  });

  it("APPLY_DUE is shown while the follow-up is still upcoming", async () => {
    const t = withFollowup("PENDING", "2026-08-28T12:00:00.000Z");
    const r = await build(t, [WINDOW], "2026-08-17T20:00:00Z");
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(true);
  });

  it("APPLY_DUE is SUPPRESSED and FOLLOW_UP_DUE shown once the follow-up is due today", async () => {
    const t = withFollowup("PENDING", "2026-08-21T12:00:00.000Z");
    const r = await build(t, [WINDOW], "2026-08-21T20:00:00Z");
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(false);
    expect(r.some((x) => x.category === "FOLLOW_UP_DUE")).toBe(true);
  });

  it("APPLY_DUE stays suppressed once the follow-up is overdue", async () => {
    const t = withFollowup("PENDING", "2026-08-21T12:00:00.000Z");
    const r = await build(t, [WINDOW], "2026-08-25T20:00:00Z");
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(false);
  });

  it("APPLY_DUE stays suppressed after the follow-up is answered", async () => {
    const t = withFollowup("RESPONDED", "2026-08-21T12:00:00.000Z");
    const r = await build(t, [WINDOW], "2026-09-01T20:00:00Z");
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(false);
  });

  it("suppression is a READ rule — a follow-up for a DIFFERENT progress row suppresses nothing", async () => {
    const t: Tables = {
      ...progressTables(),
      foundry_participant_followups: [
        { id: "fu-9", progress_id: "prog-OTHER", user_id_snapshot: USER, status: "PENDING", due_at: "2026-08-14T12:00:00.000Z", follow_up_days: 7, source_training_title: "Something else" },
      ],
    };
    const r = await build(t, [WINDOW], "2026-08-17T20:00:00Z");
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(true);
  });
});

describe("M — unrelated Today sources keep their exact ordering", () => {
  const mk = (over: Partial<TodayReminder>): TodayReminder => ({
    stableId: "x", category: "ACTION_DUE", title: "t", state: "upcoming",
    sourceTimestamp: null, roleContext: "learner", canonicalDeepLink: "/", ...over,
  });

  it("the five original states keep their relative order after `active` was inserted", () => {
    const sorted = sortReminders([
      mk({ stableId: "e", state: "upcoming" }),
      mk({ stableId: "d", state: "incomplete_required" }),
      mk({ stableId: "c", state: "due_today" }),
      mk({ stableId: "b", state: "needs_revision" }),
      mk({ stableId: "a", state: "overdue" }),
    ]).map((r) => r.stableId);
    expect(sorted).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("`active` sorts below due_today and above incomplete_required", () => {
    const sorted = sortReminders([
      mk({ stableId: "incomplete", state: "incomplete_required" }),
      mk({ stableId: "active", state: "active", category: "APPLY_DUE" }),
      mk({ stableId: "today", state: "due_today" }),
      mk({ stableId: "upcoming", state: "upcoming" }),
    ]).map((r) => r.stableId);
    expect(sorted).toEqual(["today", "active", "incomplete", "upcoming"]);
  });

  it("an overdue Action outranks an Apply window in every state Today can emit", () => {
    /*
      Only `active` and `due_today` are projected, and both rank strictly below `overdue`. So an
      Apply card can never sit above genuinely urgent work — which is the property that made
      dropping the closed state necessary, since `sortReminders` ignores category entirely.
    */
    for (const st of ["active", "due_today"] as const) {
      const sorted = sortReminders([
        mk({ stableId: "apply", state: st, category: "APPLY_DUE", sourceTimestamp: "2020-01-01" }),
        mk({ stableId: "action", state: "overdue", category: "ACTION_DUE", sourceTimestamp: "2030-01-01" }),
      ]).map((r) => r.stableId);
      expect(sorted[0], st).toBe("action");
    }
  });

  it("APPLY_DUE can NEVER displace an existing primary action", () => {
    /*
      The safety property behind giving APPLY_DUE the last CATEGORY_RANK. Adding a strictly
      lowest-priority category cannot change any selection that had another candidate.
    */
    const cand = (category: TodayReminder["category"], state: TodayReminder["state"], id: string) =>
      ({ stableId: id, category, state, title: id, deepLink: "/" }) as const;
    for (const other of ["ACTION_REVISION", "ACTION_DUE", "REQUIRED_LEARNING", "PRACTICE_DUE", "FOLLOW_UP_DUE"] as const) {
      const picked = selectPrimaryAction([
        cand("APPLY_DUE", "due_today", "apply"),
        cand(other, "upcoming", "other"),
      ]);
      expect(picked.kind === "reminder" && picked.candidate.stableId, other).toBe("other");
    }
  });

  it("…but IS selected when it is the only thing the learner has", () => {
    const picked = selectPrimaryAction([
      { stableId: "apply", category: "APPLY_DUE", state: "active", title: "my decision", deepLink: "/" },
    ]);
    expect(picked.kind).toBe("reminder");
    expect(picked.kind === "reminder" && picked.candidate.category).toBe("APPLY_DUE");
  });
});

describe("PRIVACY — Today can never carry private learner text", () => {
  it("the serialized Today payload contains the decision and NEITHER private column", async () => {
    const r = await build(progressTables(), [WINDOW], "2026-08-14T20:00:00Z");
    const json = JSON.stringify(r);
    expect(json).toContain(DECISION); // the learner's own sentence — the whole point
    expect(json).not.toContain(SECRET_RESPONSE);
    expect(json).not.toContain(SECRET_REFLECTION);
    for (const key of ["response_text", "learner_reflection_text", "decision_response_text"]) {
      expect(json, key).not.toContain(key);
    }
  });

  it("a foreign learner's decision is unreachable even when their window id is known", async () => {
    // The window belongs to user-1; the progress row is owner-scoped by linked_user_id.
    const t = progressTables({ linked_user_id: "user-2" });
    const r = await build(t, [WINDOW], "2026-08-14T20:00:00Z");
    expect(r.filter((x) => x.category === "APPLY_DUE")).toHaveLength(0);
    expect(JSON.stringify(r)).not.toContain(DECISION);
  });
});

describe("DAY 7 — what is actually observable, by follow-up configuration", () => {
  /*
    R2's device-gate prose claimed the learner would see a "Last day" Apply card on day 7. For the
    common configuration that is FALSE, and this block is the correction.

    A 7-day follow-up becomes due on the SAME BTY day the 7-day window closes, so suppression fires
    on exactly that day and the Apply card is replaced by the Follow-up card. "Last day" is only
    reachable when nothing supersedes it that day — no follow-up at all, or a 30-day checkpoint.

    The implementation was already correct; only the instructions were wrong. These tests exist so
    the instructions cannot drift from the behaviour again.
  */
  const followup = (days: number, dueAt: string, status = "PENDING"): Tables => ({
    ...progressTables(),
    foundry_participant_followups: [
      { id: "fu-1", progress_id: "prog-1", user_id_snapshot: USER, status, due_at: dueAt, follow_up_days: days, source_training_title: "Huddle ownership" },
    ],
  });
  // Window: completed 2026-08-14 → closes 2026-08-21. Day 7 = 2026-08-21.
  const DAY7 = "2026-08-21T20:00:00Z";

  it("7-day follow-up → on day 7 the Apply card is GONE and Follow-up is shown ('Last day' unobservable)", async () => {
    const r = await build(followup(7, "2026-08-21T12:00:00.000Z"), [WINDOW], DAY7);
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(false);
    expect(r.some((x) => x.category === "FOLLOW_UP_DUE")).toBe(true);
  });

  it("7-day follow-up → day 6 still shows the Apply card as `active`", async () => {
    const r = await build(followup(7, "2026-08-21T12:00:00.000Z"), [WINDOW], "2026-08-20T20:00:00Z");
    const a = r.find((x) => x.category === "APPLY_DUE");
    expect(a?.state).toBe("active");
    expect(r.some((x) => x.category === "FOLLOW_UP_DUE")).toBe(false);
  });

  it("30-day follow-up → on day 7 'Last day' IS observable, and no Follow-up yet", async () => {
    const r = await build(followup(30, "2026-09-13T12:00:00.000Z"), [WINDOW], DAY7);
    expect(r.find((x) => x.category === "APPLY_DUE")?.state).toBe("due_today");
    expect(r.some((x) => x.category === "FOLLOW_UP_DUE")).toBe(false);
  });

  it("NO follow-up configured → 'Last day' IS observable on day 7", async () => {
    const r = await build(progressTables(), [WINDOW], DAY7);
    expect(r.find((x) => x.category === "APPLY_DUE")?.state).toBe("due_today");
  });

  it("30-day follow-up → the gap after the window closes shows NEITHER card", async () => {
    /*
      Days 8..29: the window has closed (not projected) and the follow-up has not arrived. Today is
      honestly quiet about this training. That gap is the reason the closed state is not projected —
      an "overdue" Apply card would have sat at the top of Today for three weeks.
    */
    const r = await build(followup(30, "2026-09-13T12:00:00.000Z"), [WINDOW], "2026-08-30T20:00:00Z");
    expect(r.some((x) => x.category === "APPLY_DUE")).toBe(false);
    expect(r.some((x) => x.category === "FOLLOW_UP_DUE")).toBe(false);
  });
});
