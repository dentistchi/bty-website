import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DURABLE ATTEMPT LIFECYCLE (Slice 3.2I-R5B2-R5A).
 *
 * 3.2K-R4 traced a real staging failure and could not name its mechanism: a provider abort, a
 * transport rejection and an empty body all returned `generation_failed`, and the field that told
 * them apart went only to `console.info` on a Worker with no log retention.
 *
 * These tests hold the replacement to the two properties the whole slice rests on:
 *   the provider CANNOT be reached without a durable attempt row, and
 *   every terminal branch finalizes that row DISTINCTLY, carrying no content.
 *
 * The provider itself is never reachable here — the generation service is mocked wholesale, so no
 * test path can issue a request.
 */

// `vi.mock` factories are hoisted above module scope, so the spy has to be hoisted with them.
const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));
vi.mock("./arenaScenarioGenerationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./arenaScenarioGenerationService")>();
  return { ...actual, generateArenaScenarioDraft: mockGenerate };
});
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => {
    throw new Error("no test may reach the provider");
  },
}));

import { regenerateArenaDraft } from "./foundryArenaDraftService";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

const ATTEMPTS = "foundry_practice_generation_attempts";
const DRAFTS = "foundry_arena_scenario_drafts";

const VALID: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "p1", label: "Raise the risk with the team now and stop the line" },
      { id: "p2", label: "Verify the gap yourself first, then decide whether to stop" },
    ],
  },
  tradeoff: {
    escalationText: "Your manager pushes back hard and the deadline is now public.",
    choices: [
      { id: "t1", label: "Tell the manager plainly and own the call" },
      { id: "t2", label: "Escalate above the manager, accepting the strain" },
    ],
  },
  actionDecision: {
    prompt: "What will you do now?",
    choices: [
      { id: "a1", label: "Stop the line now and own the delay", isActionCommitment: true },
      { id: "a2", label: "Document the gap in writing, accepting the line keeps running", isActionCommitment: false },
    ],
  },
};

type Row = Record<string, unknown>;

/** A Supabase stub that records every attempt write and can be told to fail specific operations. */
function makeAdmin(opts: { attemptInsertFails?: boolean; attemptUpdateFails?: boolean; draftUpdateFails?: boolean } = {}) {
  const attempts: Row[] = [];
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
        practiceBoundary: { mode: "judgment", confirmed: true, constraints: [] },
      },
      scenario_draft: null,
      generation_source: null,
      revision: 1,
      // R5C-4A1 — the semantic input epoch. A draft without one cannot be governed later, so
      // the service refuses it before any provider spend; fixtures must declare it.
      generation_input_revision: 1,
      created_at: "2026-08-03T00:00:00Z",
      updated_at: "2026-08-03T00:00:00Z",
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
      problem: "P",
      observable_behavior: "B",
      success_evidence: "S",
      learning_needs: ["decide"],
    },
  ];

  function from(table: string) {
    const rows = table === ATTEMPTS ? attempts : table === DRAFTS ? drafts : table === "foundry_events" ? events : modules;
    const b: Record<string, unknown> = {};
    let op: "select" | "insert" | "update" = "select";
    let patch: Row = {};
    let inserted: Row | null = null;
    const filters: Array<[string, unknown]> = [];

    const api = {
      select: () => api,
      insert: (r: Row) => {
        op = "insert";
        inserted = r;
        return api;
      },
      update: (p: Row) => {
        op = "update";
        patch = p;
        return api;
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      order: () => api,
      limit: () => api,
      maybeSingle: async () => settle(),
      single: async () => settle(),
      returns: () => api,
      then: (res: (v: unknown) => unknown) => Promise.resolve(settle()).then(res),
    };

    function settle() {
      if (op === "insert") {
        if (table === ATTEMPTS) {
          if (opts.attemptInsertFails) return { data: null, error: { code: "42501", message: "denied" } };
          const row = { id: `att-${attempts.length + 1}`, lifecycle_state: "started", ...inserted };
          attempts.push(row);
          return { data: row, error: null };
        }
        const row = { id: `r-${rows.length + 1}`, ...inserted };
        rows.push(row);
        return { data: row, error: null };
      }
      if (op === "update") {
        if (table === ATTEMPTS && opts.attemptUpdateFails) return { data: null, error: { code: "XX000", message: "no" } };
        if (table === DRAFTS && opts.draftUpdateFails) return { data: null, error: { code: "XX000", message: "no" } };
        const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        for (const r of hit) Object.assign(r, patch);
        return { data: hit[0] ?? null, error: hit.length ? null : { code: "PGRST116", message: "no rows" } };
      }
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: hit[0] ?? null, error: null };
    }
    Object.assign(b, api);
    return api;
  }

  return { admin: { from } as unknown as SupabaseClient, attempts, drafts };
}

