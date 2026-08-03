import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withGovernedRpc } from "./governedAdmission.fixture";

/**
 * WHICH WRITES MOVE THE INPUT EPOCH (Slice 3.2I-R5B2-R5C-4A1).
 *
 * The whole point of the second column is that it disagrees with `revision` on exactly the writes
 * that matter. These tests drive the REAL service writers and assert BOTH numbers after each one,
 * because "the epoch is correct" is only meaningful alongside "the concurrency token still bumps".
 */

const H = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: H.mockCreate } } }),
  LlmHttpError: class extends Error {},
}));

import {
  regenerateArenaDraft,
  saveArenaDraftEdits,
  saveDraftBoundary,
  saveDraftBoundaryScope,
} from "./foundryArenaDraftService";
import { SOURCE_COMMIT_ENV } from "./sourceIdentity";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

const SHA = "0b236b08eaa4a0f919a610df20b41de8f2cd7743";
type Row = Record<string, unknown>;

const RULE = (id: string, statement: string) => ({ id, statement, provenance: "manager_entered" as const });
const B_JUDGMENT = { mode: "judgment" as const, confirmed: true, constraints: [] };
const B_RULES = {
  mode: "judgment_with_constraints" as const,
  confirmed: true,
  constraints: [RULE("c1", "Verify two identifiers before treatment"), RULE("c2", "Escalate when capacity is unsafe")],
};

const VALID: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: { choices: [{ id: "p1", label: "Raise the risk now and stop the line" }, { id: "p2", label: "Verify the gap yourself first" }] },
  tradeoff: {
    escalationText: "Your manager pushes back hard and the deadline is now public.",
    choices: [{ id: "t1", label: "Tell the manager plainly and own the call" }, { id: "t2", label: "Escalate above the manager" }],
  },
  actionDecision: {
    prompt: "What will you do now?",
    choices: [
      { id: "a1", label: "Stop the line now and own the delay", isActionCommitment: true },
      { id: "a2", label: "Document the gap in writing, accepting the line keeps running", isActionCommitment: false },
    ],
  },
};

function makeAdmin(draftOver: Row = {}) {
  const attempts: Row[] = [];
  const calls: Row[] = [];
  const drafts: Row[] = [
    {
      id: "draft-1",
      owner_user_id: "owner-1",
      source_event_id: "evt-1",
      source_module_version: 1,
      source_draft_id: "sd-1",
      status: "draft",
      guided_answers: {
        practiceSetupVersion: 1,
        practiceBoundary: B_JUDGMENT,
        hardestWhen: { choice: "time_limited" },
        avoidancePressure: { text: "raising it feels like slowing everyone down" },
      },
      scenario_draft: null,
      generation_source: null,
      revision: 1,
      generation_input_revision: 1,
      created_at: "t",
      updated_at: "t",
      ...draftOver,
    },
  ];
  const events: Row[] = [{ id: "evt-1", owner_user_id: "owner-1", status: "open", title: "T" }];
  const modules: Row[] = [
    {
      event_id: "evt-1",
      version: 1,
      id: "sd-1",
      status: "published",
      arena_recommended: true,
      problem: "A teammate proposes cutting a planned design review to hit the deadline",
      observable_behavior: "Raise the concern before the shortcut is taken",
      success_evidence: "The concern is recorded",
      learning_needs: ["decide"],
    },
  ];

  function from(table: string) {
    const rows =
      table === "foundry_practice_generation_attempt_calls"
        ? calls
        : table === "foundry_practice_generation_attempts"
          ? attempts
          : table === "foundry_arena_scenario_drafts"
            ? drafts
            : table === "foundry_events"
              ? events
              : modules;
    let op: "select" | "insert" | "update" = "select";
    let patch: Row = {};
    let inserted: Row | null = null;
    const filters: Array<[string, unknown]> = [];
    const api = {
      select: () => api,
      insert: (r: Row) => ((op = "insert"), (inserted = r), api),
      update: (p: Row) => ((op = "update"), (patch = p), api),
      eq: (c: string, v: unknown) => (filters.push([c, v]), api),
      order: () => api,
      limit: () => api,
      maybeSingle: async () => settle(),
      single: async () => settle(),
      returns: () => api,
      then: (res: (v: unknown) => unknown) => Promise.resolve(settle()).then(res),
    };
    function settle() {
      if (op === "insert") {
        const row: Row = { id: `${table}-${rows.length + 1}`, ...inserted };
        rows.push(row);
        return { data: row, error: null };
      }
      if (op === "update") {
        // Honours the optimistic guard: a stale `revision` filter matches nothing.
        const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        for (const r of hit) Object.assign(r, patch);
        if (table === "foundry_practice_generation_attempt_calls") return { data: hit, error: null };
        return { data: hit[0] ?? null, error: hit.length ? null : { code: "PGRST116", message: "no rows" } };
      }
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: hit[0] ?? null, error: null };
    }
    return api;
  }
  return { admin: withGovernedRpc({ from }, drafts, attempts) as unknown as SupabaseClient, drafts, attempts, calls };
}

