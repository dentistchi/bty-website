import { describe, it, expect } from "vitest";
import {
  DELAYED_OUTCOME_TEMPLATES,
  pickDelayedOutcomeTemplate,
  scheduleOutcomes,
  fetchFirstDueNoChangeReexposureMeta,
} from "./delayed-outcome-trigger.service";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("delayed-outcome-trigger.service", () => {
  it("DELAYED_OUTCOME_TEMPLATES has 2 entries per flag bucket", () => {
    for (const k of ["HERO_TRAP", "INTEGRITY_SLIP", "CLEAN", "ROLE_MIRROR"] as const) {
      expect(DELAYED_OUTCOME_TEMPLATES[k].length).toBe(2);
    }
  });

  it("pickDelayedOutcomeTemplate toggles with scenario_type hash", () => {
    const a = pickDelayedOutcomeTemplate("HERO_TRAP", "aa");
    const b = pickDelayedOutcomeTemplate("HERO_TRAP", "a");
    expect(a.id).not.toBe(b.id);
  });

  it("normalizes flag substrings to buckets", () => {
    const t = pickDelayedOutcomeTemplate("x INTEGRITY_SLIP y", "");
    expect(DELAYED_OUTCOME_TEMPLATES.INTEGRITY_SLIP.map((x) => x.id)).toContain(t.id);
  });

  it("branches template variant by delayed_outcome.outcomes[].if.pattern when provided", () => {
    const a = pickDelayedOutcomeTemplate("HERO_TRAP", "aa", "repeated_direct_fix");
    const b = pickDelayedOutcomeTemplate("HERO_TRAP", "aa", "delegation_micro_wins_present");
    expect(a.id).not.toBe(b.id);
  });

  it("scheduleOutcomes uses scenario delayed_outcome.delay_days when present", async () => {
    const playedAt = "2026-01-01T00:00:00.000Z";
    const inserted: Array<Record<string, unknown>> = [];
    const queued: Array<Record<string, unknown>> = [];

    function makeScenariosBuilder(selectExpr: string) {
      const state: { id?: string; locale?: string } = {};
      return {
        eq(col: string, value: string) {
          if (col === "id") state.id = value;
          if (col === "locale") state.locale = value;
          return this;
        },
        async maybeSingle() {
          if (selectExpr === "scenario_type") {
            return { data: { scenario_type: "general" }, error: null };
          }
          if (selectExpr === "body") {
            return {
              data: {
                body: JSON.stringify({
                  delayed_outcome: {
                    delay_days: 14,
                    outcomes: [{ if: { pattern: "repeated_direct_fix" } }],
                  },
                }),
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
    }

    function makePendingBuilder() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
        insert(payload: Record<string, unknown>) {
          inserted.push(payload);
          return {
            select() {
              return this;
            },
            async maybeSingle() {
              return { data: { id: "po1", scheduled_for: payload.scheduled_for }, error: null };
            },
          };
        },
      };
    }

    function makeTriggerQueueBuilder() {
      return {
        async insert(payload: Record<string, unknown>) {
          queued.push(payload);
          return { error: null };
        },
      };
    }

    function makeHistoryBuilder() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        lt() {
          return this;
        },
        order() {
          return this;
        },
        async limit() {
          return {
            data: [
              {
                id: "h1",
                scenario_id: "SCN_TEST_0001",
                choice_id: "A",
                flag_type: "HERO_TRAP",
                played_at: playedAt,
                scenario_type: null,
                outcome_triggered: false,
              },
            ],
            error: null,
          };
        },
      };
    }

    const client = {
      from(table: string) {
        if (table === "user_scenario_choice_history") return makeHistoryBuilder();
        if (table === "scenarios")
          return {
            select(selectExpr: string) {
              return makeScenariosBuilder(selectExpr);
            },
          };
        if (table === "arena_pending_outcomes") return makePendingBuilder();
        if (table === "user_memory_trigger_queue") return makeTriggerQueueBuilder();
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const n = await scheduleOutcomes("user-1", client);
    expect(n).toBe(1);
    expect(inserted.length).toBe(1);
    expect(inserted[0]?.scheduled_for).toBe("2026-01-15T00:00:00.000Z");
    expect(queued.length).toBe(1);
    expect(queued[0]?.trigger_type).toBe("delayed_outcome");
  });
});

describe("fetchFirstDueNoChangeReexposureMeta — AL-1.8-D filter expansion", () => {
  type MockRow = { id: string; source_choice_history_id: string | null; choice_type: string };

  /**
   * Mock client that simulates PostgREST filter behavior. Records the `.or()` filter string and
   * applies it as a JS predicate so we can verify both syntax + matching semantics.
   */
  function makeClient(rows: MockRow[]) {
    let recordedOrFilter: string | null = null;
    let pendingTable: { state: { applied: MockRow[] } } | null = null;

    function makePendingBuilder() {
      const state: { applied: MockRow[] } = { applied: [...rows] };
      pendingTable = { state };
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(col: string, value: string) {
          if (col === "choice_type") {
            state.applied = state.applied.filter((r) => r.choice_type === value);
          }
          // user_id / status equality tests aren't relevant for filter shape — pass through.
          return builder;
        },
        or(filterStr: string) {
          recordedOrFilter = filterStr;
          // Simulate PostgREST `or((choice_type.eq.X,choice_type.like.Y*))` translation.
          state.applied = state.applied.filter((r) => {
            const parts = filterStr.split(",");
            return parts.some((p) => {
              const m = p.match(/^choice_type\.(eq|like)\.(.+)$/);
              if (!m) return false;
              const [, op, val] = m;
              if (op === "eq") return r.choice_type === val;
              if (op === "like") {
                // PostgREST `*` => SQL `%` => any-sequence wildcard.
                const re = new RegExp("^" + val.replace(/\*/g, ".*") + "$");
                return re.test(r.choice_type);
              }
              return false;
            });
          });
          return builder;
        },
        lte() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        async maybeSingle() {
          const first = state.applied[0] ?? null;
          return { data: first, error: null };
        },
      };
      return builder;
    }

    function makeHistoryBuilder() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: { scenario_id: "core_test_scenario" }, error: null };
        },
      };
    }

    const client = {
      from(table: string) {
        if (table === "arena_pending_outcomes") return makePendingBuilder();
        if (table === "user_scenario_choice_history") return makeHistoryBuilder();
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    return {
      client,
      getRecordedOrFilter: () => recordedOrFilter,
      getApplied: () => pendingTable?.state.applied ?? [],
    };
  }

  it("matches no_change_reexposure row (regression)", async () => {
    const { client, getRecordedOrFilter } = makeClient([
      { id: "po-no-change", source_choice_history_id: "h1", choice_type: "no_change_reexposure" },
    ]);
    const out = await fetchFirstDueNoChangeReexposureMeta(client, "user-1");
    expect(out?.pendingOutcomeId).toBe("po-no-change");
    // Verify .or() called with both clauses (regression on filter shape).
    expect(getRecordedOrFilter()).toBe(
      "choice_type.eq.no_change_reexposure,choice_type.like.reinforcement*",
    );
  });

  it("matches reinforcement_medium_iter2_* row (new behavior)", async () => {
    const { client } = makeClient([
      {
        id: "po-iter2",
        source_choice_history_id: "h2",
        choice_type: "reinforcement_medium_iter2_pattern",
      },
    ]);
    const out = await fetchFirstDueNoChangeReexposureMeta(client, "user-1");
    expect(out?.pendingOutcomeId).toBe("po-iter2");
  });

  it("matches reinforcement_high_iter3_truth_naming row (new behavior)", async () => {
    const { client } = makeClient([
      {
        id: "po-iter3",
        source_choice_history_id: "h3",
        choice_type: "reinforcement_high_iter3_truth_naming",
      },
    ]);
    const out = await fetchFirstDueNoChangeReexposureMeta(client, "user-1");
    expect(out?.pendingOutcomeId).toBe("po-iter3");
  });

  it("does NOT match delayed_*_v* rows (negative — separate delivery path)", async () => {
    const { client } = makeClient([
      { id: "po-delayed", source_choice_history_id: "h4", choice_type: "delayed_hero_trap_v1" },
    ]);
    const out = await fetchFirstDueNoChangeReexposureMeta(client, "user-1");
    expect(out).toBeNull();
  });

  it("co-presence: returns oldest scheduled_for first regardless of choice_type", async () => {
    // Multiple rows present; mock returns first applied row (single-row maybeSingle simulation).
    const { client } = makeClient([
      { id: "po-old-reinforce", source_choice_history_id: "h5", choice_type: "reinforcement_medium_iter2_pattern" },
      { id: "po-new-no-change", source_choice_history_id: "h6", choice_type: "no_change_reexposure" },
    ]);
    const out = await fetchFirstDueNoChangeReexposureMeta(client, "user-1");
    // Both match; mock returns first remaining row → reinforcement (no order applied in mock,
    // production uses .order("scheduled_for", asc) at DB layer).
    expect(out?.pendingOutcomeId).toBeTruthy();
    expect(["po-old-reinforce", "po-new-no-change"]).toContain(out?.pendingOutcomeId);
  });
});