const run = (a: SupabaseClient) => regenerateArenaDraft(a, "owner-1", "draft-1", "en");

/**
 * R5C-3V2 — every generation submission now requires an immutable source identity BEFORE the
 * parent attempt is created. These tests exercise that path, so they must declare the build they
 * run as; there is no global default, because a hidden default would make the gate untestable.
 */
const TEST_SOURCE_SHA = "cf7e3720f739c952c86324a668b6ffd98f5ea6b1";
beforeEach(() => {
  process.env.BTY_SOURCE_COMMIT_SHA = TEST_SOURCE_SHA;
});

beforeEach(() => mockGenerate.mockReset());

describe("[R5A] the provider cannot be reached without a durable attempt row", () => {
  it("creates the attempt BEFORE generation is invoked", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts).toHaveLength(1);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("FAIL BEFORE SPEND — an attempt-insert failure stops the request and calls no provider", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin({ attemptInsertFails: true });
    const r = await run(admin);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("generation_observability_unavailable");
    expect(mockGenerate).not.toHaveBeenCalled(); // the whole point
    expect(attempts).toHaveLength(0);
  });

  it("one submission creates exactly one attempt", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attempt_number).toBe(1);
  });

  it("records the timeout and token settings IN FORCE for the attempt", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    // Preserved unchanged by this slice, and now durable so a later tuning slice can compare
    // outcomes across configurations instead of guessing which was active.
    expect(attempts[0].provider_timeout_ms).toBe(120_000);
    expect(attempts[0].max_tokens).toBe(16_000);
    expect(attempts[0].structured_output_mode).toBe("json_schema_strict");
    expect(attempts[0].draft_revision).toBe(1);
    expect(attempts[0].boundary_mode).toBe("judgment");
    expect(attempts[0].boundary_constraint_count).toBe(0);
  });
});

