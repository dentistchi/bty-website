import { describe, expect, it } from "vitest";
import { readLearnerTrainingDetail } from "./learnerTrainingDetail.server";

/**
 * Slice My Learning — Canonical Training History V1, SERVER boundary.
 *
 * Two rules carry this surface: it is owner-scoped by `linked_user_id` exactly as the list is, and
 * the private reflection BODY never travels here — only whether one exists.
 */

const QUIZ = {
  schemaVersion: 1,
  questions: [
    { id: "q1", text: "First", choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctChoiceId: "a", position: 1 },
    { id: "q2", text: "Second", choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctChoiceId: "b", position: 2, explanation: "Because B." },
  ],
};

type Rows = {
  progress?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
  attempt?: Record<string, unknown> | null;
  quiz?: Record<string, unknown> | null;
  module?: Record<string, unknown> | null;
};

function fakeAdmin(rows: Rows) {
  const selected: string[] = [];
  const admin = {
    from(table: string) {
      const result =
        table === "foundry_event_training_progress" ? rows.progress ?? null
        : table === "foundry_events" ? rows.event ?? null
        : table === "foundry_event_quiz_attempts" ? rows.attempt ?? null
        : table === "foundry_event_quizzes" ? rows.quiz ?? null
        : table === "foundry_event_module" ? rows.module ?? null
        : null;
      const chain: Record<string, unknown> = {
        select(cols: string) { selected.push(cols); return chain; },
        eq() { return chain; },
        not() { return chain; },
        maybeSingle: async () => ({ data: result }),
      };
      return chain;
    },
  };
  return { admin: admin as never, selected };
}

const OWNED: Rows = {
  progress: { id: "e1", event_id: "ev1", participant_id: "p1", completed_at: "2026-09-22T10:00:00Z", learner_reflection_text: "my private words", response_text: null },
  event: { id: "ev1", title: "Morning Office Opening", content_type: "written_guidance" },
  attempt: { id: "a1", answers: [{ questionId: "q1", choiceId: "a" }, { questionId: "q2", choiceId: "a" }], correct_count: 1, total_count: 2, submitted_at: "2026-09-22T10:00:00Z" },
  quiz: { quiz_snapshot: QUIZ },
  module: { module_snapshot: { publishedGuidanceV1: { version: 1, contentType: "written_guidance", materialText: "Open the back door first.", completionPrompt: null, sharedQuestion: null, completionEvidence: "quiz" } } },
};

describe("readLearnerTrainingDetail", () => {
  it("returns the training, the score and the learner's own answers", async () => {
    const { admin } = fakeAdmin(OWNED);
    const r = await readLearnerTrainingDetail(admin, { userId: "u1", entryId: "e1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.detail.title).toBe("Morning Office Opening");
    expect(r.detail.quiz?.correctCount).toBe(1);
    expect(r.detail.quiz?.totalCount).toBe(2);
    expect(r.detail.quiz?.questions).toHaveLength(2);
    const second = r.detail.quiz!.questions[1];
    expect(second.selectedChoiceId).toBe("a");
    expect(second.correctChoiceId).toBe("b");
    expect(second.explanation).toBe("Because B.");
  });

  it("NEVER returns the private reflection body — only that one exists", async () => {
    const { admin } = fakeAdmin(OWNED);
    const r = await readLearnerTrainingDetail(admin, { userId: "u1", entryId: "e1" });
    expect(r.ok && r.detail.hasReflection).toBe(true);
    expect(JSON.stringify(r)).not.toContain("my private words");
  });

  it("reports no reflection when the learner wrote none", async () => {
    const { admin } = fakeAdmin({ ...OWNED, progress: { ...OWNED.progress, learner_reflection_text: "  ", response_text: null } });
    const r = await readLearnerTrainingDetail(admin, { userId: "u1", entryId: "e1" });
    expect(r.ok && r.detail.hasReflection).toBe(false);
  });

  it("refuses another learner's entry the same way it refuses one that does not exist", async () => {
    const { admin } = fakeAdmin({ ...OWNED, progress: null });
    expect(await readLearnerTrainingDetail(admin, { userId: "someone-else", entryId: "e1" }))
      .toEqual({ ok: false, reason: "not_found" });
  });

  it("shows NO quiz rather than an invented 0 / 0 when there is no attempt", async () => {
    const { admin } = fakeAdmin({ ...OWNED, attempt: null });
    const r = await readLearnerTrainingDetail(admin, { userId: "u1", entryId: "e1" });
    expect(r.ok && r.detail.quiz).toBeNull();
  });

  it("carries the training material the room showed, not a new copy of it", async () => {
    const { admin } = fakeAdmin(OWNED);
    const r = await readLearnerTrainingDetail(admin, { userId: "u1", entryId: "e1" });
    expect((r.ok && (r.detail.content as { materialText?: string })?.materialText) || "").toBe("Open the back door first.");
  });

  it("does not fall over when the training's material is gone", async () => {
    const { admin } = fakeAdmin({ ...OWNED, module: null });
    const r = await readLearnerTrainingDetail(admin, { userId: "u1", entryId: "e1" });
    expect(r.ok && r.detail.content).toBeNull();
    expect(r.ok && r.detail.quiz?.totalCount).toBe(2);
  });
});
