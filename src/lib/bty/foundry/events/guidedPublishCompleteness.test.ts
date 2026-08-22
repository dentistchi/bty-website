import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2P-R2.1 — PROGRAM COMPLETENESS IS A SERVER INVARIANT.
 *
 * A v2 revision inherits its parent's answers verbatim, journey included, so the pilot's v2
 * arrived carrying v1's five grounded elements. `isJourneyApprovable` said TRUE while three of
 * the seven kinds the Host's own intent requires were absent — and no server gate looked.
 * `missingProgramKinds` lived only in client components, which suppressed it precisely when
 * the journey was approvable.
 *
 * GRANDFATHERING is the product decision these fixtures encode: an already-published legacy
 * version stays valid; a FUTURE publish must satisfy the CURRENT required kinds.
 */
const createTrainingEvent = vi.fn();
const getOwnerRoomSnapshot = vi.fn();
vi.mock("./foundryTrainingService", () => ({
  createTrainingEvent: (...a: unknown[]) => createTrainingEvent(...a),
}));
vi.mock("./foundryDocumentService", () => ({
  getOwnerRoomSnapshot: (...a: unknown[]) => getOwnerRoomSnapshot(...a),
}));

import { publishDraft } from "./foundryPublishService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeAdmin(tables: Tables) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const q: Record<string, unknown> = {
      _op: "select",
      _filters: [] as Array<{ c: string; v: unknown }>,
      _patch: {} as Row,
      _insert: null as Row | null,
      insert(this: Record<string, unknown>, row: Row) { this._op = "insert"; this._insert = row; return this; },
      update(this: Record<string, unknown>, patch: Row) { this._op = "update"; this._patch = patch; return this; },
      delete(this: Record<string, unknown>) { this._op = "delete"; return this; },
      select() { return this; },
      eq(this: { _filters: Array<{ c: string; v: unknown }> }, c: string, v: unknown) { this._filters.push({ c, v }); return this; },
      in() { return this; },
      order() { return this; },
      limit() { return this; },
      _matches(this: { _filters: Array<{ c: string; v: unknown }> }) {
        return rows.filter((r) => this._filters.every((f) => r[f.c] === f.v));
      },
      single(this: Record<string, unknown>) {
        if (this._op === "insert" && this._insert) {
          const row = { ...(this._insert as Row) };
          if (table === "foundry_events" && !row.id) row.id = "ev-new";
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      maybeSingle(this: Record<string, unknown>) {
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      returns(this: Record<string, unknown>) {
        return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null });
      },
      then(this: Record<string, unknown>, onF: (v: { data: unknown; error: unknown }) => unknown) {
        if (this._op === "insert" && this._insert) { rows.push({ ...(this._insert as Row) }); return Promise.resolve({ data: null, error: null }).then(onF); }
        if (this._op === "update") { (this._matches as () => Row[])().forEach((r) => Object.assign(r, this._patch)); return Promise.resolve({ data: null, error: null }).then(onF); }
        return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null }).then(onF);
      },
    };
    return q;
  }
  return { from, rpc: () => Promise.resolve({ data: null, error: null }) } as unknown as SupabaseClient;
}

const OWNER = "owner-1";

/** The live pilot's Host intent, verbatim. `decide` is absent — action_decision is NOT required. */
const HOST_ANSWERS = {
  // Slice 3.2R-R2.1 — a complete draft carries a NAME distinct from its problem.
  title: "Read Back Before Sign-Off",
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  /*
    R4-R7A NARROWS 3.2P-R2.1, and this fixture is where the two meet.

    3.2P-R2.1 established that a draft with NO journey publishes under existing semantics —
    correct, and preserved. What it did not separate is that this fixture ALSO declared
    `followUpDays: 7`, so it was not only "legacy content without a journey", it was a Host
    asking BTY to check back. R4-R7A refuses that combination, because the Host was promised
    something the training cannot deliver and the repair is one control away.

    So the invariant is now stated precisely: no journey AND no declared behaviour intent →
    publish unchanged. The fixture declares no follow-up, which is what "legacy content"
    actually means here.
  */
  followUpDays: 0,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/dQw4w9WgXcQ",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the owner and deadline?",
  recurringMoment: "During morning huddles",
  /*
    Slice R4-R1A — a VALID behaviour. This fixture previously carried the live pilot's
    question, inherited as context rather than as the contract under test: these cases are
    about SECTION COMPLETENESS (`program_sections_missing`), and since R4-R1A a question is
    refused earlier, at step 4, which would mask every one of them. The question itself is
    still exercised — see the R4-R1A case at the end of this file.
  */
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  capabilityCandidate: "Accountability",
};

