import { providerJson, acceptReview, isReviewRequest } from "@/domain/foundry/arena-draft/providerDto.fixture";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withGovernedRpc } from "./governedAdmission.fixture";

// Slice 3.2I-R2: generation is LIVE-model only. Mock the provider to return a concrete,
// branch-aware, incident-specific draft so createArenaDraft/regenerate succeed (source "ai").
const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import {
  createArenaDraft,
  createOrOpenArenaDraftShell,
  getOwnerArenaDraft,
  listOwnerArenaDraftsForEvent,
  regenerateArenaDraft,
  saveArenaDraftEdits,
  saveDraftBoundary,
  saveDraftBoundaryScope,
} from "./foundryArenaDraftService";
import type { PracticeBoundary } from "@/domain/foundry/arena-draft/boundary";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";

const AI_DRAFT: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: { choices: [{ id: "primary_1", label: "Raise the risk with the team now and stop the line" }, { id: "primary_2", label: "Verify the gap yourself first, then decide whether to stop" }] },
  tradeoff: { escalationText: "Your manager pushes back hard and the deadline is now public.", choices: [{ id: "ft1", label: "Tell the manager plainly and own the call" }, { id: "ft2", label: "Escalate above the manager, accepting the strain" }] },
  actionDecision: { prompt: "What will you do now?", choices: [{ id: "fa1", label: "Stop the line now and own the delay", isActionCommitment: true }, { id: "fa2", label: "Document the gap in writing, accepting the line keeps running", isActionCommitment: false }] },
  branches: {
    primary_1: {
      escalationText: "You stop the line, and the plant manager confronts you in front of the crew, demanding to know who authorized the shutdown.",
      tradeoffChoices: [{ id: "p1_t1", label: "Hold the line stopped until the gap is fixed, accepting the manager's anger" }, { id: "p1_t2", label: "Restart under a documented watch, accepting the residual risk" }],
      actionDecision: { prompt: "What will you do now?", choices: [{ id: "p1_a1", label: "Keep it stopped and put your reasons in writing now", isActionCommitment: true }, { id: "p1_a2", label: "Restart with a monitor and re-check within the hour, accepting the exposure", isActionCommitment: false }] },
    },
    primary_2: {
      escalationText: "While you verify, a unit ships with the suspected defect and a customer calls back within the hour asking why it was not caught.",
      tradeoffChoices: [{ id: "p2_t1", label: "Recall the shipped unit now and absorb the cost, accepting the delay to others" }, { id: "p2_t2", label: "Contain it to the affected order, accepting the flawed unit stays out" }],
      actionDecision: { prompt: "What will you do now?", choices: [{ id: "p2_a1", label: "Issue the recall now and own the disruption", isActionCommitment: true }, { id: "p2_a2", label: "Confirm the defect scope first, accepting more may ship meanwhile", isActionCommitment: false }] },
    },
  },
};

/**
 * R5C-3V2 — every generation submission now requires an immutable source identity BEFORE the
 * parent attempt is created. These tests exercise that path, so they must declare the build they
 * run as; there is no global default, because a hidden default would make the gate untestable.
 */
const TEST_SOURCE_SHA = "cf7e3720f739c952c86324a668b6ffd98f5ea6b1";
beforeEach(() => {
  process.env.BTY_SOURCE_COMMIT_SHA = TEST_SOURCE_SHA;
});

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
    isReviewRequest(params)
      ? { choices: [{ message: { content: JSON.stringify(acceptReview(AI_DRAFT)) } }] }
      : { choices: [{ message: { content: providerJson(AI_DRAFT) } }] });
});

type Row = Record<string, unknown>;

/**
 * Table-aware fake for the three tables the Arena draft service touches. Emulates
 * the exact Supabase call shapes: select().eq()…maybeSingle(), insert().select().single(),
 * update().eq()….select().single(), select().eq()….order().returns().
 */
