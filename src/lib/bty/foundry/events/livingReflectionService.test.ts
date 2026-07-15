import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Control the event/participant resolution and the LLM availability from the test.
const resolveState = {
  event: { id: "ev-1", owner_user_id: "owner-1", title: "T", status: "open", join_version: 1, created_at: "", closed_at: null },
  participant: { id: "pt-1", event_id: "ev-1", display_name: "Kim", status: "joined", joined_at: "", last_seen_at: "" },
  resolvable: true,
  hasParticipant: true,
};

vi.mock("./foundryEventService", () => ({
  resolveEventByToken: vi.fn(async () =>
    resolveState.resolvable ? { ok: true, event: resolveState.event, tokenVersion: 1 } : { ok: false },
  ),
  findParticipantBySession: vi.fn(async () => (resolveState.hasParticipant ? resolveState.participant : null)),
}));

const llm = { available: false, content: "" as string, throws: false, lastMessages: null as unknown };
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => llm.available,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async (params: { messages: unknown }) => {
          llm.lastMessages = params.messages;
          if (llm.throws) throw new Error("llm down");
          return { choices: [{ message: { content: llm.content } }] };
        },
      },
    },
  }),
}));

import { generateLivingReflection } from "./livingReflectionService";

type ProgressRow = {
  id: string;
  completed_at: string | null;
  response_text: string | null;
  completion_state: string | null;
  reflection: unknown;
  reflection_version: string | null;
  reflection_generated_at: string | null;
};

let row: ProgressRow;
let lastUpdate: Record<string, unknown> | null = null;
let contentPrompt: string | null = null;

function makeAdmin(): SupabaseClient {
  let table = "";
  const api = {
    from(t: string) {
      table = t;
      return api;
    },
    select() {
      return api;
    },
    eq() {
      return api;
    },
    maybeSingle: async () =>
      table === "foundry_event_training_content"
        ? { data: { completion_prompt: contentPrompt } }
        : { data: row },
    update(patch: Record<string, unknown>) {
      lastUpdate = patch;
      const chain = {
        eq() {
          return chain;
        },
        // Guarded first-generation claim: only writes when the slot is still empty.
        is: async () => {
          if (row.reflection_generated_at == null) {
            row = { ...row, ...(patch as Partial<ProgressRow>) };
          }
          return { error: null };
        },
        // Awaiting the chain directly = unconditional overwrite (self-heal path).
        then(resolve: (v: { error: null }) => void, reject: (e: unknown) => void) {
          return Promise.resolve()
            .then(() => {
              row = { ...row, ...(patch as Partial<ProgressRow>) };
              return { error: null as null };
            })
            .then(resolve, reject);
        },
      };
      return chain;
    },
  };
  return api as unknown as SupabaseClient;
}

const VALID_JSON = JSON.stringify({
  whatEmerged: "You stayed present.",
  whereYouStretched: "You didn't look away.",
  livingSentence: "Presence is the first act of leadership.",
  nextInvitation: "Tomorrow, slow one conversation down.",
});

// A valid, distinct, gate-passing stored reflection (four sections that each do
// their own job — used to exercise the idempotent restore path).
const VALID_STORED = {
  whatEmerged: "You keep returning to the cost of staying silent.",
  whereYouStretched: "There is a pull between protecting calm and naming what is true.",
  livingSentence: "Naming the hard thing is its own quiet courage.",
  nextInvitation: "Carry this toward the next moment that asks for your honesty.",
};

beforeEach(() => {
  resolveState.resolvable = true;
  resolveState.hasParticipant = true;
  resolveState.participant.status = "joined";
  llm.available = false;
  llm.throws = false;
  llm.content = "";
  llm.lastMessages = null;
  lastUpdate = null;
  contentPrompt = null;
  row = {
    id: "pr-1",
    completed_at: "2026-07-14T10:00:00Z",
    response_text: "I thought about my team.",
    completion_state: null,
    reflection: null,
    reflection_version: null,
    reflection_generated_at: null,
  };
});

describe("generateLivingReflection — gating", () => {
  it("rejects when event is inactive", async () => {
    resolveState.resolvable = false;
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("inactive");
  });

  it("rejects when there is no participant session", async () => {
    resolveState.hasParticipant = false;
    const r = await generateLivingReflection(makeAdmin(), "tok", null, "pass", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("rejects a removed participant", async () => {
    resolveState.participant.status = "removed";
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("removed");
  });

  it("rejects when training is not completed", async () => {
    row.completed_at = null;
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_completed");
  });
});

describe("generateLivingReflection — deterministic fallback (no LLM)", () => {
  it("produces a valid four-section reflection and persists MEANING only", async () => {
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "review", "en");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.generated).toBe(true);
      expect(r.completion_state).toBe("review");
      expect(r.reflection.whatEmerged.length).toBeGreaterThan(0);
      expect(r.reflection.livingSentence.length).toBeGreaterThan(0);
    }
    // Persisted only the four meaning columns, no telemetry.
    expect(lastUpdate).toBeTruthy();
    expect(Object.keys(lastUpdate!).sort()).toEqual(
      ["completion_state", "reflection", "reflection_generated_at", "reflection_version", "updated_at"].sort(),
    );
    expect(lastUpdate!.completion_state).toBe("review");
    expect(lastUpdate!.reflection_version).toBe("v1");
  });

  it("defaults to 'pass' when the client state is absent/invalid (never more punitive than the gate)", async () => {
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "garbage", "en");
    expect(r.ok && r.completion_state).toBe("pass");
  });
});

