import { describe, it, expect } from "vitest";
import {
  DELAYED_OUTCOME_TEMPLATES,
  pickDelayedOutcomeTemplate,
  scheduleOutcomes,
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