function makeFakeAdmin(seed: { events?: Row[]; modules?: Row[]; drafts?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    foundry_events: (seed.events ?? []).map((r) => ({ ...r })),
    foundry_event_module: (seed.modules ?? []).map((r) => ({ ...r })),
    foundry_arena_scenario_drafts: (seed.drafts ?? []).map((r) => ({ ...r })),
  };
  let idSeq = 0;

  function applyDefaults(table: string, row: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_arena_scenario_drafts") {
      return {
        id: row.id ?? `ad-${++idSeq}`,
        owner_user_id: row.owner_user_id,
        source_event_id: row.source_event_id,
        source_module_version: row.source_module_version,
        source_draft_id: row.source_draft_id,
        status: row.status ?? "draft",
        guided_answers: row.guided_answers ?? {},
        scenario_draft: row.scenario_draft ?? null,
        generation_source: row.generation_source ?? null,
        revision: row.revision ?? 0,
        // R5C-4A1 — every stored draft carries a semantic input epoch; the service refuses a
        // generation whose epoch cannot be resolved, so the seed supplies the baseline.
        generation_input_revision: row.generation_input_revision ?? 1,
        created_at: now,
        updated_at: now,
      };
    }
    return { id: row.id ?? `row-${++idSeq}`, ...row, created_at: now, updated_at: now };
  }

  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const b = {
      _op: "select" as "select" | "insert" | "update" | "delete",
      _filters: [] as Array<{ c: string; v: unknown }>,
      _patch: {} as Row,
      _insert: null as Row | null,
      _sorts: [] as Array<{ c: string; asc: boolean }>,
      _limit: null as number | null,
      _error: null as { code?: string; message: string } | null,
      select() {
        return b;
      },
      insert(r: Row) {
        b._op = "insert";
        b._insert = r;
        return b;
      },
      update(p: Row) {
        b._op = "update";
        b._patch = p;
        return b;
      },
      delete() {
        b._op = "delete";
        return b;
      },
      eq(c: string, v: unknown) {
        b._filters.push({ c, v });
        return b;
      },
      order(c: string, opts?: { ascending?: boolean }) {
        b._sorts.push({ c, asc: opts?.ascending ?? true });
        return b;
      },
      limit(n: number) {
        b._limit = n;
        return b;
      },
      returns() {
        return b;
      },
      _match(r: Row) {
        return b._filters.every((f) => r[f.c] === f.v);
      },
      // Simulate the R5B1A.1 partial UNIQUE INDEX: at most one NEW-AUTHORITY draft (guided_answers
      // .practiceSetupVersion present) per (owner_user_id, source_event_id). A duplicate INSERT
      // fails with SQLSTATE 23505 — exactly as Postgres would across Worker isolates.
      _violatesUniqueShell(row: Row): boolean {
        if (table !== "foundry_arena_scenario_drafts") return false;
        const g = row.guided_answers as Record<string, unknown> | undefined;
        if (g?.practiceSetupVersion == null) return false;
        return rows.some((r) => {
          const rg = r.guided_answers as Record<string, unknown> | undefined;
          return (
            rg?.practiceSetupVersion != null &&
            r.owner_user_id === row.owner_user_id &&
            r.source_event_id === row.source_event_id
          );
        });
      },
      _run(): Row[] {
        if (b._op === "insert" && b._insert) {
          const row = applyDefaults(table, b._insert);
          if (b._violatesUniqueShell(row)) {
            b._error = { code: "23505", message: "duplicate key value violates unique constraint" };
            return [];
          }
          rows.push(row);
          return [row];
        }
        if (b._op === "update") {
          const updated: Row[] = [];
          for (const r of rows) if (b._match(r)) {
            Object.assign(r, b._patch);
            updated.push(r);
          }
          return updated;
        }
        if (b._op === "delete") {
          const del = rows.filter((r) => b._match(r));
          tables[table] = rows.filter((r) => !b._match(r));
          return del;
        }
        let out = rows.filter((r) => b._match(r));
        if (b._sorts.length) {
          out = [...out].sort((x, y) => {
            for (const { c, asc } of b._sorts) {
              const cmp = String(x[c] ?? "").localeCompare(String(y[c] ?? "")) * (asc ? 1 : -1);
              if (cmp !== 0) return cmp;
            }
            return 0;
          });
        }
        if (b._limit != null) out = out.slice(0, b._limit);
        return out;
      },
      maybeSingle() {
        const res = b._run();
        return Promise.resolve({ data: res[0] ?? null, error: b._error });
      },
      single() {
        const res = b._run();
        if (b._error) return Promise.resolve({ data: null, error: b._error });
        return res[0]
          ? Promise.resolve({ data: res[0], error: null })
          : Promise.resolve({ data: null, error: { message: "no_row" } });
      },
      then(resolve: (v: { data: Row[]; error: unknown }) => unknown, reject?: (e: unknown) => unknown) {
        const data = b._run();
        return Promise.resolve({ data, error: b._error }).then(resolve, reject);
      },
    };
    return b;
  }

  tables.foundry_practice_generation_attempts = tables.foundry_practice_generation_attempts ?? [];
  return {
    admin: withGovernedRpc({ from }, tables.foundry_arena_scenario_drafts, tables.foundry_practice_generation_attempts) as unknown as SupabaseClient,
    tables,
  };
}