const el = (kind: string, content: string) => ({
  id: `el_${kind}`, kind, content,
  grounding: [{ sourceType: "host_statement", field: "problem" }],
  confirmationStatus: "grounded",
});

/** The EXACT five-element shape a v2 inherits from a legacy parent. All grounded. */
const LEGACY_FIVE = {
  version: 1,
  displayTitle: "End Every Huddle With an Owner and Deadline",
  displayTitleStatus: "grounded",
  elements: [
    el("why_it_matters", "During morning huddles, problems are reported but nobody is named."),
    el("observable_standard", "At the next huddle, what exact words will you use?"),
    el("reflection", "In your own words, what is the most important standard from this training?"),
    el("evidence", "The huddle note records one owner and one deadline for every agreed action."),
    el("completion_check", "What specific phrases will you use in the next huddle?"),
  ],
};

/** The same journey completed. Elements follow JOURNEY_KIND_ORDER — the structural validator
 *  refuses out-of-order elements, so a completed journey is built in canonical order, not by
 *  appending to the legacy five. */
const COMPLETE_SEVEN = {
  ...LEGACY_FIVE,
  elements: [
    el("why_it_matters", "During morning huddles, problems are reported but nobody is named."),
    el("observable_standard", "The huddle leader names one owner and one deadline for every agreed action."),
    el("scenario", "The huddle is running late and people are already standing to leave."),
    el("reflection", "In your own words, what is the most important standard from this training?"),
    el("field_application", "At the next morning huddle, name one owner and one deadline for every agreed action."),
    el("evidence", "The huddle note records one owner and one deadline for every agreed action."),
    el("completion_check", "What specific phrases will you use in the next huddle?"),
    el("follow_up", "In seven days you will be asked what you actually said at the huddle."),
  ],
};

const draft = (answers: Record<string, unknown>, over: Row = {}): Row => ({
  id: "d-1", owner_user_id: OWNER, status: "draft", module_version: 2,
  approved_at: null, published_at: null, program_id: "prog-1", parent_module_id: "d-0",
  answers, ...over,
});

const SNAP = { event: { id: "ev-new", title: "T", status: "open", join_token: "tok", content_type: "youtube" }, participants: [], joined_count: 0, completed_count: 0 };

beforeEach(() => {
  createTrainingEvent.mockReset();
  getOwnerRoomSnapshot.mockReset();
  getOwnerRoomSnapshot.mockResolvedValue(SNAP);
  createTrainingEvent.mockResolvedValue({ ok: true, value: { event: { id: "ev-new" } } });
});

describe("[3.2P-R2.1] B — an approvable LEGACY journey no longer authorises a publish", () => {
  it("REFUSES: journey approvable, three required kinds absent", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ ...HOST_ANSWERS, realityGroundedJourneyV1: LEGACY_FIVE })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("program_sections_missing");
    // Nothing was created, and the draft was not advanced.
    expect(createTrainingEvent).not.toHaveBeenCalled();
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
    expect(tables.foundry_event_module).toHaveLength(0);
  });
});

describe("[3.2P-R2.1] C — a COMPLETE journey proceeds", () => {
  it("all seven kinds present → passes this gate and publishes", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ ...HOST_ANSWERS, realityGroundedJourneyV1: COMPLETE_SEVEN })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok, `refused: ${r.ok ? "" : r.reason}`).toBe(true);
    expect(createTrainingEvent).toHaveBeenCalledOnce();
  });
});

