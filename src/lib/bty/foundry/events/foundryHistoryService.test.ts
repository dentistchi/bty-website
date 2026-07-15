import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listUserFoundryHistory, toThreadRecords } from "./foundryHistoryService";

const AI_REFLECTION = {
  whatEmerged: "You named the cost of staying silent.",
  whereYouStretched: "There is a pull between calm and honesty here.",
  livingSentence: "Naming the hard thing is its own quiet courage.",
  nextInvitation: "What would honesty ask of the room now?",
};

type Calls = { eq: [string, unknown][]; not: [string, string, unknown][]; order: [string, unknown][] };

function makeAdmin(progressRows: unknown[], eventRows: unknown[], calls: Calls): SupabaseClient {
  const state = { table: "" };
  const builder = {
    from(t: string) {
      state.table = t;
      return builder;
    },
    select() {
      return builder;
    },
    eq(col: string, val: unknown) {
      calls.eq.push([col, val]);
      return builder;
    },
    not(col: string, op: string, val: unknown) {
      calls.not.push([col, op, val]);
      return builder;
    },
    in() {
      return builder;
    },
    order(col: string, opts: unknown) {
      calls.order.push([col, opts]);
      return builder;
    },
    returns() {
      return builder;
    },
    then(resolve: (v: { data: unknown }) => void, reject: (e: unknown) => void) {
      const data = state.table === "foundry_events" ? eventRows : progressRows;
      return Promise.resolve({ data }).then(resolve, reject);
    },
  };
  return builder as unknown as SupabaseClient;
}

const PROGRESS = [
  {
    event_id: "e2",
    completed_at: "2026-05-21T10:00:00Z",
    response_text: "The delay is now costing the team clarity.",
    reflection: AI_REFLECTION,
    completion_state: "pass",
  },
  {
    event_id: "e1",
    completed_at: "2026-05-01T10:00:00Z",
    response_text: "I delayed the conversation with my manager.",
    reflection: null, // no AI reflection produced
    completion_state: "review",
  },
];
const EVENTS = [
  { id: "e1", title: "First training" },
  { id: "e2", title: "Second training" },
];

function emptyCalls(): Calls {
  return { eq: [], not: [], order: [] };
}

describe("listUserFoundryHistory", () => {
  it("scopes to the current user and only completed rows", async () => {
    const calls = emptyCalls();
    await listUserFoundryHistory(makeAdmin(PROGRESS, EVENTS, calls), "user-42");
    expect(calls.eq).toContainEqual(["linked_user_id", "user-42"]);
    expect(calls.not).toContainEqual(["completed_at", "is", null]);
  });

  it("orders newest-first and preserves that order", async () => {
    const calls = emptyCalls();
    const items = await listUserFoundryHistory(makeAdmin(PROGRESS, EVENTS, calls), "user-42");
    expect(calls.order).toContainEqual(["completed_at", { ascending: false }]);
    expect(items.map((i) => i.eventId)).toEqual(["e2", "e1"]);
  });

  it("attaches event titles and a short response excerpt", async () => {
    const items = await listUserFoundryHistory(makeAdmin(PROGRESS, EVENTS, emptyCalls()), "u");
    expect(items[0].eventTitle).toBe("Second training");
    expect(items[1].eventTitle).toBe("First training");
    expect(items[0].responseExcerpt.length).toBeGreaterThan(0);
  });

  it("handles a row with no stored AI reflection", async () => {
    const items = await listUserFoundryHistory(makeAdmin(PROGRESS, EVENTS, emptyCalls()), "u");
    const e2 = items.find((i) => i.eventId === "e2")!;
    const e1 = items.find((i) => i.eventId === "e1")!;
    expect(e2.aiReflection).not.toBeNull();
    expect(e2.aiReflectionLine).toBe(AI_REFLECTION.livingSentence);
    expect(e1.aiReflection).toBeNull();
    expect(e1.aiReflectionLine).toBeNull();
  });

  it("returns [] for an empty user id (no query)", async () => {
    expect(await listUserFoundryHistory(makeAdmin(PROGRESS, EVENTS, emptyCalls()), "")).toEqual([]);
  });

  it("projects into pure thread records", async () => {
    const items = await listUserFoundryHistory(makeAdmin(PROGRESS, EVENTS, emptyCalls()), "u");
    const records = toThreadRecords(items);
    expect(records[0]).toMatchObject({ eventId: "e2", responseText: "The delay is now costing the team clarity." });
    expect(records[0]).not.toHaveProperty("responseExcerpt");
  });
});