const OWNER = "owner-1";
const OTHER = "owner-2";

function seedOwnedEventWithModule() {
  return makeFakeAdmin({
    events: [
      { id: "evt-owned", owner_user_id: OWNER, title: "Safety First", status: "open" },
      { id: "evt-foreign", owner_user_id: OTHER, title: "Someone else", status: "open" },
      { id: "evt-nomodule", owner_user_id: OWNER, title: "Quick event", status: "open" },
    ],
    modules: [
      {
        event_id: "evt-owned",
        source_draft_id: "draft-77",
        module_version: 3,
        module_snapshot: {
          // Clean judgment topic (no mandatory-constraint domain) → judgment_only.
          problem: "A teammate proposes cutting a planned design review",
          observableBehavior: "Raise the concern before the shortcut",
          successEvidence: "The concern is recorded",
          audienceType: "leaders",
          learningNeeds: ["shared_standard"],
          arenaRecommended: true,
        },
      },
    ],
  });
}

const guided: GuidedAnswers = {
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "no time before the shift ends" },
};

describe("createArenaDraft — exact source version binding + ownership", () => {
  it("creates a canonical SHELL bound to the exact module version — no generation (R5A.2)", async () => {
    const { admin } = seedOwnedEventWithModule();
    const r = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.row.source_event_id).toBe("evt-owned"); // server-derived source linkage
      expect(r.value.row.source_module_version).toBe(3);
      expect(r.value.row.source_draft_id).toBe("draft-77");
      expect(r.value.row.guided_answers.hardestWhen).toEqual(guided.hardestWhen); // setup preserved
      expect(r.value.row.guided_answers.practiceSetupVersion).toBe(1); // lifecycle discriminator
      expect(r.value.row.scenario_draft).toBeNull(); // SHELL — no scenario until boundary + generation
      expect(r.value.row.generation_source).toBeNull();
    }
    expect(mockCreate).not.toHaveBeenCalled(); // no generator, no reviewer at create
  });

  it("refuses a foreign owner's event (source_not_owned)", async () => {
    const { admin } = seedOwnedEventWithModule();
    const r = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-foreign", guidedAnswers: guided, locale: "en" });
    expect(r).toEqual({ ok: false, reason: "source_not_owned" });
  });

  it("fails honestly for a missing event (source_not_found)", async () => {
    const { admin } = seedOwnedEventWithModule();
    const r = await createArenaDraft(admin, OWNER, { sourceEventId: "nope", guidedAnswers: guided, locale: "en" });
    expect(r).toEqual({ ok: false, reason: "source_not_found" });
  });

  it("fails honestly when the event has no published module (source_no_module)", async () => {
    const { admin } = seedOwnedEventWithModule();
    const r = await createArenaDraft(admin, OWNER, {
      sourceEventId: "evt-nomodule",
      guidedAnswers: guided,
      locale: "en",
    });
    expect(r).toEqual({ ok: false, reason: "source_no_module" });
  });
});