/** Both numbers, always read together. */
const epochs = (drafts: Row[]) => ({ revision: drafts[0].revision, input: drafts[0].generation_input_revision });

beforeEach(() => {
  process.env[SOURCE_COMMIT_ENV] = SHA;
  H.mockCreate.mockReset();
  H.mockCreate.mockResolvedValue({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] });
});
afterEach(() => vi.restoreAllMocks());

describe("[R5C-4A1] a MEANINGFUL input change moves both numbers", () => {
  it("a boundary mode + rule change increments the epoch exactly once", async () => {
    const h = makeAdmin();
    const r = await saveDraftBoundary(h.admin, "owner-1", "draft-1", B_RULES, 1);
    expect(r.ok).toBe(true);
    // Two fields moved in one save; that is ONE new input epoch, not two.
    expect(epochs(h.drafts)).toEqual({ revision: 2, input: 2 });
  });

  it("a rule STATEMENT edit increments the epoch", async () => {
    const h = makeAdmin({ guided_answers: { practiceSetupVersion: 1, practiceBoundary: B_RULES, hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "x" } } });
    const edited = { ...B_RULES, constraints: [RULE("c1", "Verify THREE identifiers before treatment"), B_RULES.constraints[1]] };
    await saveDraftBoundary(h.admin, "owner-1", "draft-1", edited, 1);
    expect(epochs(h.drafts)).toEqual({ revision: 2, input: 2 });
  });

  it("a confirmation change increments the epoch", async () => {
    const h = makeAdmin();
    await saveDraftBoundary(h.admin, "owner-1", "draft-1", { ...B_JUDGMENT, confirmed: false }, 1);
    expect(h.drafts[0].generation_input_revision).toBe(2);
  });

  it("an active-rule selection change increments the epoch", async () => {
    const h = makeAdmin({ guided_answers: { practiceSetupVersion: 1, practiceBoundary: B_RULES, hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "x" } } });
    const r = await saveDraftBoundaryScope(h.admin, "owner-1", "draft-1", ["c1"], 1);
    expect(r.ok).toBe(true);
    expect(epochs(h.drafts)).toEqual({ revision: 2, input: 2 });
  });
});

describe("[R5C-4A1] an IDEMPOTENT save moves the row token but NOT the epoch", () => {
  it("re-saving an identical boundary leaves the epoch alone — the closed bypass", async () => {
    const h = makeAdmin();
    // Byte-identical boundary, deliberately a fresh object so identity comparison would be wrong.
    const r = await saveDraftBoundary(h.admin, "owner-1", "draft-1", { mode: "judgment", confirmed: true, constraints: [] }, 1);
    expect(r.ok).toBe(true);
    // `revision` STILL bumps — its concurrency contract is untouched by this slice.
    expect(epochs(h.drafts)).toEqual({ revision: 2, input: 1 });
  });

  it("a whitespace/case-equivalent rule statement is NOT a new epoch", async () => {
    const h = makeAdmin({ guided_answers: { practiceSetupVersion: 1, practiceBoundary: B_RULES, hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "x" } } });
    const equivalent = {
      ...B_RULES,
      constraints: [RULE("c1", "  Verify   two identifiers before treatment  "), RULE("c2", "Escalate when capacity is unsafe")],
    };
    await saveDraftBoundary(h.admin, "owner-1", "draft-1", equivalent, 1);
    expect(epochs(h.drafts)).toEqual({ revision: 2, input: 1 });
  });

  it("re-selecting the same active rules in a DIFFERENT ORDER is not a new epoch", async () => {
    const h = makeAdmin({ guided_answers: { practiceSetupVersion: 1, practiceBoundary: B_RULES, hardestWhen: { choice: "time_limited" }, avoidancePressure: { text: "x" } } });
    await saveDraftBoundaryScope(h.admin, "owner-1", "draft-1", ["c1", "c2"], 1);
    const afterFirst = h.drafts[0].generation_input_revision;
    await saveDraftBoundaryScope(h.admin, "owner-1", "draft-1", ["c2", "c1"], 2);
    // Order is semantically irrelevant and the comparison sorts before comparing.
    expect(h.drafts[0].generation_input_revision).toBe(afterFirst);
    expect(h.drafts[0].revision).toBe(3);
  });
});

