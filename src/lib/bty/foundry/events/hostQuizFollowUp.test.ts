import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Slice Training Result → Human Teams Chat V1 — the SERVER boundary.
 *
 * Two things are load-bearing and neither is visible in the UI: this path must never read the
 * table that holds Private Reflection, and ownership must be re-proved on every call so a
 * participant id from another training cannot be used to read across events.
 */

const graph = vi.hoisted(() => ({
  graphConfigFromEnv: vi.fn(() => ({ tenantId: "t-1", clientId: "c", clientSecret: "s" })),
  getGraphAppToken: vi.fn(async () => "token"),
  readChatAddress: vi.fn(async () => "ann@bty-dso.com"),
}));
vi.mock("@/lib/bty/microsoft/graphDirectory.server", () => graph);

import { readLearnerResultDetail, beginFollowUpContact } from "./hostQuizFollowUp.server";

const QUIZ = {
  schemaVersion: 1,
  questions: [
    { id: "q1", text: "First", choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctChoiceId: "a", position: 1 },
    { id: "q2", text: "Second", choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctChoiceId: "b", position: 2 },
  ],
};

type Rows = {
  event?: { id: string; title: string } | null;
  participant?: Record<string, unknown> | null;
  attempt?: Record<string, unknown> | null;
  quiz?: Record<string, unknown> | null;
};

/** Records every table touched and every column list requested. */
function fakeAdmin(rows: Rows) {
  const touched: string[] = [];
  const selected: string[] = [];
  const inserted: { table: string; row: Record<string, unknown> }[] = [];
  const admin = {
    from(table: string) {
      touched.push(table);
      const result =
        table === "foundry_events" ? rows.event ?? null
        : table === "foundry_event_participants" ? rows.participant ?? null
        : table === "foundry_event_quiz_attempts" ? rows.attempt ?? null
        : table === "foundry_event_quizzes" ? rows.quiz ?? null
        : null;
      const chain: Record<string, unknown> = {
        select(cols: string) { selected.push(cols); return chain; },
        eq() { return chain; },
        maybeSingle: async () => ({ data: result }),
        insert: async (row: Record<string, unknown>) => { inserted.push({ table, row }); return { error: null }; },
      };
      return chain;
    },
  };
  return { admin: admin as never, touched, selected, inserted };
}

const OWNED: Rows = {
  event: { id: "e1", title: "Morning Office Opening" },
  participant: { id: "p1", event_id: "e1", display_name: "Ann", user_id: "u-ann", microsoft_tenant_id: "t-1", microsoft_aad_object_id: "oid-ann" },
  attempt: { answers: [{ questionId: "q1", choiceId: "a" }, { questionId: "q2", choiceId: "a" }], correct_count: 1, total_count: 2, submitted_at: "2026-09-22T10:00:00Z" },
  quiz: { quiz_snapshot: QUIZ },
};

beforeEach(() => {
  // clearAllMocks wipes CALL HISTORY but keeps implementations, so every implementation below is
  // re-established explicitly — otherwise test order decides what a later assertion sees.
  vi.clearAllMocks();
  graph.graphConfigFromEnv.mockReturnValue({ tenantId: "t-1", clientId: "c", clientSecret: "s" });
  graph.getGraphAppToken.mockResolvedValue("token");
  graph.readChatAddress.mockResolvedValue("ann@bty-dso.com");
});

describe("readLearnerResultDetail", () => {
  it("NEVER reads the table that holds Private Reflection", async () => {
    const { admin, touched, selected } = fakeAdmin(OWNED);
    await readLearnerResultDetail(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(touched).not.toContain("foundry_event_training_progress");
    expect(selected.join(" ")).not.toContain("response_text");
    expect(selected.join(" ")).not.toContain("shared_understanding_response");
  });

  it("returns only the missed question, with the chosen and correct labels", async () => {
    const { admin } = fakeAdmin(OWNED);
    const result = await readLearnerResultDetail(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.missed).toHaveLength(1);
    expect(result.detail.missed[0].questionId).toBe("q2");
    expect(result.detail.missed[0].selectedLabel).toBe("A");
    expect(result.detail.missed[0].correctLabel).toBe("B");
    expect(result.detail.scorePercent).toBe(50);
  });

  it("refuses a training this Host does not own", async () => {
    const { admin } = fakeAdmin({ ...OWNED, event: null });
    const result = await readLearnerResultDetail(admin, { eventId: "e1", ownerUserId: "someone-else", participantId: "p1" });
    expect(result).toEqual({ ok: false, reason: "not_owner" });
  });

  it("refuses a participant that does not belong to this training", async () => {
    const { admin } = fakeAdmin({ ...OWNED, participant: null });
    const result = await readLearnerResultDetail(admin, { eventId: "e1", ownerUserId: "host", participantId: "p-other" });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports canMessageInTeams false for a learner who joined on the web", async () => {
    const { admin } = fakeAdmin({ ...OWNED, participant: { ...OWNED.participant, microsoft_aad_object_id: null } });
    const result = await readLearnerResultDetail(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(result.ok && result.detail.canMessageInTeams).toBe(false);
  });
});

describe("beginFollowUpContact", () => {
  it("records WHO, WHOM, WHICH TRAINING and WHEN — and carries no message of any kind", async () => {
    const { admin, inserted } = fakeAdmin(OWNED);
    const result = await beginFollowUpContact(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(result).toMatchObject({ ok: true, chatTarget: "ann@bty-dso.com" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe("foundry_host_followup_contacts");
    expect(inserted[0].row).toEqual({
      event_id: "e1",
      host_user_id: "host",
      participant_id: "p1",
      learner_user_id: "u-ann",
      event_type: "follow_up_initiated",
    });
    // Nothing resembling a body, draft or thread was written.
    expect(Object.keys(inserted[0].row).join(" ")).not.toMatch(/message|draft|body|thread|text/i);
  });

  it("refuses a learner with no Teams coordinate instead of guessing an address", async () => {
    const { admin, inserted } = fakeAdmin({ ...OWNED, participant: { ...OWNED.participant, microsoft_aad_object_id: null } });
    const result = await beginFollowUpContact(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(result).toEqual({ ok: false, reason: "no_teams_identity" });
    expect(inserted).toHaveLength(0);
    expect(graph.readChatAddress).not.toHaveBeenCalled();
  });

  it("will not resolve an address for a participant stamped with a DIFFERENT tenant", async () => {
    const { admin } = fakeAdmin({ ...OWNED, participant: { ...OWNED.participant, microsoft_tenant_id: "t-other" } });
    const result = await beginFollowUpContact(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(result).toEqual({ ok: false, reason: "address_unavailable" });
    expect(graph.readChatAddress).not.toHaveBeenCalled();
  });

  it("re-proves ownership before resolving anything", async () => {
    const { admin } = fakeAdmin({ ...OWNED, event: null });
    const result = await beginFollowUpContact(admin, { eventId: "e1", ownerUserId: "not-the-host", participantId: "p1" });
    expect(result).toEqual({ ok: false, reason: "not_owner" });
    expect(graph.readChatAddress).not.toHaveBeenCalled();
  });

  it("reports address_unavailable rather than a half-open chat when Graph has no UPN", async () => {
    graph.readChatAddress.mockResolvedValue(null as never);
    const { admin, inserted } = fakeAdmin(OWNED);
    const result = await beginFollowUpContact(admin, { eventId: "e1", ownerUserId: "host", participantId: "p1" });
    expect(result).toEqual({ ok: false, reason: "address_unavailable" });
    expect(inserted).toHaveLength(0);
  });
});