describe("read/persistence (owner-scoped)", () => {
  it("reloads a created draft for its owner, and hides it from another owner", async () => {
    const { admin } = seedOwnedEventWithModule();
    const created = await createArenaDraft(admin, OWNER, {
      sourceEventId: "evt-owned",
      guidedAnswers: guided,
      locale: "en",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.row.id;

    const mine = await getOwnerArenaDraft(admin, OWNER, id);
    expect(mine?.id).toBe(id);
    expect(mine?.scenario_draft).toBeNull(); // shell — no scenario yet

    const foreign = await getOwnerArenaDraft(admin, OTHER, id);
    expect(foreign).toBeNull();
  });

  it("lists an owner's drafts for an event (a shell has no derived title yet)", async () => {
    const { admin } = seedOwnedEventWithModule();
    await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    const list = await listOwnerArenaDraftsForEvent(admin, OWNER, "evt-owned");
    expect(list.length).toBe(1);
    expect(list[0].title).toBeNull(); // no scenario_draft → no title until generated
  });
});

const editedDraft: ArenaScenarioDraft = {
  title: "My edited title",
  opening: "An edited realistic opening.",
  primary: {
    choices: [
      { id: "primary_1", label: "Edited A" },
      { id: "primary_2", label: "Edited B" },
    ],
  },
  tradeoff: {
    escalationText: "Edited escalation.",
    choices: [
      { id: "tradeoff_1", label: "Edited hold" },
      { id: "tradeoff_2", label: "Edited defer" },
    ],
  },
  actionDecision: {
    prompt: "Edited prompt?",
    choices: [
      { id: "action_1", label: "Act now", isActionCommitment: true },
      { id: "action_2", label: "Wait", isActionCommitment: false },
    ],
  },
};

describe("saveArenaDraftEdits — honesty + validity", () => {
  it("saves a valid edited draft, bumps revision, marks it edited", async () => {
    const { admin } = seedOwnedEventWithModule();
    const created = await createArenaDraft(admin, OWNER, {
      sourceEventId: "evt-owned",
      guidedAnswers: guided,
      locale: "en",
    });
    if (!created.ok) throw new Error("setup failed");
    const id = created.value.row.id;

    const saved = await saveArenaDraftEdits(admin, OWNER, id, editedDraft);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.row.revision).toBe(1);
      expect(saved.value.row.generation_source).toBe("edited");
      expect(saved.value.row.scenario_draft?.title).toBe("My edited title");
    }

    // reload reflects the saved edit
    const reloaded = await getOwnerArenaDraft(admin, OWNER, id);
    expect(reloaded?.scenario_draft?.title).toBe("My edited title");
  });

  it("refuses an INVALID edited structure (never silently saved)", async () => {
    const { admin } = seedOwnedEventWithModule();
    const created = await createArenaDraft(admin, OWNER, {
      sourceEventId: "evt-owned",
      guidedAnswers: guided,
      locale: "en",
    });
    if (!created.ok) throw new Error("setup failed");
    const broken = { ...editedDraft, primary: { choices: [] } };
    const r = await saveArenaDraftEdits(admin, OWNER, created.value.row.id, broken);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_structure");
      expect((r.errors ?? []).length).toBeGreaterThan(0);
    }
  });

  it("returns not_found for a foreign/missing draft", async () => {
    const { admin } = seedOwnedEventWithModule();
    const r = await saveArenaDraftEdits(admin, OTHER, "does-not-exist", editedDraft);
    expect(r).toMatchObject({ ok: false, reason: "arena_draft_not_found" });
  });
});

describe("regenerateArenaDraft — reuses stored answers, keeps the source", () => {
  it("a new-authority shell blocks regeneration until a boundary is confirmed, then generates", async () => {
    const { admin } = seedOwnedEventWithModule();
    const created = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    if (!created.ok) throw new Error("setup failed");
    const id = created.value.row.id;

    // New shell has the discriminator but no boundary → generation is blocked.
    expect(await regenerateArenaDraft(admin, OWNER, id, "en")).toMatchObject({ ok: false, reason: "boundary_confirmation_required" });

    // Confirm a judgment (no-rule) boundary, then generation proceeds by draft id.
    const saved = await saveDraftBoundary(admin, OWNER, id, { mode: "judgment", confirmed: true, constraints: [] }, created.value.row.revision);
    expect(saved.ok).toBe(true);
    const again = await regenerateArenaDraft(admin, OWNER, id, "en");
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.row.scenario_draft?.practiceBoundary?.mode).toBe("judgment"); // canonical boundary stamped
      expect(again.value.row.source_module_version).toBe(3); // source never re-pointed
    }
  });
});

// ---------------------------------------------------------------------------
// Slice 3.2I-R5A — canonical boundary persistence + generation trust boundary
// ---------------------------------------------------------------------------

const B_JUDGMENT: PracticeBoundary = { mode: "judgment", confirmed: true, constraints: [] };
const B_CON = (statements: string[]): PracticeBoundary => ({
  mode: "judgment_with_constraints",
  confirmed: true,
  constraints: statements.map((s, i) => ({ id: `c${i + 1}`, statement: s, provenance: "manager_entered" })),
});

function seedDraft(over: Row = {}) {
  const draftRow: Row = {
    id: "d1", owner_user_id: OWNER, source_event_id: "evt-owned", source_module_version: 3, source_draft_id: "draft-77",
    status: "draft", guided_answers: { ...guided }, scenario_draft: AI_DRAFT, generation_source: "ai", revision: 2,
    // R5C-4A1 — distinct from `revision`: the semantic input epoch, which regeneration requires.
    generation_input_revision: 1,
    created_at: "t", updated_at: "t", ...over,
  };
  const admin = makeFakeAdmin({
    events: [{ id: "evt-owned", owner_user_id: OWNER, title: "T", status: "open" }],
    modules: [{ event_id: "evt-owned", source_draft_id: "draft-77", module_version: 3, module_snapshot: { problem: "A teammate proposes cutting a review", observableBehavior: "Raise the concern", learningNeeds: ["shared_standard"] } }],
    drafts: [draftRow],
  });
  return admin;
}