describe("[3.2P-R2.1] D/E — required kinds come from the HOST's intent, never a maximal ladder", () => {
  it("D — no `decide` → action_decision NOT required, seven kinds suffice", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ ...HOST_ANSWERS, realityGroundedJourneyV1: COMPLETE_SEVEN })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(true);
  });

  it("E — with `decide`, the SAME seven-element journey is refused for action_decision", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({
        ...HOST_ANSWERS,
        learningNeeds: ["shared_standard", "practice", "decide"],
        realityGroundedJourneyV1: COMPLETE_SEVEN,
      })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("program_sections_missing");
  });
});

describe("[3.2P-R2.1] F — non-Guided legacy content is untouched", () => {
  it("a draft with NO journey publishes under the existing semantics", async () => {
    // No `realityGroundedJourneyV1` at all — the predicate is journey-enablement, not
    // module_version and not the presence of a program_id (which nearly every draft has).
    const tables: Tables = {
      foundry_module_drafts: [draft({ ...HOST_ANSWERS }, { module_version: 1, parent_module_id: null })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok, `refused: ${r.ok ? "" : r.reason}`).toBe(true);
  });
});

describe("[3.2P-R2.1] A/G — grandfathering, and no way round the gate", () => {
  it("A — an ALREADY-PUBLISHED legacy version stays published and readable", async () => {
    /*
      v1 of the live pilot is published today with scenario, field_application and follow_up
      all missing. It must not be retroactively invalidated: a re-publish is idempotent and
      returns the existing event WITHOUT re-running the completeness gate.
    */
    const tables: Tables = {
      foundry_module_drafts: [draft(
        { ...HOST_ANSWERS, realityGroundedJourneyV1: LEGACY_FIVE },
        { status: "published", approved_at: "t", published_at: "t", module_version: 1 },
      )],
      foundry_event_module: [{ event_id: "ev-old", source_draft_id: "d-1", module_version: 1, module_snapshot: {} }],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok, `a published legacy version must stay valid`).toBe(true);
    if (r.ok) expect(r.value.reused).toBe(true);
    expect(tables.foundry_module_drafts[0].status).toBe("published");
  });

  it("G — the server refuses regardless of what a client believes", async () => {
    // No client state reaches this function: the same request that the Review screen would
    // have blocked is refused when sent straight at the server.
    const tables: Tables = {
      foundry_module_drafts: [draft({ ...HOST_ANSWERS, realityGroundedJourneyV1: LEGACY_FIVE })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("program_sections_missing");
  });

  it("an UNPUBLISHED draft is not grandfathered by being module_version 1", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft(
        { ...HOST_ANSWERS, realityGroundedJourneyV1: LEGACY_FIVE },
        { module_version: 1, parent_module_id: null },
      )],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("program_sections_missing");
  });
});

/**
 * SLICE R4-R1A — A QUESTION CANNOT BE PUBLISHED AS A BEHAVIOUR.
 *
 * The live pilot's stored `observableBehavior` is a question, and until R4-R1A the Guided
 * Builder had presence-only validation on that field: nothing warned, the draft published, and
 * the observation surface then asked a colleague whether they had personally seen or heard it.
 * `stepBlockers` is what `module-publish` consults, so the refusal lands at publish too.
 */
describe("[R4-R1A] the publish gate refuses a question as the observable behaviour", () => {
  const LIVE_QUESTION =
    "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?";

  it("REFUSES a draft whose behaviour is the live pilot's question", async () => {
    const tables: Tables = {
      foundry_module_drafts: [
        draft({ ...HOST_ANSWERS, observableBehavior: LIVE_QUESTION, realityGroundedJourneyV1: COMPLETE_SEVEN }),
      ],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("behavior_is_a_question");
    // Nothing published: a bad standard must never become observation authority.
    expect(createTrainingEvent).not.toHaveBeenCalled();
    expect(tables.foundry_event_module).toHaveLength(0);
  });

  it("ACCEPTS the good control — the gate is shape, not strictness", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ ...HOST_ANSWERS, realityGroundedJourneyV1: COMPLETE_SEVEN })],
      foundry_event_module: [],
    };
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, "d-1", "en");
    expect(r.ok).toBe(true);
  });
});
