import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withGovernedRpc } from "./governedAdmission.fixture";
import { saveDraftGuidedAnswers } from "./foundryArenaDraftService";

/**
 * THE SETUP MUTATION (Slice 3.2I-R5B2-R5C-4B).
 *
 * R5C-4A1 measured that these two answers had no write path, and R5C-4A2 then blocked the captured
 * draft with "review your setup" as the only way forward. A Host was therefore told to change
 * something the product gave them no way to change. These tests hold the repair to two properties:
 * a real edit moves BOTH revisions exactly once, and a no-op moves nothing at all.
 */

type Row = Record<string, unknown>;

const GUIDED = {
  practiceSetupVersion: 1,
  practiceBoundary: { mode: "judgment", confirmed: true, constraints: [] },
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "raising it feels like slowing everyone down" },
};

function makeAdmin(over: Row = {}) {
  const drafts: Row[] = [
    {
      id: "draft-1",
      owner_user_id: "owner-1",
      source_event_id: "evt-1",
      source_module_version: 1,
      source_draft_id: "sd-1",
      status: "draft",
      guided_answers: { ...GUIDED },
      scenario_draft: { title: "a previously generated scenario" },
      generation_source: "ai",
      revision: 3,
      generation_input_revision: 1,
      created_at: "t",
      updated_at: "t",
      ...over,
    },
  ];
  const attempts: Row[] = [];
  function from() {
    let op: "select" | "update" = "select";
    let patch: Row = {};
    const filters: Array<[string, unknown]> = [];
    const api = {
      select: () => api,
      update: (p: Row) => ((op = "update"), (patch = p), api),
      eq: (c: string, v: unknown) => (filters.push([c, v]), api),
      maybeSingle: async () => settle(),
      single: async () => settle(),
      then: (res: (v: unknown) => unknown) => Promise.resolve(settle()).then(res),
    };
    function settle() {
      const hit = drafts.filter((r) => filters.every(([c, v]) => r[c] === v));
      if (op === "update") {
        for (const r of hit) Object.assign(r, patch);
        return { data: hit[0] ?? null, error: hit.length ? null : { code: "PGRST116", message: "no rows" } };
      }
      return { data: hit[0] ?? null, error: null };
    }
    return api;
  }
  return { admin: withGovernedRpc({ from }, drafts, attempts) as unknown as SupabaseClient, drafts };
}

const both = (drafts: Row[]) => ({ revision: drafts[0].revision, epoch: drafts[0].generation_input_revision });
const save = (h: ReturnType<typeof makeAdmin>, guided: unknown, rev: number | null = 3, epoch: number | null = 1) =>
  saveDraftGuidedAnswers(h.admin, "owner-1", "draft-1", guided, rev, epoch);

let h: ReturnType<typeof makeAdmin>;
beforeEach(() => (h = makeAdmin()));

describe("[R5C-4B] a MEANINGFUL edit moves both revisions exactly once", () => {
  it("changing the choice advances revision and epoch by one each", async () => {
    const r = await save(h, { hardestWhen: { choice: "authority_unclear" }, avoidancePressure: GUIDED.avoidancePressure });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.changed).toBe(true);
    expect(both(h.drafts)).toEqual({ revision: 4, epoch: 2 });
  });

  it("changing the pressure text advances both by one each", async () => {
    await save(h, { hardestWhen: GUIDED.hardestWhen, avoidancePressure: { text: "the director pushes back publicly" } });
    expect(both(h.drafts)).toEqual({ revision: 4, epoch: 2 });
  });

  it("changing BOTH in one save is ONE epoch, not two", async () => {
    await save(h, { hardestWhen: { choice: "other_resists" }, avoidancePressure: { text: "the person who raised it resists" } });
    expect(both(h.drafts)).toEqual({ revision: 4, epoch: 2 });
  });

  it("a meaningful edit INVALIDATES the previously generated scenario", async () => {
    await save(h, { hardestWhen: { choice: "other_resists" }, avoidancePressure: GUIDED.avoidancePressure });
    expect(h.drafts[0].scenario_draft).toBeNull();
    expect(h.drafts[0].generation_source).toBeNull();
  });

  it("the boundary is preserved — only the two answers are replaced", async () => {
    await save(h, { hardestWhen: { choice: "other_resists" }, avoidancePressure: GUIDED.avoidancePressure });
    const guided = h.drafts[0].guided_answers as Record<string, unknown>;
    expect(guided.practiceBoundary).toEqual(GUIDED.practiceBoundary);
    expect(guided.practiceSetupVersion).toBe(1);
  });
});