describe("saveDraftBoundary — canonical, authorized, stale-guarded, invalidating", () => {
  it("saves a valid boundary and bumps revision (canonical response, not the client echo)", async () => {
    const { admin, tables } = seedDraft();
    const r = await saveDraftBoundary(admin, OWNER, "d1", B_JUDGMENT, 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.row.guided_answers.practiceBoundary).toEqual(B_JUDGMENT);
      expect(r.value.row.revision).toBe(3);
    }
    expect((tables.foundry_arena_scenario_drafts[0].guided_answers as Record<string, unknown>).practiceBoundary).toBeTruthy();
  });

  it("rejects an invalid boundary", async () => {
    const { admin } = seedDraft();
    const r = await saveDraftBoundary(admin, OWNER, "d1", { mode: "nope", confirmed: true, constraints: [] }, 2);
    expect(r).toMatchObject({ ok: false });
  });

  it("rejects a stale expected revision (never overwrites)", async () => {
    const { admin } = seedDraft();
    const r = await saveDraftBoundary(admin, OWNER, "d1", B_JUDGMENT, 1);
    expect(r).toMatchObject({ ok: false, reason: "stale_revision" });
  });

  it("rejects another owner's draft (non-disclosing not_found)", async () => {
    const { admin } = seedDraft();
    const r = await saveDraftBoundary(admin, OTHER, "d1", B_JUDGMENT, 2);
    expect(r).toMatchObject({ ok: false, reason: "arena_draft_not_found" });
  });

  it("a MEANINGFUL boundary change invalidates the unapproved generated scenario", async () => {
    const { admin, tables } = seedDraft({ guided_answers: { ...guided, practiceBoundary: B_CON(["Verify identity before treatment"]) } });
    const r = await saveDraftBoundary(admin, OWNER, "d1", B_CON(["Verify identity before treatment", "Report the incident"]), 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.invalidated).toBe(true);
    expect(tables.foundry_arena_scenario_drafts[0].scenario_draft).toBeNull(); // branches under old boundary cleared
  });

  it("an equivalent normalized re-save does NOT invalidate", async () => {
    const { admin, tables } = seedDraft({ guided_answers: { ...guided, practiceBoundary: B_CON(["Verify identity before treatment"]) } });
    const same: PracticeBoundary = { mode: "judgment_with_constraints", confirmed: true, constraints: [{ id: "c1", statement: "  verify identity BEFORE treatment ", provenance: "suggested_from_problem" }] };
    const r = await saveDraftBoundary(admin, OWNER, "d1", same, 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.invalidated).toBe(false);
    expect(tables.foundry_arena_scenario_drafts[0].scenario_draft).not.toBeNull(); // scenario preserved
  });
});

describe("regenerateArenaDraft — reads ONLY the canonical server-stored boundary (trust boundary)", () => {
  it("passes the stored boundary to generation and stamps it onto the scenario", async () => {
    mockCreate.mockImplementation(async (params: { messages?: Array<{ content?: string }> }) =>
    isReviewRequest(params)
      ? { choices: [{ message: { content: JSON.stringify(acceptReview(AI_DRAFT)) } }] }
      : { choices: [{ message: { content: providerJson(AI_DRAFT) } }] });
    const { admin } = seedDraft({ guided_answers: { ...guided, practiceBoundary: B_JUDGMENT }, scenario_draft: null, revision: 2 });
    const r = await regenerateArenaDraft(admin, OWNER, "d1", "en");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.row.scenario_draft?.practiceBoundary).toEqual(B_JUDGMENT);
    expect(mockCreate).toHaveBeenCalledTimes(2); // R2.18 — generation + quality review (review is no longer conditional on constraints)
  });
});

