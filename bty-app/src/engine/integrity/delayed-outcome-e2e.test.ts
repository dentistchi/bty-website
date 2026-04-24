import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleOutcomes } from "@/engine/scenario/delayed-outcome-trigger.service";
import { runArenaSessionNextCore } from "@/lib/bty/arena/arenaSessionNextCore";

const mockFetchBlocking = vi.fn();
const mockGetLeadershipEngineState = vi.fn();
const mockGetNextScenarioForSession = vi.fn();

vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  fetchBlockingArenaContractForSession: (...args: unknown[]) => mockFetchBlocking(...args),
}));

vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  getLeadershipEngineState: (...args: unknown[]) => mockGetLeadershipEngineState(...args),
}));

vi.mock("@/engine/integration/scenario-type-router", () => ({
  getNextScenarioForSession: (...args: unknown[]) => mockGetNextScenarioForSession(...args),
}));

type ChoiceHistoryRow = {
  id: string;
  user_id: string;
  scenario_id: string;
  choice_id: string;
  flag_type: string;
  played_at: string;
  scenario_type: string | null;
  outcome_triggered: boolean;
};

type PendingOutcomeRow = {
  id: string;
  user_id: string;
  source_choice_history_id: string | null;
  source_event_id: string | null;
  choice_type: string;
  outcome_title: string;
  outcome_body: string;
  status: "pending" | "consumed" | "cancelled";
  scheduled_for: string;
  consumed_at: string | null;
  delivered_at: string | null;
};

type TriggerQueueRow = {
  id: string;
  user_id: string;
  trigger_type: string;
  status: "pending" | "processing" | "processed";
  due_at: string | null;
  payload: Record<string, unknown>;
  processed_at: string | null;
};

type ScenariosRow = {
  id: string;
  locale: string;
  scenario_type: string;
  body: string;
};

