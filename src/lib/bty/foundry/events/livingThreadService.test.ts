import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoundryHistoryRecord } from "@/domain/foundry/living-thread";

const llm = { available: true, content: "", throws: false };
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => llm.available,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async () => {
          if (llm.throws) throw new Error("down");
          return { choices: [{ message: { content: llm.content } }] };
        },
      },
    },
  }),
}));

import { getOrGenerateLivingThread } from "./livingThreadService";

const RECORDS: FoundryHistoryRecord[] = [
  { eventId: "e1", eventTitle: "T1", completedAt: "2026-05-01T10:00:00Z", responseText: "I delayed the conversation with my manager.", aiReflectionLine: null, completionState: "pass" },
  { eventId: "e2", eventTitle: "T2", completedAt: "2026-05-10T10:00:00Z", responseText: "I told myself I was protecting the team.", aiReflectionLine: null, completionState: "pass" },
  { eventId: "e3", eventTitle: "T3", completedAt: "2026-05-21T10:00:00Z", responseText: "The delay is now costing the team clarity.", aiReflectionLine: null, completionState: "pass" },
];

const VALID_THREAD = JSON.stringify({
  thread: "Across these three reflections, responsibility appears when delay begins to reach the team.",
  supportingMoments: [
    { eventId: "e1", excerpt: "I delayed the conversation with my manager." },
    { eventId: "e3", excerpt: "The delay is now costing the team clarity." },
  ],
  nextQuestion: "Where does responsibility become action before the cost reaches the team?",
});

// In-memory foundry_living_thread store keyed by user|fingerprint (upsert-ignore).
let store: Map<string, { thread: unknown }>;
let insertCount: number;

function makeAdmin(): SupabaseClient {
  const state = { user: "", fp: "" };
  const api = {
    from() {
      state.user = "";
      state.fp = "";
      return api;
    },
    select() {
      return api;
    },
    eq(col: string, val: string) {
      if (col === "user_id") state.user = val;
      if (col === "evidence_fingerprint") state.fp = val;
      return api;
    },
    maybeSingle: async () => ({ data: store.get(`${state.user}|${state.fp}`) ?? null }),
    upsert: async (row: Record<string, unknown>) => {
      const key = `${row.user_id}|${row.evidence_fingerprint}`;
      if (!store.has(key)) {
        store.set(key, { thread: row.thread });
        insertCount += 1;
      }
      return { error: null };
    },
  };
  return api as unknown as SupabaseClient;
}

beforeEach(() => {
  store = new Map();
  insertCount = 0;
  llm.available = true;
  llm.throws = false;
  llm.content = VALID_THREAD;
});

describe("getOrGenerateLivingThread — eligibility gating", () => {
  it("2 records → status 'two', no thread, no write", async () => {
    const r = await getOrGenerateLivingThread(makeAdmin(), "u1", RECORDS.slice(0, 2));
    expect(r.status).toBe("two");
    expect(r.thread).toBeNull();
    expect(insertCount).toBe(0);
  });

  it("3 records within <14 days → 'gathering', no thread", async () => {
    const near = RECORDS.map((r, i) => ({ ...r, completedAt: `2026-05-0${i + 1}T10:00:00Z` }));
    const r = await getOrGenerateLivingThread(makeAdmin(), "u1", near);
    expect(r.status).toBe("gathering");
    expect(r.thread).toBeNull();
  });
});

describe("getOrGenerateLivingThread — generation + idempotency", () => {
  it("eligible → generates a validated thread, then restores it unchanged", async () => {
    const admin = makeAdmin();
    const first = await getOrGenerateLivingThread(admin, "u1", RECORDS);
    expect(first.status).toBe("eligible");
    if (first.status === "eligible") {
      expect(first.generated).toBe(true);
      expect(first.thread.thread).toContain("responsibility");
    }
    expect(insertCount).toBe(1);

    const second = await getOrGenerateLivingThread(admin, "u1", RECORDS);
    expect(second.status).toBe("eligible");
    if (second.status === "eligible") expect(second.generated).toBe(false); // restored
    expect(insertCount).toBe(1); // no second write for the same evidence
  });

  it("changed evidence → new fingerprint → new generation", async () => {
    const admin = makeAdmin();
    await getOrGenerateLivingThread(admin, "u1", RECORDS);
    const edited = [RECORDS[0], RECORDS[1], { ...RECORDS[2], responseText: "A completely different reflection." }];
    // The valid thread still references e1/e3 which exist in the edited packet.
    await getOrGenerateLivingThread(admin, "u1", edited);
    expect(insertCount).toBe(2); // distinct evidence → distinct stored rows
  });

  it("concurrent generation converges to ONE canonical row", async () => {
    const admin = makeAdmin();
    const [a, b] = await Promise.all([
      getOrGenerateLivingThread(admin, "u1", RECORDS),
      getOrGenerateLivingThread(admin, "u1", RECORDS),
    ]);
    expect(a.status).toBe("eligible");
    expect(b.status).toBe("eligible");
    expect(insertCount).toBe(1); // upsert-ignore: only one row
  });
});

describe("getOrGenerateLivingThread — provider failure fallback", () => {
  it("LLM throws → deterministic fallback thread is used and persisted", async () => {
    llm.throws = true;
    const r = await getOrGenerateLivingThread(makeAdmin(), "u1", RECORDS);
    expect(r.status).toBe("eligible");
    if (r.status === "eligible") {
      expect(r.thread.supportingMoments.length).toBeGreaterThanOrEqual(2);
      expect(r.thread.nextQuestion).toBeNull(); // fallback asks no forced question
      expect(r.thread.thread).toContain("your own words");
    }
  });

  it("invalid LLM output (fabricated event) → fallback, not the bad thread", async () => {
    llm.content = JSON.stringify({
      thread: "Across these reflections you always avoid the hard thing.",
      supportingMoments: [{ eventId: "GHOST", excerpt: "x" }, { eventId: "e1", excerpt: "y" }],
      nextQuestion: null,
    });
    const r = await getOrGenerateLivingThread(makeAdmin(), "u1", RECORDS);
    expect(r.status).toBe("eligible");
    if (r.status === "eligible") expect(r.thread.thread).not.toContain("you always");
  });
});