describe("initial create — shell-first trust boundary (R5A.2)", () => {
  it("createArenaDraft never accepts a client boundary and generates nothing (shell); regenerate then requires confirmation", async () => {
    const { admin } = makeFakeAdmin({
      events: [{ id: "evt-owned", owner_user_id: OWNER, title: "T", status: "open" }],
      modules: [{ event_id: "evt-owned", source_draft_id: "draft-77", module_version: 3, module_snapshot: { problem: "Two patient identifiers must be verified before treatment", observableBehavior: "Verify before every dose", learningNeeds: ["decide"] } }],
    });
    // createArenaDraft's input has no boundary field — a client cannot inject one. It makes a
    // shell only (no provider call); generation by draft id then requires a confirmed boundary.
    const r = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.row.scenario_draft).toBeNull();
    expect(r.value.row.guided_answers.practiceSetupVersion).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await regenerateArenaDraft(admin, OWNER, r.value.row.id, "en")).toMatchObject({ ok: false, reason: "boundary_confirmation_required" });
  });
});

describe("knowledge_check end-to-end (R5A.1)", () => {
  it("save clears the scenario; regenerate declines fixed_answer_knowledge; provider never called", async () => {
    const { admin, tables } = seedDraft({ scenario_draft: AI_DRAFT, revision: 2 });
    // Manager confirms this is a knowledge/required-standard check, not a judgment Practice.
    const saved = await saveDraftBoundary(admin, OWNER, "d1", { mode: "knowledge_check", confirmed: true, constraints: [] }, 2);
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.invalidated).toBe(true);
    expect(tables.foundry_arena_scenario_drafts[0].scenario_draft).toBeNull(); // generated scenario cleared
    expect((tables.foundry_arena_scenario_drafts[0].guided_answers as Record<string, unknown>).hardestWhen).toBeTruthy(); // unrelated answers preserved

    mockCreate.mockClear();
    const re = await regenerateArenaDraft(admin, OWNER, "d1", "en");
    expect(re).toMatchObject({ ok: false, reason: "fixed_answer_knowledge" });
    expect(mockCreate).not.toHaveBeenCalled(); // no generator, no reviewer
  });
});