describe("[R5A] every terminal branch finalizes distinctly", () => {
  const cases: Array<[string, unknown, string]> = [
    ["provider timeout", { ok: false, reason: "generation_failed", fault: { kind: "timeout" } }, "provider_timeout"],
    [
      "transport rejection",
      { ok: false, reason: "generation_failed", fault: { kind: "transport", category: "network" } },
      "provider_transport_error",
    ],
    ["non-2xx", { ok: false, reason: "generation_failed", fault: { kind: "http", status: 429 } }, "provider_http_error"],
    ["empty body", { ok: false, reason: "generation_failed", fault: { kind: "empty" } }, "provider_empty_output"],
    [
      "unparseable output",
      { ok: false, reason: "generation_rejected", rejectionCodes: ["malformed_shape"] },
      "provider_malformed_output",
    ],
    ["strict schema refused", { ok: false, reason: "structured_output_unavailable" }, "provider_schema_invalid"],
    ["quality refusal", { ok: false, reason: "generation_rejected", rejectionCodes: ["moral_asymmetry"] }, "scenario_quality_rejected"],
    ["boundary review refusal", { ok: false, reason: "boundary_review_inconclusive" }, "boundary_review_rejected"],
  ];

  it.each(cases)("%s finalizes as %s", async (_label, generated, expected) => {
    mockGenerate.mockResolvedValue(generated);
    const { admin, attempts } = makeAdmin();
    const r = await run(admin);
    expect(r.ok).toBe(false);
    expect(attempts[0].lifecycle_state).toBe("completed");
    expect(attempts[0].outcome).toBe(expected);
    expect(attempts[0].scenario_persisted).toBe(false);
    expect(typeof attempts[0].duration_ms).toBe("number");
  });

  it("the eight outcomes above are genuinely distinct — not one code wearing eight labels", () => {
    expect(new Set(cases.map((c) => c[2])).size).toBe(8);
  });

  it("an HTTP failure keeps the STATUS and a category, never a body", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "generation_failed", fault: { kind: "http", status: 429 } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts[0].provider_http_status).toBe(429);
    expect(attempts[0].provider_error_category).toBe("rate_limited");
  });

  it("PERSISTENCE failure is its own outcome — the scenario existed, the write did not land", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin({ draftUpdateFails: true });
    const r = await run(admin);
    expect(r.ok).toBe(false);
    expect(attempts[0].outcome).toBe("scenario_persistence_failed");
    expect(attempts[0].scenario_persisted).toBe(false);
  });

  it("SUCCESS finalizes AFTER persistence, and only then claims the scenario was stored", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts, drafts } = makeAdmin();
    const r = await run(admin);
    expect(r.ok).toBe(true);
    expect(attempts[0].outcome).toBe("success");
    expect(attempts[0].scenario_persisted).toBe(true);
    expect(drafts[0].scenario_draft).toBeTruthy();
    expect(drafts[0].revision).toBe(2);
  });

  it("an unnamed failure finalizes as internal_failure rather than vanishing", async () => {
    // A reason the taxonomy does not name maps to `internal_failure` — the gap stays VISIBLE in
    // the data instead of being guessed at. (The sibling path, a thrown exception, is caught by
    // the same finalize; it is not exercised here because a spy that throws is recorded as an
    // unhandled rejection by the runner regardless of the code under test handling its own copy.)
    mockGenerate.mockResolvedValue({ ok: false, reason: "generation_unavailable" });
    const { admin, attempts } = makeAdmin();
    const r = await run(admin);
    expect(r.ok).toBe(false);
    expect(attempts[0].lifecycle_state).toBe("completed");
    expect(attempts[0].outcome).toBe("internal_failure");
  });

  it("NO branch leaves the attempt in `started`", async () => {
    for (const [, generated] of cases) {
      mockGenerate.mockResolvedValue(generated);
      const { admin, attempts } = makeAdmin();
      await run(admin);
      expect(attempts[0].lifecycle_state).toBe("completed");
      expect(attempts[0].outcome).not.toBeNull();
    }
  });
});

describe("[R5A] a telemetry write failure never becomes another provider call", () => {
  it("a failed finalize preserves the generation result and issues no second request", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, drafts } = makeAdmin({ attemptUpdateFails: true });
    const r = await run(admin);
    // The scenario was persisted; losing the record of it is not a reason to generate again.
    expect(r.ok).toBe(true);
    expect(drafts[0].scenario_draft).toBeTruthy();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("finalization is idempotent — a second terminal write cannot rewrite the first answer", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "generation_failed", fault: { kind: "timeout" } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    const first = { ...attempts[0] };
    const { finalizeGenerationAttempt } = await import("./generationAttemptRecorder");
    // The update is scoped to rows still `started`, so this matches nothing.
    await finalizeGenerationAttempt(admin, String(attempts[0].id), { outcome: "success", durationMs: 1 });
    expect(attempts[0].outcome).toBe(first.outcome);
    expect(attempts[0].outcome).toBe("provider_timeout");
  });
});

