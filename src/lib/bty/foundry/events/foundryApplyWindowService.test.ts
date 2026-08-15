import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeApplyWindow, listMyApplyWindows } from "./foundryApplyWindowService";

/**
 * SLICE 3.2R-R2 — materialization matrix (Part 12, cases A–I) + the owner-scoped read.
 *
 * The window is created from four server-derived preconditions and can never be created from
 * three. Everything else here is about NOT creating a second one: completion retry, XP retry,
 * claim, claim retry. The follow-up obligation proved this exact shape in 3.1B-3K; the point of
 * these tests is that the sibling inherits it rather than approximating it.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const LA = "America/Los_Angeles";

vi.mock("@/lib/bty/daily/userDay", () => ({
  resolveUserTzContext: async () => ({ timezone: LA }),
}));

/*
  THE REAL COLUMN SETS, as `information_schema` reports them on staging (Slice 3.2R-R2.6).

  This exists because the previous fixture invented `foundry_events.organization_id`, the fake
  `select()` ignored the column list, and the service shipped a read that live PostgREST answers
  with 42703 — failing the WHOLE statement, so the title silently became the "Foundry training"
  fallback and the organization was lost. A mock that accepts any column can only ever prove the
  code runs, never that it asked for something real.

  `foundry_events` genuinely has no organization; the ASSIGNMENT carries it.
*/
const SCHEMA: Record<string, readonly string[]> = {
  foundry_events: ["id", "owner_user_id", "title", "status", "join_version", "created_at", "closed_at", "content_type", "program_id"],
  foundry_event_assignments: ["id", "event_id", "organization_id", "membership_id", "user_id", "membership_id_snapshot", "user_id_snapshot", "status", "assigned_at", "assigned_by", "assigned_by_snapshot", "participant_id", "claimed_at", "completed_at", "revoked_at", "updated_at"],
  foundry_event_training_progress: ["id", "event_id", "participant_id", "linked_user_id", "completed_at", "decision_response_text", "response_text", "learner_reflection_text", "xp_awarded_at", "updated_at"],
  foundry_event_module: ["event_id", "module_snapshot"],
};

