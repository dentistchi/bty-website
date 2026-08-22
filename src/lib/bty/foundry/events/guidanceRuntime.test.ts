import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * R4-R2G — GUIDANCE RUNTIME. Publish → frozen content → learner declaration → completion → XP.
 *
 * The heavy collaborators are mocked (the canonical XP award, the follow-up obligation, the
 * apply window, the assignment claim), so the spine under test is exactly the part this slice
 * wrote: which event row is created, what is frozen where, which stamp is written, what refuses
 * before the declaration exists, and — the one that matters most — what the DECLARATION alone
 * does NOT cause.
 */

const awardTrainingCoreXp = vi.fn();
const materializeFollowupObligation = vi.fn();
const materializeApplyWindow = vi.fn();
const claimAssignmentForParticipant = vi.fn();
const linkLearnerIdentity = vi.fn();
const resolvePublic = vi.fn();
const readEventJourney = vi.fn();
const createTrainingEvent = vi.fn();
const getOwnerRoomSnapshot = vi.fn();

vi.mock("./foundryTrainingService", () => ({
  resolvePublic: (...a: unknown[]) => resolvePublic(...a),
  awardTrainingCoreXp: (...a: unknown[]) => awardTrainingCoreXp(...a),
  outcomeToXpStatus: (o: string) => (o === "awarded" ? "awarded" : "none"),
  linkLearnerIdentity: (...a: unknown[]) => linkLearnerIdentity(...a),
  readEventJourney: (...a: unknown[]) => readEventJourney(...a),
  /*
    R4-R3B1 — the guidance snapshot now also carries the frozen follow-up checkpoint, so this
    partial module mock has to name it. Stubbed to null: these tests are about the exposure
    declaration and completion gating, and a room with no checkpoint is the state they already
    describe. The checkpoint's own behaviour is covered in `terminalFollowUpExposure.test.ts`.
  */
  readEventFollowUpDays: async () => null,
  createTrainingEvent: (...a: unknown[]) => createTrainingEvent(...a),
  getOwnerTrainingSnapshot: vi.fn(),
}));
vi.mock("./foundryFollowupService", () => ({
  materializeFollowupObligation: (...a: unknown[]) => materializeFollowupObligation(...a),
}));
vi.mock("./foundryApplyWindowService", () => ({
  materializeApplyWindow: (...a: unknown[]) => materializeApplyWindow(...a),
  /*
    R4-R5C9A — the REAL mapper, not a stub. `applyNarration` is pure (outcome in, small object
    out), so mocking it would only let these tests agree with a fiction; using the shipped rule
    means the spy above still controls the OUTCOME while the mapping stays honest.
  */
  applyNarration: (r: string) => (r === "created" || r === "exists" ? { applyWindow: r } : {}),
}));
vi.mock("./foundryAssignmentPublishService", () => ({
  claimAssignmentForParticipant: (...a: unknown[]) => claimAssignmentForParticipant(...a),
  publishAssignmentsForEvent: vi.fn(),
  preflightAssignedAudience: vi.fn(),
  readCommittedParticipation: vi.fn(async () => ({ mode: "open_link", assigned_count: 0 })),
}));
vi.mock("./foundryDocumentService", () => ({
  getOwnerRoomSnapshot: (...a: unknown[]) => getOwnerRoomSnapshot(...a),
}));