describe("[R5A] no content can enter telemetry", () => {
  it("no attempt field carries prompt, response, scenario or boundary prose", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    const serialized = JSON.stringify(attempts[0]);
    for (const fragment of [
      VALID.title,
      VALID.opening.slice(0, 40),
      VALID.tradeoff.escalationText.slice(0, 30),
      VALID.actionDecision.prompt,
      "Raise the risk",
    ]) {
      expect(serialized).not.toContain(fragment);
    }
    // Only shape, identity, timing and outcome.
    expect(Object.keys(attempts[0]).sort()).not.toContain("prompt");
    expect(Object.keys(attempts[0]).sort()).not.toContain("response");
  });

  it("the support reference given to the caller is not the attempt id", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "generation_failed", fault: { kind: "timeout" } });
    const { admin, attempts } = makeAdmin();
    const r = await run(admin);
    const ref = r.ok === false ? r.attemptRef : undefined;
    expect(ref).toMatch(/^[0-9a-f]{12}$/);
    expect(ref).not.toBe(attempts[0].id);
  });

  it("the captured zero-rule judgment boundary is still server-eligible", async () => {
    // R4's exact draft shape: confirmed, mode `judgment`, zero constraints. It must still generate.
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin } = makeAdmin();
    const r = await run(admin);
    expect(r.ok).toBe(true);
  });
});

describe("[R5C-1] the exact stage and reason reach the durable row", () => {
  it("a boundary CONTENT rejection is recorded as boundary_review, not scenario_quality", async () => {
    // The measured crux: this returns plain `generation_rejected`, identical to a quality refusal.
    mockGenerate.mockResolvedValue({
      ok: false,
      reason: "generation_rejected",
      rejectionGate: "narrow_boundary_review",
      rejectionPrimaryCode: "boundary_reopened_after_prior_compliance",
      rejectionCodes: ["boundary_reopened_after_prior_compliance", "resulting_state_missing_prerequisite"],
    });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts[0].attribution_version).toBe(1);
    expect(attempts[0].terminal_stage).toBe("boundary_review");
    expect(attempts[0].terminal_reason_code).toBe("boundary_content_rejected");
    expect(attempts[0].refusal_gate).toBe("narrow_boundary_review");
    expect(attempts[0].primary_finding_code).toBe("boundary_reopened_after_prior_compliance");
    expect(attempts[0].finding_count).toBe(2);
  });

  it("a SEMANTIC reviewer terminal failure is recorded as semantic_review", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "reviewer_terminal_failure" });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts[0].terminal_stage).toBe("semantic_review");
    expect(attempts[0].terminal_reason_code).toBe("semantic_reviewer_terminal_failure");
    expect(attempts[0].terminal_stage).not.toBe("boundary_review");
  });

  it("a quality-gate refusal stays scenario_quality", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "generation_rejected", rejectionGate: "canonical_validator", rejectionCodes: ["moral_asymmetry"] });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts[0].terminal_stage).toBe("scenario_quality");
    expect(attempts[0].terminal_reason_code).toBe("scenario_quality_rejected");
  });

  it("persistence failure is attributed to persistence", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin({ draftUpdateFails: true });
    await run(admin);
    expect(attempts[0].terminal_stage).toBe("persistence");
    expect(attempts[0].terminal_reason_code).toBe("scenario_persistence_failed");
  });

  it("no attribution field can carry prose", async () => {
    mockGenerate.mockResolvedValue({
      ok: false,
      reason: "generation_rejected",
      rejectionGate: "canonical_validator",
      rejectionPrimaryCode: "The scenario had no real tradeoff at all.",
      rejectionCodes: ["A teammate quietly flags a safety gap to you.", "moral_asymmetry"],
    });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    const s = JSON.stringify(attempts[0]);
    expect(s).not.toMatch(/teammate|safety gap|real tradeoff/);
    expect(attempts[0].finding_codes).toEqual(["moral_asymmetry"]);
    expect(attempts[0].primary_finding_code).toBe("moral_asymmetry");
  });

  it("a SUCCESS carries no refusal attribution", async () => {
    mockGenerate.mockResolvedValue({ ok: true, value: { draft: VALID, warnings: [], source: "ai" } });
    const { admin, attempts } = makeAdmin();
    await run(admin);
    expect(attempts[0].outcome).toBe("success");
    expect(attempts[0].refusal_gate ?? null).toBeNull();
  });
});