/** Fake PostgREST + an RPC that enforces the REAL unique(progress_id) idempotency. */
function makeFakeAdmin(tables: Tables, opts: { rpcError?: boolean; missingTable?: boolean } = {}) {
  const created: Row[] = [];
  const calls: { name: string; args: Row }[] = [];
  function from(table: string) {
    if (opts.missingTable && table === "foundry_participant_apply_windows") {
      throw new Error('relation "foundry_participant_apply_windows" does not exist');
    }
    const q: Record<string, unknown> = {
      _rows: (tables[table] ?? []).slice(),
      /** 42703 is a STATEMENT error: one unknown column and the whole read returns no data. */
      select(this: { _rows: Row[] }, cols?: string) {
        const known = SCHEMA[table];
        if (known && typeof cols === "string" && cols !== "*") {
          const unknown = cols.split(",").map((c) => c.trim()).filter((c) => c && !known.includes(c));
          if (unknown.length > 0) this._rows = [];
        }
        return this;
      },
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
    calls.push({ name, args });
    if (opts.rpcError) return { data: null, error: { message: "boom" } };
    if (name === "bty_foundry_materialize_apply_window") {
      if (args.p_apply_days !== 7) return { data: [{ result: "skipped" }], error: null };
      if (!args.p_user_id_snapshot || !args.p_progress_id) return { data: [{ result: "skipped" }], error: null };
      if (String(args.p_due_bty_day) <= String(args.p_completion_bty_day)) return { data: [{ result: "skipped" }], error: null };
      // unique (progress_id)
      if (created.some((r) => r.progress_id === args.p_progress_id)) return { data: [{ result: "exists" }], error: null };
      created.push({ ...args, progress_id: args.p_progress_id });
      return { data: [{ result: "created" }], error: null };
    }
    if (name === "bty_foundry_list_my_apply_windows") {
      return {
        data: created
          .filter((r) => r.p_user_id_snapshot === args.p_auth_user_id)
          .map((r, i) => ({
            id: `w-${i}`,
            event_id: r.p_event_id,
            progress_id: r.p_progress_id,
            source_training_title: r.p_source_training_title,
            completion_bty_day: r.p_completion_bty_day,
            due_bty_day: r.p_due_bty_day,
            due_at: r.p_due_at,
          })),
        error: null,
      };
    }
    return { data: null, error: null };
  };
  return { admin: { from, rpc } as unknown as SupabaseClient, created, calls };
}

const EVENT = "ev-1";
const PROGRESS = "prog-1";
const USER = "user-1";
const DECISION = "Next time I will say the owner's name out loud before we break.";

function journey(withDecision: boolean) {
  const elements: Row[] = [
    { id: "el_observable_standard", kind: "observable_standard", content: "States the owner aloud.", confirmationStatus: "grounded" },
  ];
  if (withDecision) {
    elements.push({ id: "el_action_decision", kind: "action_decision", content: "Decide what you will say.", confirmationStatus: "grounded" });
  }
  return { version: 1, displayTitle: "Huddle ownership", displayTitleStatus: "grounded", elements };
}

function seed(o: { completed?: boolean; decision?: boolean; grounded?: boolean; assignment?: boolean } = {}): Tables {
  return {
    foundry_event_training_progress: [
      {
        id: PROGRESS,
        event_id: EVENT,
        completed_at: (o.completed ?? true) ? "2026-08-14T20:00:00Z" : null,
        decision_response_text: (o.decision ?? true) ? DECISION : null,
      },
    ],
    foundry_event_module: [
      { event_id: EVENT, module_snapshot: { realityGroundedJourneyV1: journey(o.grounded ?? true) } },
    ],
    foundry_events: [{ id: EVENT, title: "Huddle ownership" }],
    foundry_event_assignments: o.assignment
      ? [{ id: "as-1", event_id: EVENT, user_id_snapshot: USER, organization_id: "org-1" }]
      : [],
  };
}

const call = (admin: SupabaseClient, over: Record<string, unknown> = {}) =>
  materializeApplyWindow(admin, { eventId: EVENT, progressId: PROGRESS, authUserId: USER, ...over });

describe("R2 materialization matrix", () => {
  it("A — authenticated completion with a grounded decision creates exactly one window", async () => {
    const { admin, created } = makeFakeAdmin(seed());
    expect(await call(admin)).toBe("created");
    expect(created).toHaveLength(1);
    expect(created[0]!.p_completion_bty_day).toBe("2026-08-14");
    expect(created[0]!.p_due_bty_day).toBe("2026-08-21");
    expect(created[0]!.p_apply_days).toBe(7);
  });

  it("B — completion retry returns `exists` and creates no duplicate", async () => {
    const { admin, created } = makeFakeAdmin(seed());
    expect(await call(admin)).toBe("created");
    expect(await call(admin)).toBe("exists");
    expect(await call(admin)).toBe("exists");
    expect(created).toHaveLength(1);
  });

  it("C — XP retry (same completion path run again) creates no duplicate", async () => {
    const { admin, created } = makeFakeAdmin(seed());
    await call(admin);
    await call(admin); // the XP branch re-enters the same materialization
    expect(created).toHaveLength(1);
  });

  it("D — anonymous completion creates NOTHING and does not touch the RPC", async () => {
    const { admin, created, calls } = makeFakeAdmin(seed());
    expect(await call(admin, { authUserId: null })).toBe("skipped");
    expect(created).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("E — a later claim uses the ORIGINAL completion day, never the claim date", async () => {
    /*
      The property that makes the claim path honest. A learner who completes on the 14th and
      authenticates on the 20th must not be handed a fresh seven days starting the 20th — the
      window belongs to the day they decided.
    */
    const { admin, created } = makeFakeAdmin(seed());
    expect(await call(admin, { completedAtIso: null })).toBe("created"); // falls back to the stored instant
    expect(created[0]!.p_completion_bty_day).toBe("2026-08-14");
    expect(created[0]!.p_due_bty_day).toBe("2026-08-21");
  });

  it("F — claim retry creates no duplicate", async () => {
    const { admin, created } = makeFakeAdmin(seed());
    await call(admin, { completedAtIso: null });
    await call(admin, { completedAtIso: null });
    expect(created).toHaveLength(1);
  });

  it("G — a training with NO grounded action_decision creates no window", async () => {
    const { admin, created, calls } = makeFakeAdmin(seed({ grounded: false }));
    expect(await call(admin)).toBe("skipped");
    expect(created).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("G′ — a training with no frozen journey at all creates no window (every legacy row)", async () => {
    const t = seed();
    t.foundry_event_module = [];
    const { admin, created } = makeFakeAdmin(t);
    expect(await call(admin)).toBe("skipped");
    expect(created).toHaveLength(0);
  });

  it("H — a grounded prompt with NO recorded decision creates no window", async () => {
    const { admin, created } = makeFakeAdmin(seed({ decision: false }));
    expect(await call(admin)).toBe("skipped");
    expect(created).toHaveLength(0);
  });

  it("H′ — a whitespace-only decision is not a decision", async () => {
    const t = seed();
    (t.foundry_event_training_progress![0] as Row).decision_response_text = "   \n  ";
    const { admin, created } = makeFakeAdmin(t);
    expect(await call(admin)).toBe("skipped");
    expect(created).toHaveLength(0);
  });

  it("H″ — an INCOMPLETE training creates no window, whatever else is present", async () => {
    const { admin, created } = makeFakeAdmin(seed({ completed: false }));
    expect(await call(admin)).toBe("skipped");
    expect(created).toHaveLength(0);
  });

  it("I — an RPC failure returns `error` and THROWS NOTHING (completion stays truthful)", async () => {
    const { admin } = makeFakeAdmin(seed(), { rpcError: true });
    await expect(call(admin)).resolves.toBe("error");
  });

  it("I′ — a MISSING TABLE (before the migration is applied) degrades to `error`, never a throw", async () => {
    /*
      The deploy-order property. Code ships before the Founder applies the DDL, so every path here
      must survive `relation does not exist` — the learner still completes, and simply has no
      window until the migration lands.
    */
    const t = seed();
    const { admin } = makeFakeAdmin(t);
    const broken = { ...admin, rpc: async () => { throw new Error('relation "…" does not exist'); } } as unknown as SupabaseClient;
    await expect(call(broken)).resolves.toBe("error");
  });

  it("carries assignment + organization lineage when present, and tolerates their absence", async () => {
    const withA = makeFakeAdmin(seed({ assignment: true }));
    await call(withA.admin);
    expect(withA.created[0]!.p_assignment_id).toBe("as-1");
    expect(withA.created[0]!.p_organization_id).toBe("org-1");

    const withoutA = makeFakeAdmin(seed({ assignment: false }));
    await call(withoutA.admin);
    expect(withoutA.created[0]!.p_assignment_id).toBeNull();
  });

  it("snapshots the training title and the timezone, and NO learner-authored text", async () => {
    const { admin, created } = makeFakeAdmin(seed());
    await call(admin);
    const row = created[0]!;
    expect(row.p_source_training_title).toBe("Huddle ownership");
    expect(row.p_timezone_snapshot).toBe(LA);
    // The decision sentence must NOT be written into the obligation table.
    expect(JSON.stringify(row)).not.toContain(DECISION);
  });
});

describe("R2 owner-scoped read", () => {
  it("returns the caller's own windows with a derived state and no learner text", async () => {
    const { admin } = makeFakeAdmin(seed());
    await call(admin);
    const rows = await listMyApplyWindows(admin, USER, new Date("2026-08-17T20:00:00Z"), LA);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe("active");
    expect(JSON.stringify(rows)).not.toContain(DECISION);
  });

  it("a stranger reads nothing", async () => {
    const { admin } = makeFakeAdmin(seed());
    await call(admin);
    expect(await listMyApplyWindows(admin, "user-2", new Date("2026-08-17T20:00:00Z"), LA)).toEqual([]);
  });

  it("state is derived per read — the same row reads differently on different days", async () => {
    const { admin } = makeFakeAdmin(seed());
    await call(admin);
    const on = async (iso: string) => (await listMyApplyWindows(admin, USER, new Date(iso), LA))[0]!.state;
    expect(await on("2026-08-14T20:00:00Z")).toBe("active");
    expect(await on("2026-08-21T20:00:00Z")).toBe("due_today");
    expect(await on("2026-08-25T20:00:00Z")).toBe("overdue");
  });

  it("a read failure is fail-soft", async () => {
    const broken = { from: () => { throw new Error("x"); }, rpc: async () => { throw new Error("x"); } } as unknown as SupabaseClient;
    expect(await listMyApplyWindows(broken, USER, new Date(), LA)).toEqual([]);
  });
});

describe("R2.6 — the title snapshot survives the read", () => {
  /*
    MEASURED on the live row: window `6435c742` stored `source_training_title = "Foundry training"`
    while the follow-up row materialized one second earlier — same completion, same event — stored
    "Establishing Action Ownership in Huddles". One statement asked for a column that does not
    exist, and a fail-soft path turned that into a wrong title and a null organization instead of
    an error anyone could see.
  */
  it("stores the REAL event title, never the fallback", async () => {
    const { admin, created } = makeFakeAdmin(seed({ assignment: true }));
    expect(await call(admin)).toBe("created");
    expect(created[0]!.p_source_training_title).toBe("Huddle ownership");
    expect(created[0]!.p_source_training_title).not.toBe("Foundry training");
  });

  it("reads ONLY columns that exist on foundry_events", async () => {
    /* The fixture now answers an unknown column the way PostgREST does: with nothing at all. */
    const { admin } = makeFakeAdmin(seed({ assignment: true }));
    const asked: string[] = [];
    const spied = {
      ...admin,
      from: (t: string) => {
        const q = (admin as unknown as { from: (t: string) => Record<string, unknown> }).from(t);
        const sel = q.select as (c?: string) => unknown;
        q.select = function (c?: string) { if (t === "foundry_events" && c) asked.push(c); return sel.call(this, c); };
        return q;
      },
    } as unknown as SupabaseClient;
    await materializeApplyWindow(spied, { eventId: EVENT, progressId: PROGRESS, authUserId: USER });
    expect(asked).toHaveLength(1);
    expect(asked[0]).not.toContain("organization_id");
  });

  it("the organization comes from the ASSIGNMENT — the only row that has one", async () => {
    const { admin, created } = makeFakeAdmin(seed({ assignment: true }));
    await call(admin);
    expect(created[0]!.p_organization_id).toBe("org-1");
  });

  it("open-link learning has no assignment, so no organization — and still a real title", async () => {
    const { admin, created } = makeFakeAdmin(seed({ assignment: false }));
    await call(admin);
    expect(created[0]!.p_organization_id).toBeNull();
    expect(created[0]!.p_assignment_id).toBeNull();
    expect(created[0]!.p_source_training_title).toBe("Huddle ownership");
  });

  it("an untitled event still satisfies the CHECK domain", async () => {
    const t = seed({ assignment: true });
    t.foundry_events = [{ id: EVENT, title: "   " }];
    const { admin, created } = makeFakeAdmin(t);
    await call(admin);
    expect(created[0]!.p_source_training_title).toBe("Foundry training");
  });
});