describe("[R5C-4A1] a NON-INPUT write never moves the epoch", () => {
  it("a scenario-editor save bumps revision only", async () => {
    const h = makeAdmin({ scenario_draft: VALID, generation_source: "ai" });
    const r = await saveArenaDraftEdits(h.admin, "owner-1", "draft-1", VALID);
    expect(r.ok).toBe(true);
    // This edits the OUTPUT. Letting it reset the epoch would have been a governance bypass.
    expect(epochs(h.drafts)).toEqual({ revision: 2, input: 1 });
  });

  it("a failed generation moves neither number", async () => {
    const h = makeAdmin();
    H.mockCreate.mockResolvedValue({ choices: [{ message: { content: "not json" }, finish_reason: "stop" }] });
    const r = await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");
    expect(r.ok).toBe(false);
    expect(epochs(h.drafts)).toEqual({ revision: 1, input: 1 });
  });

  it("starting a parent attempt and recording child calls moves neither number", async () => {
    const h = makeAdmin();
    H.mockCreate.mockResolvedValue({ choices: [{ message: { content: "not json" }, finish_reason: "stop" }] });
    await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");
    expect(h.attempts.length).toBeGreaterThan(0);
    expect(epochs(h.drafts)).toEqual({ revision: 1, input: 1 });
  });

  it("a read moves neither number", async () => {
    const h = makeAdmin();
    const before = epochs(h.drafts);
    await saveDraftBoundary(h.admin, "owner-1", "missing-draft", B_RULES, 1);
    expect(epochs(h.drafts)).toEqual(before);
  });
});

describe("[R5C-4A1] a FAILED write commits neither number", () => {
  it("a stale optimistic revision changes nothing", async () => {
    const h = makeAdmin();
    const r = await saveDraftBoundary(h.admin, "owner-1", "draft-1", B_RULES, 99);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("stale_revision");
    expect(epochs(h.drafts)).toEqual({ revision: 1, input: 1 });
  });

  it("an invalid boundary changes nothing", async () => {
    const h = makeAdmin();
    const r = await saveDraftBoundary(h.admin, "owner-1", "draft-1", { mode: "nonsense" }, 1);
    expect(r.ok).toBe(false);
    expect(epochs(h.drafts)).toEqual({ revision: 1, input: 1 });
  });

  it("an invalid scenario edit changes nothing", async () => {
    const h = makeAdmin({ scenario_draft: VALID });
    const r = await saveArenaDraftEdits(h.admin, "owner-1", "draft-1", { nonsense: true });
    expect(r.ok).toBe(false);
    expect(epochs(h.drafts)).toEqual({ revision: 1, input: 1 });
  });
});

describe("[R5C-4A1] the parent attempt records BOTH numbers", () => {
  it("records the concurrency token and the semantic epoch, and they are distinct concepts", async () => {
    const h = makeAdmin({ revision: 7, generation_input_revision: 3 });
    H.mockCreate.mockResolvedValue({ choices: [{ message: { content: "not json" }, finish_reason: "stop" }] });
    await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");
    expect(h.attempts).toHaveLength(1);
    expect(h.attempts[0].draft_revision).toBe(7);
    expect(h.attempts[0].generation_input_revision).toBe(3);
    // Source identity is untouched by this slice.
    expect(h.attempts[0].deploy_version).toBe(SHA);
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -1],
    ["a string", "1"],
  ])("a %s epoch fails BEFORE any provider spend", async (_l, bad) => {
    const h = makeAdmin({ generation_input_revision: bad });
    const before = JSON.stringify(h.drafts[0]);
    const r = await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");
    expect(r.ok).toBe(false);
    // The EXISTING observability contract — no new taxonomy value, and no draft_revision substitute.
    expect(r.ok === false && r.reason).toBe("generation_observability_unavailable");
    expect(h.attempts).toHaveLength(0);
    expect(h.calls).toHaveLength(0);
    expect(H.mockCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(h.drafts[0])).toBe(before);
  });
});