describe("createOrOpenArenaDraftShell — idempotent create-or-open (R5B1A)", () => {
  it("no existing draft → creates exactly one shell (opened=false)", async () => {
    const { admin, tables } = seedOwnedEventWithModule();
    const r = await createOrOpenArenaDraftShell(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.opened).toBe(false);
      expect(r.value.row.scenario_draft).toBeNull();
      expect(r.value.row.guided_answers.practiceSetupVersion).toBe(1);
    }
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("existing shell → REOPENS it, never a duplicate (opened=true)", async () => {
    const { admin, tables } = seedOwnedEventWithModule();
    const first = await createOrOpenArenaDraftShell(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    const second = await createOrOpenArenaDraftShell(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.opened).toBe(true);
      expect(second.value.row.id).toBe(first.value.row.id); // same canonical shell
    }
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1); // no duplicate
  });

  it("reopens an existing GENERATED draft rather than duplicating", async () => {
    const { admin, tables } = seedOwnedEventWithModule();
    // Pre-seed a generated draft for the event.
    tables.foundry_arena_scenario_drafts.push({ id: "gen-1", owner_user_id: OWNER, source_event_id: "evt-owned", source_module_version: 3, source_draft_id: "draft-77", status: "draft", guided_answers: { ...guided, practiceSetupVersion: 1 }, scenario_draft: AI_DRAFT, generation_source: "ai", revision: 4, generation_input_revision: 1, created_at: "t", updated_at: "t2" });
    const r = await createOrOpenArenaDraftShell(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.opened).toBe(true);
      expect(r.value.row.id).toBe("gen-1");
      expect(r.value.row.scenario_draft).not.toBeNull();
    }
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Slice 3.2I-R5B1A.1 — ATOMIC one-shell contract. The fake enforces the partial UNIQUE INDEX
// (one new-authority draft per owner+event), so a duplicate INSERT fails with 23505 exactly as
// Postgres would. These prove the SERVICE ALGORITHM converges on that DB invariant.
// NOTE (proof gap): a mocked DB cannot prove real cross-Worker Postgres atomicity — that is
// guaranteed by migration 20260803000000 once APPLIED. See the slice report.
// ---------------------------------------------------------------------------

function seedTwoTrainings() {
  const snap = { problem: "A teammate proposes cutting a planned design review", observableBehavior: "Raise the concern before the shortcut", learningNeeds: ["shared_standard"] };
  return makeFakeAdmin({
    events: [
      { id: "evt-a", owner_user_id: OWNER, title: "A", status: "open" },
      { id: "evt-b", owner_user_id: OWNER, title: "B", status: "open" },
      { id: "evt-o", owner_user_id: OTHER, title: "O", status: "open" },
    ],
    modules: [
      { event_id: "evt-a", source_draft_id: "d-a", module_version: 1, module_snapshot: snap },
      { event_id: "evt-b", source_draft_id: "d-b", module_version: 1, module_snapshot: snap },
      { event_id: "evt-o", source_draft_id: "d-o", module_version: 1, module_snapshot: snap },
    ],
  });
}

describe("createOrOpenArenaDraftShell — ATOMIC one-shell contract (R5B1A.1)", () => {
  const open = (admin: SupabaseClient, owner: string, eventId: string) =>
    createOrOpenArenaDraftShell(admin, owner, { sourceEventId: eventId, guidedAnswers: guided, locale: "en" });

  it("N concurrent create-or-opens for ONE relationship converge to one row + one id", async () => {
    const { admin, tables } = seedOwnedEventWithModule();
    const results = await Promise.all(Array.from({ length: 8 }, () => open(admin, OWNER, "evt-owned")));
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.value.row.id : "x")));
    expect(ids.size).toBe(1); // every caller received the SAME canonical draft id
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1); // exactly one authoritative row, zero orphans
    // Exactly one caller CREATED the row; the DB rejected every other insert (23505) → they opened it.
    expect(results.filter((r) => r.ok && !r.value.opened).length).toBe(1);
  });

  it("the DB rejects a second authoritative insert for the same relationship (23505 → duplicate_relationship)", async () => {
    const { admin, tables } = seedOwnedEventWithModule();
    const first = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    const second = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, reason: "duplicate_relationship" });
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1); // the loser never persisted a row
  });

  it("response-loss retry converges to the SAME id (no duplicate)", async () => {
    const { admin, tables } = seedOwnedEventWithModule();
    const first = await open(admin, OWNER, "evt-owned"); // row created; imagine the response was lost
    const retry = await open(admin, OWNER, "evt-owned"); // client retries
    expect(first.ok && retry.ok).toBe(true);
    if (first.ok && retry.ok) {
      expect(retry.value.opened).toBe(true);
      expect(retry.value.row.id).toBe(first.value.row.id);
    }
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1);
  });

  it("different trainings create SEPARATE shells (uniqueness does not collapse unrelated relationships)", async () => {
    const { admin, tables } = seedTwoTrainings();
    const a = await open(admin, OWNER, "evt-a");
    const b = await open(admin, OWNER, "evt-b");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.row.id).not.toBe(b.value.row.id);
    expect(tables.foundry_arena_scenario_drafts.length).toBe(2);
  });

  it("different owners create SEPARATE shells", async () => {
    const { admin, tables } = seedTwoTrainings();
    const mine = await open(admin, OWNER, "evt-a");
    const theirs = await open(admin, OTHER, "evt-o");
    expect(mine.ok && theirs.ok).toBe(true);
    expect(tables.foundry_arena_scenario_drafts.length).toBe(2);
  });

  it("an unauthorized owner cannot open another owner's relationship (no row created)", async () => {
    const { admin, tables } = seedTwoTrainings();
    const r = await open(admin, OTHER, "evt-a"); // evt-a belongs to OWNER
    expect(r).toMatchObject({ ok: false, reason: "source_not_owned" });
    expect(tables.foundry_arena_scenario_drafts.length).toBe(0);
  });

  it("a legitimate in-place revision does NOT trip the one-shell invariant", async () => {
    const { admin, tables } = seedTwoTrainings();
    const created = await open(admin, OWNER, "evt-a");
    if (!created.ok) throw new Error("setup failed");
    // Confirm a boundary + generate: these UPDATE the same row (revisions), never insert a new one.
    const saved = await saveDraftBoundary(admin, OWNER, created.value.row.id, { mode: "judgment", confirmed: true, constraints: [] }, created.value.row.revision);
    expect(saved.ok).toBe(true);
    const regen = await regenerateArenaDraft(admin, OWNER, created.value.row.id, "en");
    expect(regen.ok).toBe(true);
    expect(tables.foundry_arena_scenario_drafts.length).toBe(1); // still exactly one row
  });
});

// ---------------------------------------------------------------------------
// R2.23D — Host ACTIVE-BOUNDARY scoping. Owner-scoped, stale-guarded, and the server never
// selects, trims or reorders: an out-of-range or unknown selection is rejected with its exact
// reason so the Host corrects it deliberately.
// ---------------------------------------------------------------------------

const B5 = B_CON(["Verify identity first", "Never disclose private data", "Report incidents in shift", "Approve overtime first", "Client data stays managed"]);
const ID = (n: number) => B5.constraints[n].id;