describe("generateLivingReflection — LLM expression path", () => {
  it("uses a valid LLM expression when available", async () => {
    llm.available = true;
    llm.content = VALID_JSON;
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reflection.whatEmerged).toBe("You stayed present.");
  });

  it("falls back to template when the LLM output fails the validator (leaks a metric)", async () => {
    llm.available = true;
    llm.content = JSON.stringify({
      whatEmerged: "You watched 92% of it.",
      whereYouStretched: "x",
      livingSentence: "y",
      nextInvitation: "z",
    });
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reflection.whatEmerged).not.toContain("92%");
  });

  it("falls back to template when the LLM throws", async () => {
    llm.available = true;
    llm.throws = true;
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
  });

  it("strips code fences from the LLM output", async () => {
    llm.available = true;
    llm.content = "```json\n" + VALID_JSON + "\n```";
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reflection.livingSentence).toContain("Presence");
  });
});

describe("generateLivingReflection — host-question grounding", () => {
  it("passes the host completion question to the LLM as evidence", async () => {
    llm.available = true;
    llm.content = VALID_JSON;
    contentPrompt = "What will you protect and what will you change?";
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    const messages = llm.lastMessages as { role: string; content: string }[];
    const userMsg = messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("What will you protect and what will you change?");
    expect(userMsg).toContain("host's question");
  });

  it("omits question evidence when the event has no completion prompt", async () => {
    llm.available = true;
    llm.content = VALID_JSON;
    contentPrompt = null;
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    const messages = llm.lastMessages as { role: string; content: string }[];
    const userMsg = messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("no specific reflection question");
  });

  it("does NOT read the host question on the idempotent restore path", async () => {
    // Already generated → early return before any content read; the LLM is never called.
    llm.available = true;
    llm.content = VALID_JSON;
    contentPrompt = "Should never be requested on restore.";
    row.reflection_generated_at = "2026-07-14T11:00:00Z";
    row.completion_state = "pass";
    row.reflection = { ...VALID_STORED };
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.generated).toBe(false);
    expect(llm.lastMessages).toBeNull();
  });
});

describe("generateLivingReflection — quality self-heal", () => {
  it("regenerates AND overwrites a stored reflection that fails the quality gate", async () => {
    // A legacy row persisted BEFORE the quality guard: third-person + fragment.
    row.reflection_generated_at = "2026-07-14T11:00:00Z";
    row.completion_state = "pass";
    row.reflection = {
      whatEmerged: "The participant noted a conscious choice to limit engagement.",
      whereYouStretched: "The participant was not fully engaged.",
      livingSentence: "Less observation.",
      nextInvitation: "Consider how clear communication could help your team.",
    };
    llm.available = false; // force the clean deterministic fallback
    const admin = makeAdmin();
    const r = await generateLivingReflection(admin, "tok", "sess", "pass", "en");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.generated).toBe(true);
      // The healed reflection is clean: no third-person, no fragment.
      expect(r.reflection.whatEmerged).not.toMatch(/participant/i);
      expect(r.reflection.livingSentence.split(/\s+/).length).toBeGreaterThanOrEqual(4);
    }
    // It was persisted (overwrite), so a second read returns it unchanged.
    expect(lastUpdate).toBeTruthy();
    const second = await generateLivingReflection(admin, "tok", "sess", "pass", "en");
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.generated).toBe(false);
  });
});

describe("generateLivingReflection — idempotency (user history)", () => {
  it("returns the stored reflection unchanged and does not regenerate", async () => {
    row.reflection_generated_at = "2026-07-14T11:00:00Z";
    row.completion_state = "pass";
    row.reflection = { ...VALID_STORED };
    const r = await generateLivingReflection(makeAdmin(), "tok", "sess", "incomplete", "en");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.generated).toBe(false);
      expect(r.reflection.whatEmerged).toBe(VALID_STORED.whatEmerged);
      expect(r.completion_state).toBe("pass"); // stored state wins, not the new client value
    }
    expect(lastUpdate).toBeNull(); // no write on the idempotent path
  });
});