describe("[R5C-4B] a SEMANTIC NO-OP writes nothing at all", () => {
  it("re-saving identical answers moves neither revision", async () => {
    const r = await save(h, { hardestWhen: GUIDED.hardestWhen, avoidancePressure: GUIDED.avoidancePressure });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.changed).toBe(false);
    // Not even the optimistic token: a no-op must not look like a new input epoch.
    expect(both(h.drafts)).toEqual({ revision: 3, epoch: 1 });
  });

  it("a whitespace-equivalent answer is a no-op — it cannot reset governance", async () => {
    await save(h, { hardestWhen: GUIDED.hardestWhen, avoidancePressure: { text: "  raising it feels   like slowing everyone down " } });
    expect(both(h.drafts)).toEqual({ revision: 3, epoch: 1 });
  });

  it("a no-op leaves an existing scenario intact", async () => {
    await save(h, { hardestWhen: GUIDED.hardestWhen, avoidancePressure: GUIDED.avoidancePressure });
    expect(h.drafts[0].scenario_draft).not.toBeNull();
  });
});

describe("[R5C-4B] both guards are enforced", () => {
  it("a stale OPTIMISTIC revision writes nothing", async () => {
    const r = await save(h, { hardestWhen: { choice: "other_resists" }, avoidancePressure: GUIDED.avoidancePressure }, 99, 1);
    expect(r.ok === false && r.reason).toBe("stale_revision");
    expect(both(h.drafts)).toEqual({ revision: 3, epoch: 1 });
  });

  it("a stale SEMANTIC epoch writes nothing and is named distinctly", async () => {
    // The screen is describing an input epoch that no longer exists.
    const r = await save(h, { hardestWhen: { choice: "other_resists" }, avoidancePressure: GUIDED.avoidancePressure }, 3, 99);
    expect(r.ok === false && r.reason).toBe("generation_input_revision_stale");
    expect(both(h.drafts)).toEqual({ revision: 3, epoch: 1 });
  });

  it("invalid answers write nothing and return bounded codes", async () => {
    const r = await save(h, { hardestWhen: { choice: "nonsense" }, avoidancePressure: { text: "" } });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("guided_answers_invalid");
    expect(r.errors).toContain("hardest_when_choice_invalid");
    expect(r.errors).toContain("avoidance_pressure_required");
    expect(both(h.drafts)).toEqual({ revision: 3, epoch: 1 });
  });

  it("another owner's draft is indistinguishable from a missing one and writes nothing", async () => {
    const r = await saveDraftGuidedAnswers(h.admin, "someone-else", "draft-1", { hardestWhen: { choice: "other_resists" }, avoidancePressure: GUIDED.avoidancePressure }, 3, 1);
    expect(r.ok === false && r.reason).toBe("arena_draft_not_found");
    expect(both(h.drafts)).toEqual({ revision: 3, epoch: 1 });
  });

  it("saving never starts a generation", async () => {
    await save(h, { hardestWhen: { choice: "other_resists" }, avoidancePressure: GUIDED.avoidancePressure });
    // No attempt row, because saving setup is not submitting it.
    expect(h.drafts[0].scenario_draft).toBeNull();
  });
});