describe("saveDraftBoundaryScope — Host active-boundary selection (R2.23D)", () => {
  const seeded = (over: Record<string, unknown> = {}) =>
    seedDraft({ guided_answers: { ...guided, practiceBoundary: B5, ...over } } as never);

  it("16/17. persists the EXACT selected ids and bumps revision", async () => {
    const { admin, tables } = seeded();
    const r = await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(1), ID(3)], 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.row.guided_answers.practiceBoundaryScope?.activeIds).toEqual([ID(1), ID(3)]);
      expect(r.value.row.guided_answers.practiceBoundaryScope?.confirmed).toBe(true);
      expect(r.value.row.revision).toBe(3);
    }
    // 22/26. The available boundaries are untouched — nothing summarised, reordered or dropped.
    const stored = tables.foundry_arena_scenario_drafts[0].guided_answers as Record<string, unknown>;
    expect(stored.practiceBoundary).toEqual(B5);
  });

  it("23. it rides inside guided_answers beside practiceSetupVersion — NO migration", async () => {
    const { admin, tables } = seeded();
    await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(0)], 2);
    const stored = tables.foundry_arena_scenario_drafts[0].guided_answers as Record<string, unknown>;
    expect(Object.keys(stored)).toContain("practiceBoundaryScope");
    expect(Object.keys(stored)).toContain("practiceBoundary");
    // The row's own columns are unchanged — only the JSONB value moved.
    expect(Object.keys(tables.foundry_arena_scenario_drafts[0])).not.toContain("boundary_scope");
  });

  it("15. more than three is REJECTED, never trimmed to three", async () => {
    const { admin, tables } = seeded();
    const r = await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(0), ID(1), ID(2), ID(3)], 2);
    expect(r).toMatchObject({ ok: false, reason: "too_many_active_boundaries" });
    expect((tables.foundry_arena_scenario_drafts[0].guided_answers as Record<string, unknown>).practiceBoundaryScope).toBeUndefined();
  });

  it("16b. an unknown id, a non-array body and an empty selection are each rejected", async () => {
    const { admin } = seeded();
    expect(await saveDraftBoundaryScope(admin, OWNER, "d1", ["c9_invented"], 2)).toMatchObject({ ok: false, reason: "unknown_active_boundary" });
    expect(await saveDraftBoundaryScope(admin, OWNER, "d1", "not-an-array", 2)).toMatchObject({ ok: false, reason: "unknown_active_boundary" });
    expect(await saveDraftBoundaryScope(admin, OWNER, "d1", [], 2)).toMatchObject({ ok: false, reason: "missing_required_active_boundary" });
  });

  it("scoping requires a CONFIRMED boundary to scope", async () => {
    const { admin } = seedDraft();
    expect(await saveDraftBoundaryScope(admin, OWNER, "d1", ["c1"], 2)).toMatchObject({ ok: false, reason: "boundary_confirmation_required" });
  });

  it("26/38-41. only the owner may scope — another Host and a stale revision are both refused", async () => {
    const { admin } = seeded();
    expect(await saveDraftBoundaryScope(admin, OTHER, "d1", [ID(0)], 2)).toMatchObject({ ok: false, reason: "arena_draft_not_found" });
    expect(await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(0)], 1)).toMatchObject({ ok: false, reason: "stale_revision" });
  });

  it("20. a changed selection invalidates the unapproved generated scenario", async () => {
    const { admin, tables } = seeded();
    await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(0)], 2);
    const r = await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(2)], 3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.invalidated).toBe(true);
    expect(tables.foundry_arena_scenario_drafts[0].scenario_draft).toBeNull();
  });

  it("23/24/25. editing the BOUNDARY afterwards invalidates the confirmation without losing the choice", async () => {
    const { admin } = seeded();
    await saveDraftBoundaryScope(admin, OWNER, "d1", [ID(0), ID(1)], 2);
    // The Manager rewords one rule. The prior selection is preserved but no longer confirmed.
    const reworded = { ...B5, constraints: B5.constraints.map((c, i) => (i === 4 ? { ...c, statement: "Client data stays in the managed environment" } : c)) };
    const r = await saveDraftBoundary(admin, OWNER, "d1", reworded, 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.row.guided_answers.practiceBoundaryScope?.confirmed).toBe(false);
      expect(r.value.row.guided_answers.practiceBoundaryScope?.activeIds).toEqual([ID(0), ID(1)]);
    }
  });
});
