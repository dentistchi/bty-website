import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTrainingOutcome } from "./foundryTrainingOutcomeService";
import { summariseTrainingOutcome, type TrainingOutcomeFacts } from "@/domain/foundry/events/trainingOutcome";

/**
 * R4-R3B2 — THE HOST SENTENCE MUST BE DERIVED FROM THE FACT IT CLAIMS.
 *
 * The Outcome View decided "we can't follow up with them" from `progress.linked_user_id`. That is
 * a column about whether a progress row has been bound to an account; it is not the authority for
 * whether a follow-up can reach someone, and the audit proved the two disagree in production.
 *
 * Three completions carry `linked_user_id = null` while a `foundry_participant_followups` row for
 * the same progress carries a `user_id_snapshot`:
 *
 *   f4e6ea32  document          follow-up + apply window, both with a user
 *   1ca75ade  youtube           follow-up created 2.18 days after completion
 *   2ea834ab  document          follow-up created 12.4 minutes after completion
 *
 * For all three the product was telling a Host that a reachable learner could not be reached. The
 * obligation row IS the reachability — it is what the learner's own surface reads and what
 * `bty_foundry_submit_followup` settles — so its existence, and nothing else, decides this.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: it does not diagnose. An unconnected completion may be an
 * account never linked or a claim that wrote its obligations and did not finish; the audit could
 * not separate those from durable data, so the copy states the count and stops.
 */

const OWNER = "owner-1";
const EVENT = "ev-1";

type Row = { id: string; completed: boolean; linked: boolean };
type Fu = { id: string; progressId: string | null; hasUser: boolean };

/**
 * A fake that models the TWO queries the service now issues against the obligation table: the full
 * read, and an id-only read filtered to rows whose `user_id_snapshot` is present. The filter is
 * honoured here exactly as PostgREST would, so a row without a user cannot leak into reachability.
 */
function admin(rows: Row[], followUps: Fu[], applyWindowProgressIds: string[] = []) {
  const captured: { table: string; selected: string; filtered: boolean }[] = [];
  const from = (table: string) => {
    let notNullFilter = false;
    let selected = "";
    const q: Record<string, unknown> = {
      select(cols: string) {
        selected = cols;
        captured.push({ table, selected: cols, filtered: false });
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return this;
      },
      not(col: string) {
        notNullFilter = true;
        captured[captured.length - 1]!.filtered = true;
        void col;
        return this;
      },
      maybeSingle() {
        const first: Record<string, unknown[]> = {
          foundry_events: [{ id: EVENT }],
          foundry_event_module: [{ module_snapshot: { followUpDays: 7 } }],
        };
        return Promise.resolve({ data: (first[table] ?? [])[0] ?? null, error: null });
      },
      returns() {
        if (table === "foundry_event_participants") {
          return Promise.resolve({ data: rows.map((r) => ({ id: r.id, status: "joined" })), error: null });
        }
        if (table === "foundry_event_training_progress") {
          return Promise.resolve({
            data: rows.map((r) => ({
              id: r.id,
              completed_at: r.completed ? "2026-08-15T12:30:35Z" : null,
              decision_response_text: null,
            })),
            error: null,
          });
        }
        if (table === "foundry_participant_followups") {
          const visible = notNullFilter ? followUps.filter((f) => f.hasUser) : followUps;
          return Promise.resolve({
            data: visible.map((f) =>
              selected === "progress_id"
                ? { progress_id: f.progressId }
                : { id: f.id, progress_id: f.progressId, status: "PENDING", outcome: null, due_at: "2026-08-22T05:00:00Z" },
            ),
            error: null,
          });
        }
        if (table === "foundry_behavior_observations") return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      },
    };
    void applyWindowProgressIds;
    return q;
  };
  return { client: { from } as unknown as SupabaseClient, captured };
}

const NOW = new Date("2026-08-19T12:00:00Z");
const TZ = "America/Los_Angeles";
const read = (rows: Row[], fus: Fu[]) => getTrainingOutcome(admin(rows, fus).client, OWNER, EVENT, NOW, TZ);