import { declareGuidanceExposure, completeGuidanceTraining, readGuidanceContent } from "./foundryGuidanceService";
import { publishDraft } from "./foundryPublishService";
import { simulateClaimAssignment, seedAssignment, readAssignment } from "./__fixtures__/assignmentClaimSim";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeAdmin(tables: Tables) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const q: Record<string, unknown> = {
      _op: "select" as string,
      _filters: [] as Array<{ c: string; v: unknown }>,
      _nulls: [] as string[],
      _patch: {} as Row,
      _insert: null as Row | null,
      _limit: Infinity,
      insert(this: Record<string, unknown>, row: Row) {
        this._op = "insert";
        this._insert = row;
        return this;
      },
      update(this: Record<string, unknown>, patch: Row) {
        this._op = "update";
        this._patch = patch;
        return this;
      },
      delete(this: Record<string, unknown>) {
        this._op = "delete";
        return this;
      },
      select() {
        return this;
      },
      eq(this: { _filters: Array<{ c: string; v: unknown }> }, c: string, v: unknown) {
        this._filters.push({ c, v });
        return this;
      },
      in() {
        return this;
      },
      is(this: { _nulls: string[] }, c: string, v: unknown) {
        if (v === null) this._nulls.push(c);
        return this;
      },
      order() {
        return this;
      },
      limit(this: Record<string, unknown>, n: number) {
        this._limit = n;
        return this;
      },
      _match(this: { _filters: Array<{ c: string; v: unknown }>; _nulls: string[] }, r: Row) {
        return (
          this._filters.every((f) => r[f.c] === f.v) &&
          this._nulls.every((c) => r[c] === null || r[c] === undefined)
        );
      },
      _matches(this: { _match: (r: Row) => boolean }) {
        return rows.filter((r) => this._match(r));
      },
      single(this: Record<string, unknown>) {
        if (this._op === "insert" && this._insert) {
          const row = { ...(this._insert as Row) };
          if (table === "foundry_events" && !row.id) row.id = `ev-${rows.length + 1}`;
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      maybeSingle(this: Record<string, unknown>) {
        if (this._op === "insert" && this._insert) {
          const row = { id: `p-${rows.length + 1}`, ...(this._insert as Row) };
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        if (this._op === "update") {
          const hits = (this._matches as () => Row[])();
          hits.forEach((r) => Object.assign(r, this._patch));
          return Promise.resolve({ data: hits[0] ? { ...hits[0] } : null, error: null });
        }
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      returns(this: Record<string, unknown>) {
        return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null });
      },
      then(this: Record<string, unknown>, onF: (v: { data: unknown; error: unknown }) => unknown) {
        if (this._op === "insert" && this._insert) {
          rows.push({ ...(this._insert as Row) });
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        if (this._op === "update") {
          (this._matches as () => Row[])().forEach((r) => Object.assign(r, this._patch));
        } else if (this._op === "delete") {
          for (const r of (this._matches as () => Row[])()) {
            const i = rows.indexOf(r);
            if (i >= 0) rows.splice(i, 1);
          }
        } else {
          return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null }).then(onF);
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return q;
  }
  return { from, rpc: () => Promise.resolve({ data: null, error: null }) } as unknown as SupabaseClient;
}

const OWNER = "owner-1";

function guidanceDraft(intent: "written" | "live_discussion", over: Row = {}): Row {
  return {
    id: "d-g",
    owner_user_id: OWNER,
    status: "draft",
    module_version: 1,
    approved_at: null,
    published_at: null,
    program_id: null,
    answers: {
      title: "Ask Before You Assume",
      problem: "People act on half a handover.",
      audienceType: "everyone",
      recurringMoment: "at each handoff point",
      observableBehavior: "The nurse asks one clarifying question before acting.",
      successEvidence: "Handovers include a clarifying question.",
      evidenceType: "heard",
      learningNeeds: ["know"],
      materialIntent: intent,
      materialText: intent === "written" ? "Ask one question before you act." : "Where did we act on half a handover?",
      followUpDays: 7,
      completionPrompt: "What will you ask next time?",
      sharedQuestion: null,
    },
    ...over,
  };
}

const EVENT = { id: "ev-1", owner_user_id: OWNER, title: "Ask Before You Assume", status: "open", join_version: 1 };
const PARTICIPANT = { id: "pt-1", event_id: "ev-1", display_name: "Ari", status: "joined" };

beforeEach(() => {
  vi.clearAllMocks();
  getOwnerRoomSnapshot.mockResolvedValue({ event: { id: "ev-1" }, participants: [], joined_count: 0, completed_count: 0 });
  awardTrainingCoreXp.mockResolvedValue("awarded");
  readEventJourney.mockResolvedValue(undefined);
  resolvePublic.mockResolvedValue({ ok: true, event: EVENT, participant: PARTICIPANT, tokenVersionCurrent: true });
});

describe("R4-R2G · publish creates a guidance event and freezes its content (F5, F10, F15)", () => {
  for (const [intent, contentType] of [
    ["written", "written_guidance"],
    ["live_discussion", "live_discussion"],
  ] as const) {
    it(`${intent} publishes a ${contentType} event with NO content row and the content in the snapshot`, async () => {
      const tables: Tables = { foundry_module_drafts: [guidanceDraft(intent)], foundry_event_module: [], foundry_events: [] };
      const admin = makeFakeAdmin(tables);

      const r = await publishDraft(admin, OWNER, "d-g", "en");
      expect(r.ok).toBe(true);

      // The event carries the REAL discriminator — never youtube, never document.
      expect(tables.foundry_events[0].content_type).toBe(contentType);
      // NO NEW CONTENT TABLE: neither content table was written.
      expect(tables.foundry_event_training_content ?? []).toHaveLength(0);
      expect(tables.foundry_event_document_content ?? []).toHaveLength(0);
      expect(createTrainingEvent).not.toHaveBeenCalled();

      // The learner-facing content rides the immutable module snapshot.
      const snapshot = tables.foundry_event_module[0].module_snapshot as Row;
      expect(snapshot.publishedGuidanceV1).toMatchObject({
        version: 1,
        contentType,
        completionPrompt: "What will you ask next time?",
      });
      expect(tables.foundry_module_drafts[0].status).toBe("published");
    });
  }

  it("REFUSES before creating anything when the guidance text is empty", async () => {
    const draft = guidanceDraft("written");
    (draft.answers as Row).materialText = "   ";
    const tables: Tables = { foundry_module_drafts: [draft], foundry_event_module: [], foundry_events: [] };
    const admin = makeFakeAdmin(tables);

    const r = await publishDraft(admin, OWNER, "d-g", "en");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("material_written_guidance_required");
    // Nothing was created — the refusal is BEFORE the event, not after it.
    expect(tables.foundry_events).toHaveLength(0);
    expect(tables.foundry_event_module).toHaveLength(0);
  });

  it("the frozen content is readable back by the learner runtime", async () => {
    const tables: Tables = { foundry_module_drafts: [guidanceDraft("live_discussion")], foundry_event_module: [], foundry_events: [] };
    const admin = makeFakeAdmin(tables);
    await publishDraft(admin, OWNER, "d-g", "en");

    const content = await readGuidanceContent(admin, tables.foundry_events[0].id as string);
    expect(content).toMatchObject({
      contentType: "live_discussion",
      materialText: "Where did we act on half a handover?",
    });
  });
});

describe("R4-R2G · the exposure declaration (F2, F7, F16)", () => {
  function roomWith(contentType: "written_guidance" | "live_discussion", progress: Row[] = []): Tables {
    return {
      foundry_event_module: [
        {
          event_id: "ev-1",
          module_snapshot: {
            publishedGuidanceV1: {
              version: 1,
              contentType,
              materialText: "The material.",
              completionPrompt: "What will you do?",
              sharedQuestion: null,
            },
          },
        },
      ],
      foundry_event_training_progress: progress,
    };
  }

  it("writes the type's OWN stamp — and only that one", async () => {
    const tables = roomWith("written_guidance");
    const admin = makeFakeAdmin(tables);

    const r = await declareGuidanceExposure(admin, "tok", "sess", "written_guidance");
    expect(r.ok).toBe(true);

    const prog = tables.foundry_event_training_progress[0];
    expect(prog.written_guidance_read_at).toBeTruthy();
    expect(prog.discussion_self_reported_at ?? null).toBeNull();
    expect(prog.video_completed_at ?? null).toBeNull();
    expect(prog.document_read_completed_at ?? null).toBeNull();
  });

  it("live discussion writes the SELF-REPORT stamp, never a read or attendance one", async () => {
    const tables = roomWith("live_discussion");
    const admin = makeFakeAdmin(tables);

    await declareGuidanceExposure(admin, "tok", "sess", "live_discussion");

    const prog = tables.foundry_event_training_progress[0];
    expect(prog.discussion_self_reported_at).toBeTruthy();
    expect(prog.written_guidance_read_at ?? null).toBeNull();
  });

  it("F16 — THE DECLARATION UPGRADES NOTHING: no completion, no XP, no obligation, no window", async () => {
    const tables = roomWith("live_discussion");
    const admin = makeFakeAdmin(tables);

    const r = await declareGuidanceExposure(admin, "tok", "sess", "live_discussion");
    expect(r.ok).toBe(true);

    const prog = tables.foundry_event_training_progress[0];
    expect(prog.completed_at ?? null).toBeNull();
    expect(prog.xp_awarded_at ?? null).toBeNull();
    expect(awardTrainingCoreXp).not.toHaveBeenCalled();
    expect(materializeFollowupObligation).not.toHaveBeenCalled();
    expect(materializeApplyWindow).not.toHaveBeenCalled();
    if (!r.ok) return;
    // And the learner is told only that they declared — never that anything was verified.
    expect(r.snapshot.declared).toBe(true);
    expect(r.snapshot.xp_status).toBe("none");
  });

  it("is write-once: a repeat declaration does not move the recorded instant", async () => {
    const tables = roomWith("written_guidance", [
      { id: "pr-1", event_id: "ev-1", participant_id: "pt-1", written_guidance_read_at: "2026-01-01T00:00:00.000Z", discussion_self_reported_at: null, completed_at: null },
    ]);
    const admin = makeFakeAdmin(tables);

    await declareGuidanceExposure(admin, "tok", "sess", "written_guidance");
    expect(tables.foundry_event_training_progress[0].written_guidance_read_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("refuses to record a declaration about content that does not exist", async () => {
    const admin = makeFakeAdmin({ foundry_event_module: [], foundry_event_training_progress: [] });
    const r = await declareGuidanceExposure(admin, "tok", "sess", "written_guidance");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("guidance_unavailable");
  });

  it("refuses when the room's frozen content is a DIFFERENT type than the one asked for", async () => {
    const tables = roomWith("written_guidance");
    const admin = makeFakeAdmin(tables);
    const r = await declareGuidanceExposure(admin, "tok", "sess", "live_discussion");
    expect(r.ok).toBe(false);
    expect(tables.foundry_event_training_progress).toHaveLength(0);
  });
});

describe("R4-R2G · completion is reachable and gated (D3, F5, F10)", () => {
  function room(contentType: "written_guidance" | "live_discussion", progress: Row[]): Tables {
    return {
      foundry_event_module: [
        {
          event_id: "ev-1",
          module_snapshot: {
            publishedGuidanceV1: {
              version: 1,
              contentType,
              materialText: "The material.",
              completionPrompt: "What will you do?",
              sharedQuestion: null,
            },
          },
        },
      ],
      foundry_event_training_progress: progress,
    };
  }

  it("REFUSES before the learner has declared — the server checks its own column", async () => {
    const tables = room("live_discussion", [
      { id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: null, discussion_self_reported_at: null, written_guidance_read_at: null },
    ]);
    const admin = makeFakeAdmin(tables);

    const r = await completeGuidanceTraining(admin, "tok", "sess", "live_discussion", "I will ask.", "user-1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("guidance_not_declared");
    expect(tables.foundry_event_training_progress[0].completed_at ?? null).toBeNull();
    expect(awardTrainingCoreXp).not.toHaveBeenCalled();
  });

  it("D3 — after declaring, the ordinary completion closes the room and awards Core XP once", async () => {
    const tables = room("written_guidance", [
      { id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: null, written_guidance_read_at: "2026-01-01T00:00:00.000Z", discussion_self_reported_at: null, xp_awarded_at: null },
    ]);
    const admin = makeFakeAdmin(tables);

    const r = await completeGuidanceTraining(admin, "tok", "sess", "written_guidance", "I will ask one question.", "user-1");
    expect(r.ok).toBe(true);

    const prog = tables.foundry_event_training_progress[0];
    expect(prog.completed_at).toBeTruthy();
    expect(prog.response_text).toBe("I will ask one question.");
    // The SAME canonical XP path as YouTube and PDF — one call, one award.
    expect(awardTrainingCoreXp).toHaveBeenCalledTimes(1);
    // And the ordinary post-completion lineage, exactly as the other content types produce it.
    expect(materializeFollowupObligation).toHaveBeenCalledTimes(1);
    expect(materializeApplyWindow).toHaveBeenCalledTimes(1);
  });

  it("still requires a response — a declaration is not an answer", async () => {
    const tables = room("written_guidance", [
      { id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: null, written_guidance_read_at: "t", discussion_self_reported_at: null },
    ]);
    const admin = makeFakeAdmin(tables);

    const r = await completeGuidanceTraining(admin, "tok", "sess", "written_guidance", "   ", "user-1");
    expect(r.ok).toBe(false);
    expect(tables.foundry_event_training_progress[0].completed_at ?? null).toBeNull();
  });

  it("is idempotent — a second completion neither re-awards nor overwrites the answer", async () => {
    const tables = room("written_guidance", [
      { id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: "2026-01-02T00:00:00.000Z", response_text: "first", written_guidance_read_at: "t", discussion_self_reported_at: null, xp_awarded_at: "t" },
    ]);
    const admin = makeFakeAdmin(tables);

    const r = await completeGuidanceTraining(admin, "tok", "sess", "written_guidance", "second", "user-1");
    expect(r.ok).toBe(true);
    expect(tables.foundry_event_training_progress[0].response_text).toBe("first");
    expect(awardTrainingCoreXp).not.toHaveBeenCalled();
  });
});

/**
 * R4-R5B1 — ASSIGNMENT COMPLETION TRUTH (written guidance / live discussion).
 *
 * This family had NO compensation of any kind. `completeGuidanceTraining` linked identity, awarded
 * XP, materialized the follow-up and the apply window — and the assignment stayed `assigned`
 * forever, because the claim lived only in `claimGuidanceXp` and a signed-in learner never sees the
 * claim control (the terminal stage is `completed_awarded`, and the control renders only at
 * `completed_claimable`). Required Learning kept offering `Start learning` for finished training.
 *
 * The module-level `claimAssignmentForParticipant` mock is delegated to the faithful RPC simulation
 * here, so these assert the real `assigned -> completed` transition on the real arguments rather
 * than merely that a spy was called.
 */
describe("R4-R5B1 · assignment completion truth — guidance / discussion", () => {
  const AUTH = "user-1";

  function guidanceRoom(contentType: "written_guidance" | "live_discussion"): Tables {
    return {
      foundry_event_module: [
        {
          event_id: "ev-1",
          module_snapshot: {
            publishedGuidanceV1: {
              version: 1,
              contentType,
              materialText: "The material.",
              completionPrompt: "What will you do?",
              sharedQuestion: null,
            },
          },
        },
      ],
      foundry_event_training_progress: [
        {
          id: "pr-1",
          event_id: "ev-1",
          participant_id: "pt-1",
          completed_at: null,
          written_guidance_read_at: "2026-01-01T00:00:00.000Z",
          discussion_self_reported_at: "2026-01-01T00:00:00.000Z",
          xp_awarded_at: null,
        },
      ],
    };
  }

  /** Route the mocked helper through the faithful simulator against this room's tables. */
  function wireFaithfulClaim(tables: Tables) {
    claimAssignmentForParticipant.mockImplementation(
      async (_admin: unknown, eventId: string, participantId: string, authUserId: string) => {
        const res = simulateClaimAssignment(tables as unknown as Record<string, Array<Record<string, unknown>>>, {
          p_event_id: eventId,
          p_participant_id: participantId,
          p_auth_user_id: authUserId,
        });
        return res.error ? "not_applicable" : (res.data?.[0]?.result ?? "not_applicable");
      },
    );
  }

  for (const contentType of ["written_guidance", "live_discussion"] as const) {
    it(`T2 — an authenticated assigned ${contentType} completion drives the assignment to completed`, async () => {
      const tables = guidanceRoom(contentType);
      seedAssignment(tables as unknown as Record<string, Array<Record<string, unknown>>>, "ev-1", AUTH);
      wireFaithfulClaim(tables);
      const admin = makeFakeAdmin(tables);

      const r = await completeGuidanceTraining(admin, "tok", "sess", contentType, "I will ask one question.", AUTH);

      expect(r.ok).toBe(true);
      // The helper received the SERVER-derived pair — never anything from a browser.
      expect(claimAssignmentForParticipant).toHaveBeenCalledTimes(1);
      expect(claimAssignmentForParticipant).toHaveBeenCalledWith(admin, "ev-1", "pt-1", AUTH);
      const a = readAssignment(tables as unknown as Record<string, Array<Record<string, unknown>>>, "ev-1", AUTH)!;
      expect(a.status).toBe("completed");
      expect(a.participant_id).toBe("pt-1");
      // Existing behaviour untouched.
      expect(awardTrainingCoreXp).toHaveBeenCalledTimes(1);
      expect(materializeFollowupObligation).toHaveBeenCalledTimes(1);
      expect(materializeApplyWindow).toHaveBeenCalledTimes(1);
      expect(linkLearnerIdentity).toHaveBeenCalledTimes(1);
    });
  }

  it("T4 — an anonymous guidance completion runs no assignment claim", async () => {
    const tables = guidanceRoom("written_guidance");
    seedAssignment(tables as unknown as Record<string, Array<Record<string, unknown>>>, "ev-1", AUTH);
    wireFaithfulClaim(tables);
    const admin = makeFakeAdmin(tables);

    const r = await completeGuidanceTraining(admin, "tok", "sess", "written_guidance", "Anonymous.", null);

    expect(r.ok).toBe(true);
    expect(claimAssignmentForParticipant).not.toHaveBeenCalled();
    expect(awardTrainingCoreXp).not.toHaveBeenCalled();
    expect(readAssignment(tables as unknown as Record<string, Array<Record<string, unknown>>>, "ev-1", AUTH)!.status).toBe("assigned");
  });

  it("T5 — a signed-in OPEN-LINK guidance completion answers not_applicable and writes no assignment", async () => {
    const tables = guidanceRoom("written_guidance"); // no assignment, no participation-mode row
    wireFaithfulClaim(tables);
    const admin = makeFakeAdmin(tables);

    const r = await completeGuidanceTraining(admin, "tok", "sess", "written_guidance", "Open link.", AUTH);

    expect(r.ok).toBe(true);
    await expect(claimAssignmentForParticipant.mock.results[0]!.value).resolves.toBe("not_applicable");
    expect(tables.foundry_event_assignments ?? []).toHaveLength(0);
    expect(awardTrainingCoreXp).toHaveBeenCalledTimes(1);
  });

  /*
    T7 IS NOT TESTED HERE, DELIBERATELY. This file mocks `claimAssignmentForParticipant` at the
    module boundary, so the real helper — which is where the never-throw guarantee lives — is not
    executing. Faulting the mock would only prove that an unguarded rejection propagates, which is
    true of any un-caught call and says nothing about the shipped behaviour.

    The containment is family-agnostic (all three services call the SAME helper) and is proven
    against the real helper in `assignmentClaimContainment.test.ts`, and end-to-end through a
    faulting RPC in the video and document service suites.
  */
});
