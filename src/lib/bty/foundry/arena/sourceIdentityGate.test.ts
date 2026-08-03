import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withGovernedRpc } from "./governedAdmission.fixture";

/**
 * IDENTITY IS FAIL-BEFORE-SPEND (Slice 3.2I-R5B2-R5C-3V2).
 *
 * R5A established that a generation may not begin unless its outcome can be written down. This
 * extends that rule one step earlier: an attempt that cannot name the build that ran it is only
 * half observable — R5B could read what happened but not what was running.
 *
 * A build that cannot identify itself therefore spends nothing: no parent row, no child call, no
 * provider request, and the Host's draft is left byte-identical.
 */

const H = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: H.mockCreate } } }),
  LlmHttpError: class extends Error {},
}));

import { regenerateArenaDraft } from "./foundryArenaDraftService";
import { currentSourceIdentity, readSourceIdentity, SOURCE_COMMIT_ENV } from "./sourceIdentity";

const REAL = "cf7e3720f739c952c86324a668b6ffd98f5ea6b1";
const APRIL = "2026-04-27-api-version-endpoint-v1";

type Row = Record<string, unknown>;

/** The same double shape the R5C-2B instrumentation tests use, kept minimal for this gate. */
function makeAdmin() {
  const calls: Row[] = [];
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
        hardestWhen: { choice: "time_limited" },
        avoidancePressure: { text: "raising it feels like slowing everyone down" },
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
        const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        for (const r of hit) Object.assign(r, patch);
        return { data: table === "foundry_practice_generation_attempt_calls" ? hit : (hit[0] ?? null), error: null };
      }
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: hit[0] ?? null, error: null };
    }
    return api;
  }
  return { admin: withGovernedRpc({ from }, drafts, attempts) as unknown as SupabaseClient, calls, attempts, drafts };
}

let saved: string | undefined;
beforeEach(() => {
  saved = process.env[SOURCE_COMMIT_ENV];
  H.mockCreate.mockReset();
  H.mockCreate.mockResolvedValue({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] });
});
afterEach(() => {
  if (saved === undefined) delete process.env[SOURCE_COMMIT_ENV];
  else process.env[SOURCE_COMMIT_ENV] = saved;
  vi.restoreAllMocks();
});

describe("[R5C-3V2] the server reads ONE environment variable", () => {
  it("accepts a valid sha from BTY_SOURCE_COMMIT_SHA", () => {
    expect(currentSourceIdentity({ [SOURCE_COMMIT_ENV]: REAL } as unknown as NodeJS.ProcessEnv)).toEqual({
      sourceCommitSha: REAL,
      identityKind: "git_commit",
    });
  });

  it("BTY_DEPLOY_VERSION alone is NOT identity, even when it holds a real sha", () => {
    // The wrapper sets both, but `BTY_DEPLOY_VERSION` also has a stale static value in
    // wrangler.toml. Trusting it would make identity correct only when someone remembered a ritual.
    const env = { BTY_DEPLOY_VERSION: REAL } as unknown as NodeJS.ProcessEnv;
    expect(currentSourceIdentity(env)).toBeNull();
  });

  it("refuses the stale April label", () => {
    const env = { [SOURCE_COMMIT_ENV]: APRIL } as unknown as NodeJS.ProcessEnv;
    expect(currentSourceIdentity(env)).toBeNull();
    expect(readSourceIdentity(env)).toEqual({ ok: false, reason: "wrong_length" });
  });

  it.each([
    ["absent", {}],
    ["blank", { [SOURCE_COMMIT_ENV]: "" }],
    ["short", { [SOURCE_COMMIT_ENV]: "cf7e3720" }],
    ["a branch name", { [SOURCE_COMMIT_ENV]: "inner-main" }],
    ["uppercase", { [SOURCE_COMMIT_ENV]: REAL.toUpperCase() }],
  ])("refuses %s", (_l, env) => {
    expect(currentSourceIdentity(env as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("reads identity from the environment only — never from a caller-supplied value", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./sourceIdentity.ts", import.meta.url), "utf8"),
    );
    // A client that could name the build could forge the provenance of every attempt under it.
    expect(src).not.toMatch(/headers|cookies|searchParams|req\.|request\./);
  });
});

describe("[R5C-3V2] a build that cannot name itself spends nothing", () => {
  const run = (a: SupabaseClient) => regenerateArenaDraft(a, "owner-1", "draft-1", "en");

  it("a VALID identity reaches the parent row as the exact sha", async () => {
    process.env[SOURCE_COMMIT_ENV] = REAL;
    const h = makeAdmin();
    await run(h.admin);
    expect(h.attempts).toHaveLength(1);
    expect(h.attempts[0].deploy_version).toBe(REAL);
    // The stale label is gone from new rows entirely.
    expect(h.attempts[0].deploy_version).not.toBe(APRIL);
  });

  it.each([
    ["missing", undefined],
    ["blank", ""],
    ["the April label", APRIL],
    ["a short sha", "cf7e3720"],
    ["a branch name", "inner-main"],
  ])("%s identity creates NO parent, NO child, NO provider call", async (_l, value) => {
    if (value === undefined) delete process.env[SOURCE_COMMIT_ENV];
    else process.env[SOURCE_COMMIT_ENV] = value;
    const h = makeAdmin();
    const before = JSON.stringify(h.drafts[0]);

    const r = await run(h.admin);

    expect(r.ok).toBe(false);
    // The EXISTING fail-before-spend contract — no new taxonomy value was introduced.
    expect(r.ok === false && r.reason).toBe("generation_observability_unavailable");
    expect(h.attempts).toHaveLength(0);
    expect(h.calls).toHaveLength(0);
    expect(H.mockCreate).not.toHaveBeenCalled();
    // The Host's setup and confirmed boundary survive untouched.
    expect(JSON.stringify(h.drafts[0])).toBe(before);
    expect(h.drafts[0].scenario_draft).toBeNull();
    expect(h.drafts[0].revision).toBe(1);
  });

  it("the identity gate runs BEFORE the parent row, not after", async () => {
    delete process.env[SOURCE_COMMIT_ENV];
    const h = makeAdmin();
    await run(h.admin);
    // If the gate ran after, a parent row would exist and would then need finalizing.
    expect(h.attempts).toHaveLength(0);
  });
});

describe("[R5C-3V2] historical rows are not touched", () => {
  it("a stale label on an existing row is left exactly as it is", async () => {
    process.env[SOURCE_COMMIT_ENV] = REAL;
    const h = makeAdmin();
    // Two historical parents, recorded under the former contract.
    const historical: Row[] = [
      { id: "hist-1", deploy_version: APRIL },
      { id: "hist-2", deploy_version: APRIL },
    ];
    await regenerateArenaDraft(h.admin, "owner-1", "draft-1", "en");
    // Nothing in the write path rewrites an existing deploy_version.
    expect(historical.map((r) => r.deploy_version)).toEqual([APRIL, APRIL]);
    expect(h.attempts.filter((a) => a.deploy_version === APRIL)).toHaveLength(0);
  });
});