describe("R4-R3B2 · 1/4 · the obligation decides reachability, not the progress column", () => {
  it("1 — linked NULL + follow-up present → reachable, and NEVER counted as unconnected", async () => {
    const out = await read([{ id: "p1", completed: true, linked: false }], [{ id: "f1", progressId: "p1", hasUser: true }]);
    expect(out?.participation.followUpReachable).toBe(1);
    expect(out?.participation.followUpNotConnected).toBe(0);
  });

  it("3 — linked PRESENT but no follow-up → NOT follow-up reachable", async () => {
    const out = await read([{ id: "p1", completed: true, linked: true }], []);
    expect(out?.participation.followUpReachable).toBe(0);
    expect(out?.participation.followUpNotConnected).toBe(1);
  });

  it("4 — a follow-up whose user_id_snapshot is absent does NOT make a completion reachable", async () => {
    const out = await read([{ id: "p1", completed: true, linked: false }], [{ id: "f1", progressId: "p1", hasUser: false }]);
    expect(out?.participation.followUpReachable).toBe(0);
    expect(out?.participation.followUpNotConnected).toBe(1);
    // The obligation still counts toward the follow-up evidence table — only reachability is denied.
    expect(out?.followUp.total).toBe(1);
  });

  it("5 — a clean anonymous completion with no obligation is simply not connected", async () => {
    const out = await read([{ id: "p1", completed: true, linked: false }], []);
    expect(out?.participation.followUpReachable).toBe(0);
    expect(out?.participation.followUpNotConnected).toBe(1);
    expect(out?.reading).toBe("awaiting_connection");
  });

  it("6 — a mixed population aggregates on the obligation, not on the account column", async () => {
    const out = await read(
      [
        { id: "p1", completed: true, linked: true },   // linked, reachable
        { id: "p2", completed: true, linked: false },  // NOT linked, still reachable
        { id: "p3", completed: true, linked: true },   // linked, no obligation
        { id: "p4", completed: true, linked: false },  // neither
        { id: "p5", completed: false, linked: false }, // never finished
      ],
      [
        { id: "f1", progressId: "p1", hasUser: true },
        { id: "f2", progressId: "p2", hasUser: true },
      ],
    );
    expect(out?.participation.completed).toBe(4);
    expect(out?.participation.followUpReachable).toBe(2);
    expect(out?.participation.followUpNotConnected).toBe(2);
  });

  it("an orphaned obligation (progress_id nulled) cannot inflate reachability", async () => {
    const out = await read([{ id: "p1", completed: true, linked: false }], [{ id: "f1", progressId: null, hasUser: true }]);
    expect(out?.participation.followUpReachable).toBe(0);
  });
});

describe("R4-R3B2 · 2 · an apply window is not a follow-up", () => {
  /*
    `f4e6ea32` carries BOTH obligations. They are separate capabilities with separate gates, and
    the Host statement here is about the follow-up — so the apply window must not answer for it.
  */
  it("apply-window reachability is never consulted for the follow-up count", async () => {
    const { client, captured } = admin(
      [{ id: "p1", completed: true, linked: false }],
      [],
      ["p1"], // an apply window exists for this progress
    );
    const out = await getTrainingOutcome(client, OWNER, EVENT, NOW, TZ);
    expect(out?.participation.followUpReachable).toBe(0);
    expect(out?.participation.followUpNotConnected).toBe(1);
    // Proven structurally: the service never reads the apply-window table at all.
    expect(captured.map((c) => c.table)).not.toContain("foundry_participant_apply_windows");
  });
});