function makeSupabaseForDelayedOutcomeE2E() {
  const choiceHistory: ChoiceHistoryRow[] = [
    {
      id: "h1",
      user_id: "u1",
      scenario_id: "SCN_E2E_0001",
      choice_id: "A",
      flag_type: "HERO_TRAP",
      played_at: "2026-01-01T00:00:00.000Z",
      scenario_type: "general",
      outcome_triggered: false,
    },
  ];
  const scenarios: ScenariosRow[] = [
    {
      id: "SCN_E2E_0001",
      locale: "en",
      scenario_type: "general",
      body: JSON.stringify({
        delayed_outcome: {
          delay_days: 14,
          outcomes: [{ if: { pattern: "repeated_direct_fix" } }],
        },
      }),
    },
  ];
  const arenaPendingOutcomes: PendingOutcomeRow[] = [];
  const triggerQueue: TriggerQueueRow[] = [];

  let pendingSeq = 1;
  let triggerSeq = 1;

  function queryRowsByFilters<T extends Record<string, unknown>>(
    rows: T[],
    filters: Array<{ op: "eq" | "lte"; col: string; value: unknown }>,
  ): T[] {
    return rows.filter((r) =>
      filters.every((f) => {
        const val = r[f.col];
        if (f.op === "eq") return val === f.value;
        if (f.op === "lte") {
          if (typeof val !== "string" || typeof f.value !== "string") return false;
          return val <= f.value;
        }
        return false;
      }),
    );
  }

  function makeSelectBuilder(table: string, rows: Record<string, unknown>[]) {
    const filters: Array<{ op: "eq" | "lte"; col: string; value: unknown }> = [];
    let _limit = 1000;
    let _orderCol = "";
    let _ascending = true;
    return {
      eq(col: string, value: unknown) {
        filters.push({ op: "eq", col, value });
        return this;
      },
      lt(col: string, value: unknown) {
        // scheduleOutcomes uses lt on played_at; use same compare as lte with strict behavior.
        filters.push({ op: "lte", col, value });
        return this;
      },
      lte(col: string, value: unknown) {
        filters.push({ op: "lte", col, value });
        return this;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        _orderCol = col;
        _ascending = opts?.ascending ?? true;
        return this;
      },
      limit(n: number) {
        _limit = n;
        return this;
      },
      async maybeSingle() {
        const out = queryRowsByFilters(rows, filters);
        return { data: out[0] ?? null, error: null };
      },
      then(onFulfilled: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
        let out = queryRowsByFilters(rows, filters);
        if (_orderCol) {
          out = [...out].sort((a, b) => {
            const av = String(a[_orderCol] ?? "");
            const bv = String(b[_orderCol] ?? "");
            const cmp = av.localeCompare(bv);
            return _ascending ? cmp : -cmp;
          });
        }
        return Promise.resolve(onFulfilled({ data: out.slice(0, _limit), error: null }));
      },
    };
  }

  function makeUpdateBuilder(rows: Record<string, unknown>[], patch: Record<string, unknown>) {
    const filters: Array<{ op: "eq" | "lte"; col: string; value: unknown }> = [];
    return {
      eq(col: string, value: unknown) {
        filters.push({ op: "eq", col, value });
        return this;
      },
      lte(col: string, value: unknown) {
        filters.push({ op: "lte", col, value });
        return this;
      },
      select() {
        return this;
      },
      async maybeSingle() {
        const out = queryRowsByFilters(rows, filters);
        const row = out[0];
        if (!row) return { data: null, error: null };
        Object.assign(row, patch);
        return { data: row, error: null };
      },
      then(onFulfilled: (value: { error: null }) => unknown) {
        const out = queryRowsByFilters(rows, filters);
        for (const row of out) Object.assign(row, patch);
        return Promise.resolve(onFulfilled({ error: null }));
      },
    };
  }

  const supabase = {
    from(table: string) {
      if (table === "user_scenario_choice_history") {
        return {
          select() {
            return makeSelectBuilder(table, choiceHistory as unknown as Record<string, unknown>[]);
          },
          update(patch: Record<string, unknown>) {
            return makeUpdateBuilder(choiceHistory as unknown as Record<string, unknown>[], patch);
          },
        };
      }
      if (table === "scenarios") {
        return {
          select() {
            return makeSelectBuilder(table, scenarios as unknown as Record<string, unknown>[]);
          },
        };
      }
      if (table === "arena_pending_outcomes") {
        return {
          select() {
            return makeSelectBuilder(table, arenaPendingOutcomes as unknown as Record<string, unknown>[]);
          },
          insert(payload: Record<string, unknown>) {
            const row: PendingOutcomeRow = {
              id: `po${pendingSeq++}`,
              user_id: String(payload.user_id),
              source_choice_history_id:
                typeof payload.source_choice_history_id === "string"
                  ? payload.source_choice_history_id
                  : null,
              source_event_id: null,
              choice_type: String(payload.choice_type),
              outcome_title: String(payload.outcome_title),
              outcome_body: String(payload.outcome_body),
              status: "pending",
              scheduled_for: String(payload.scheduled_for),
              consumed_at: null,
              delivered_at: null,
            };
            arenaPendingOutcomes.push(row);
            return {
              select() {
                return this;
              },
              async maybeSingle() {
                return { data: { id: row.id, scheduled_for: row.scheduled_for }, error: null };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return makeUpdateBuilder(arenaPendingOutcomes as unknown as Record<string, unknown>[], patch);
          },
        };
      }
      if (table === "user_memory_trigger_queue") {
        return {
          select() {
            return makeSelectBuilder(table, triggerQueue as unknown as Record<string, unknown>[]);
          },
          insert(payload: Record<string, unknown>) {
            const row: TriggerQueueRow = {
              id: `tq${triggerSeq++}`,
              user_id: String(payload.user_id),
              trigger_type: String(payload.trigger_type),
              status: "pending",
              due_at: typeof payload.due_at === "string" ? payload.due_at : null,
              payload:
                payload.payload != null && typeof payload.payload === "object"
                  ? (payload.payload as Record<string, unknown>)
                  : {},
              processed_at: null,
            };
            triggerQueue.push(row);
            return Promise.resolve({ error: null });
          },
          update(patch: Record<string, unknown>) {
            return makeUpdateBuilder(triggerQueue as unknown as Record<string, unknown>[], patch);
          },
        };
      }
      if (table === "bty_action_contracts") {
        return {
          update() {
            return {
              eq() {
                return this;
              },
              lte() {
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      }
      if (table === "arena_runs") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return { supabase, arenaPendingOutcomes, triggerQueue };
}

describe("delayed outcome e2e", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBlocking.mockResolvedValue(null);
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      forcedResetTriggeredAt: null,
    });
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "SCN_NEXT", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: false,
    });
  });

  it("schedules, enqueues, consumes once, and stays idempotent on retry", async () => {
    const { supabase, arenaPendingOutcomes, triggerQueue } = makeSupabaseForDelayedOutcomeE2E();

    const scheduled = await scheduleOutcomes("u1", supabase);
    expect(scheduled).toBe(1);
    expect(arenaPendingOutcomes.length).toBe(1);
    expect(triggerQueue.length).toBe(1);
    expect(triggerQueue[0]?.trigger_type).toBe("delayed_outcome");

    // Force due for consumer.
    triggerQueue[0]!.due_at = "2026-01-02T00:00:00.000Z";

    const first = await runArenaSessionNextCore({
      userId: "u1",
      locale: "en",
      supabase,
      runIdParam: null,
      logHandlerLabel: "GET /api/arena/session/next",
    });
    expect(first.status).toBe(200);
    expect(first.body.delayedOutcomePending).toBe(true);
    expect(first.body.runtime_state).toBe("REEXPOSURE_DUE");
    const reExposure = first.body.re_exposure as Record<string, unknown>;
    expect(reExposure.trigger_id).toBe("tq1");
    expect(reExposure.trigger_payload).toEqual(
      expect.objectContaining({
        pending_outcome_id: "po1",
      }),
    );

    expect(triggerQueue[0]?.status).toBe("processed");

    // Retry does not re-consume processed trigger.
    const second = await runArenaSessionNextCore({
      userId: "u1",
      locale: "en",
      supabase,
      runIdParam: null,
      logHandlerLabel: "GET /api/arena/session/next",
    });
    expect(second.status).toBe(200);
    expect(second.body.delayedOutcomePending).toBe(false);
    expect(second.body.runtime_state).toBe("ARENA_SCENARIO_READY");
  });
});
