import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeDueDelayedOutcomeTriggersForUser } from "./delayed-outcome-consumer.service";

type QueueRow = {
  id: string;
  user_id: string;
  trigger_type: string;
  status: "pending" | "processing" | "processed";
  due_at: string | null;
  payload: Record<string, unknown>;
  processed_at: string | null;
};

function makeQueueClient(seed: QueueRow[]): SupabaseClient {
  const queue = [...seed];

  function buildSelectQuery() {
    const filters: Record<string, unknown> = {};
    let dueLte: string | null = null;
    let take = 100;

    return {
      eq(col: string, value: unknown) {
        filters[col] = value;
        return this;
      },
      lte(col: string, value: string) {
        if (col === "due_at") dueLte = value;
        return this;
      },
      order() {
        return this;
      },
      async limit(n: number) {
        take = n;
        const out = queue
          .filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
          .filter((r) => (dueLte == null ? true : (r.due_at ?? "9999-12-31T00:00:00.000Z") <= dueLte))
          .slice(0, take)
          .map((r) => ({ id: r.id, due_at: r.due_at, payload: r.payload }));
        return { data: out, error: null };
      },
    };
  }

  function buildUpdateQuery(patch: Record<string, unknown>) {
    const filters: Record<string, unknown> = {};
    return {
      eq(col: string, value: unknown) {
        filters[col] = value;
        return this;
      },
      select() {
        return this;
      },
      async maybeSingle() {
        const row = queue.find((r) =>
          Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
        );
        if (!row) return { data: null, error: null };
        Object.assign(row, patch);
        return { data: { id: row.id }, error: null };
      },
      then(onFulfilled: (v: { error: null }) => unknown) {
        const row = queue.find((r) =>
          Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
        );
        if (row) Object.assign(row, patch);
        return Promise.resolve(onFulfilled({ error: null }));
      },
    };
  }

  return {
    from(table: string) {
      if (table !== "user_memory_trigger_queue") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return buildSelectQuery();
        },
        update(patch: Record<string, unknown>) {
          return buildUpdateQuery(patch);
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("delayed-outcome-consumer.service", () => {
  it("consumes due delayed_outcome rows: pending -> processed", async () => {
    const client = makeQueueClient([
      {
        id: "q1",
        user_id: "u1",
        trigger_type: "delayed_outcome",
        status: "pending",
        due_at: "2026-01-01T00:00:00.000Z",
        payload: { pending_outcome_id: "po1" },
        processed_at: null,
      },
    ]);

    const out = await consumeDueDelayedOutcomeTriggersForUser({
      userId: "u1",
      now: new Date("2026-01-02T00:00:00.000Z"),
      supabase: client,
    });

    expect(out.consumedCount).toBe(1);
    expect(out.firstTriggerId).toBe("q1");
    expect(out.triggers[0]?.payload.pending_outcome_id).toBe("po1");
  });

  it("does not consume future-scheduled rows", async () => {
    const client = makeQueueClient([
      {
        id: "q2",
        user_id: "u1",
        trigger_type: "delayed_outcome",
        status: "pending",
        due_at: "2026-02-01T00:00:00.000Z",
        payload: {},
        processed_at: null,
      },
    ]);

    const out = await consumeDueDelayedOutcomeTriggersForUser({
      userId: "u1",
      now: new Date("2026-01-02T00:00:00.000Z"),
      supabase: client,
    });

    expect(out.consumedCount).toBe(0);
    expect(out.firstTriggerId).toBeNull();
  });

  it("does not touch memory_pattern_threshold rows", async () => {
    const client = makeQueueClient([
      {
        id: "q3",
        user_id: "u1",
        trigger_type: "memory_pattern_threshold",
        status: "pending",
        due_at: "2026-01-01T00:00:00.000Z",
        payload: {},
        processed_at: null,
      },
    ]);

    const out = await consumeDueDelayedOutcomeTriggersForUser({
      userId: "u1",
      now: new Date("2026-01-02T00:00:00.000Z"),
      supabase: client,
    });

    expect(out.consumedCount).toBe(0);
    expect(out.firstTriggerId).toBeNull();
  });
});