describe("R4-R3B2 · 7/8/9 · the three production rows stop being misclassified", () => {
  /* Each fixture is the measured production shape: linked NULL, obligation present with a user. */
  const CASES = [
    { name: "f4e6ea32 — document, follow-up + apply window", progress: "f4e6ea32" },
    { name: "1ca75ade — youtube, follow-up 2.18 days later", progress: "1ca75ade" },
    { name: "2ea834ab — document, follow-up 12.4 min later", progress: "2ea834ab" },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const out = await read(
        [{ id: c.progress, completed: true, linked: false }],
        [{ id: `fu-${c.progress}`, progressId: c.progress, hasUser: true }],
      );
      expect(out?.participation.followUpReachable).toBe(1);
      expect(out?.participation.followUpNotConnected).toBe(0);
      // The reading must not be the "nothing connected" branch for a reachable learner.
      expect(out?.reading).not.toBe("awaiting_connection");
    });
  }
});

describe("R4-R3B2 · 12/13 · privacy and write surface unchanged", () => {
  const rows: Row[] = [{ id: "p1", completed: true, linked: true }];
  const fus: Fu[] = [{ id: "f1", progressId: "p1", hasUser: true }];

  it("12 — no learner or observer identifier is named in any query, and none reaches the payload", async () => {
    const { client, captured } = admin(rows, fus);
    const out = await getTrainingOutcome(client, OWNER, EVENT, NOW, TZ);
    for (const c of captured) {
      for (const forbidden of ["user_id_snapshot", "linked_user_id", "observer_user_id", "response_text", "learner_reflection_text"]) {
        // `decision_response_text` is the one authorised field and must not trip on `response_text`.
        const bare = new RegExp(`(^|[\\s,])${forbidden}([\\s,]|$)`);
        expect(c.selected, `${c.table} selected ${c.selected}`).not.toMatch(bare);
      }
      expect(c.selected).not.toBe("*");
    }
    const json = JSON.stringify(out);
    for (const k of ["user_id_snapshot", "linked_user_id", "observer_user_id", "participant_id", "progress_id"]) {
      expect(json).not.toContain(k);
    }
  });

  it("`user_id_snapshot` is used as a FILTER, never selected", async () => {
    const { client, captured } = admin(rows, fus);
    await getTrainingOutcome(client, OWNER, EVENT, NOW, TZ);
    const idOnly = captured.filter((c) => c.table === "foundry_participant_followups" && c.selected === "progress_id");
    expect(idOnly).toHaveLength(1);
    expect(idOnly[0]!.filtered).toBe(true);
  });

  it("13 — the reachability read issues no insert, update, upsert, delete or rpc", async () => {
    const touched: string[] = [];
    const { client } = admin(rows, fus);
    const base = client as unknown as Record<string, unknown>;
    const realFrom = base.from as (t: string) => Record<string, unknown>;
    base.from = (t: string) => {
      const q = realFrom(t);
      for (const m of ["insert", "update", "upsert", "delete"]) {
        q[m] = () => {
          touched.push(`${t}.${m}`);
          return q;
        };
      }
      return q;
    };
    base.rpc = () => {
      touched.push("rpc");
      return Promise.resolve({ data: null, error: null });
    };
    await getTrainingOutcome(client, OWNER, EVENT, NOW, TZ);
    expect(touched).toEqual([]);
  });
});

describe("R4-R3B2 · not-connected is only meaningful when a checkpoint exists", () => {
  const facts = (over: Partial<TrainingOutcomeFacts> = {}): TrainingOutcomeFacts => ({
    joined: 5, completed: 4, followUpReachableCompletions: 0, decisionCount: 0,
    followUps: [], observations: [], followUpDays: 7, applicationJourney: "none", ...over,
  });

  it("with no checkpoint there is nothing to connect to, so the shortfall is zero", () => {
    const s = summariseTrainingOutcome(facts({ followUpDays: null }), NOW, TZ);
    expect(s.participation.followUpNotConnected).toBe(0);
    expect(s.reading).toBe("ends_at_completion");
  });

  it("reachability can never exceed the completions it is counted from", () => {
    const s = summariseTrainingOutcome(facts({ completed: 2, followUpReachableCompletions: 9 }), NOW, TZ);
    expect(s.participation.followUpReachable).toBe(2);
    expect(s.participation.followUpNotConnected).toBe(0);
  });
});
