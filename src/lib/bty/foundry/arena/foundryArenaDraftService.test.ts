import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  getOwnerArenaDraft,
  listOwnerArenaDraftsForEvent,
  regenerateArenaDraft,
  saveArenaDraftEdits,
} from "./foundryArenaDraftService";
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

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(AI_DRAFT) } }] });
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
      _sort: null as { c: string; asc: boolean } | null,
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
        b._sort = { c, asc: opts?.ascending ?? true };
        return b;
      },
      returns() {
        return b;
      },
      _match(r: Row) {
        return b._filters.every((f) => r[f.c] === f.v);
      },
      _run(): Row[] {
        if (b._op === "insert" && b._insert) {
          const row = applyDefaults(table, b._insert);
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
        if (b._sort) {
          const { c, asc } = b._sort;
          out = [...out].sort((x, y) => String(x[c] ?? "").localeCompare(String(y[c] ?? "")) * (asc ? 1 : -1));
        }
        return out;
      },
      maybeSingle() {
        return Promise.resolve({ data: b._run()[0] ?? null, error: null });
      },
      single() {
        const res = b._run();
        return res[0]
          ? Promise.resolve({ data: res[0], error: null })
          : Promise.resolve({ data: null, error: { message: "no_row" } });
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve({ data: b._run(), error: null }).then(resolve, reject);
      },
    };
    return b;
  }

  return { admin: { from } as unknown as SupabaseClient, tables };
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
          problem: "People skip the safety check",
          observableBehavior: "Raise the risk before the shortcut",
          successEvidence: "The check is logged",
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
  it("binds the EXACT module version (event id + version + source draft id) at create", async () => {
    const { admin } = seedOwnedEventWithModule();
    const r = await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.row.source_event_id).toBe("evt-owned");
      expect(r.value.row.source_module_version).toBe(3);
      expect(r.value.row.source_draft_id).toBe("draft-77");
      expect(r.value.row.guided_answers).toEqual(guided);
      expect(r.value.row.scenario_draft).not.toBeNull();
      // live-model runtime → source "ai"
      expect(r.value.row.generation_source).toBe("ai");
    }
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
    expect(mine?.scenario_draft).not.toBeNull();

    const foreign = await getOwnerArenaDraft(admin, OTHER, id);
    expect(foreign).toBeNull();
  });

  it("lists an owner's drafts for an event with a derived title", async () => {
    const { admin } = seedOwnedEventWithModule();
    await createArenaDraft(admin, OWNER, { sourceEventId: "evt-owned", guidedAnswers: guided, locale: "en" });
    const list = await listOwnerArenaDraftsForEvent(admin, OWNER, "evt-owned");
    expect(list.length).toBe(1);
    expect(typeof list[0].title).toBe("string");
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
  it("regenerates from the same guided answers and source, bumping revision", async () => {
    const { admin } = seedOwnedEventWithModule();
    const created = await createArenaDraft(admin, OWNER, {
      sourceEventId: "evt-owned",
      guidedAnswers: guided,
      locale: "en",
    });
    if (!created.ok) throw new Error("setup failed");
    const id = created.value.row.id;

    const again = await regenerateArenaDraft(admin, OWNER, id, "en");
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.row.revision).toBe(1);
      expect(again.value.row.guided_answers).toEqual(guided); // answers never lost
      expect(again.value.row.source_module_version).toBe(3); // source never re-pointed
    }
  });
});
