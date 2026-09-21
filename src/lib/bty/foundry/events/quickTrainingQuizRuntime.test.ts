/**
 * Quick Training Quiz — the LEARNER runtime is unchanged by the authoring slice.
 *
 * The authoring corrections touched what a manager creates. This file is the guard on what a
 * learner receives and what the server writes, which must be exactly what Quiz V1 shipped:
 * server-side scoring, one immutable attempt, no answer key before submit, and the canonical
 * completion finalizer reached once.
 *
 * It also pins the ONE runtime rule the authoring slice added: a quiz-backed guidance training
 * cannot be completed by writing a response, because its completion check is the quiz.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const resolvePublic = vi.fn();
const finalizeCanonicalTrainingCompletion = vi.fn(async () => ({ applyWindowResult: "skipped" as const }));

vi.mock("./foundryTrainingService", () => ({
  resolvePublic: (...a: unknown[]) => resolvePublic(...a),
  finalizeCanonicalTrainingCompletion: (...a: unknown[]) => finalizeCanonicalTrainingCompletion(...(a as [])),
  awardTrainingCoreXp: vi.fn(),
  outcomeToXpStatus: () => "none",
  linkLearnerIdentity: vi.fn(),
  readEventJourney: vi.fn(async () => null),
  readEventFollowUpDays: vi.fn(async () => null),
}));

import { publicQuiz, submitPublicQuiz } from "./quickTrainingQuizService";
import { readPublishedGuidance, PUBLISHED_GUIDANCE_KEY } from "@/domain/foundry/module/module-publish";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeAdmin(tables: Tables) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const state = {
      op: "select" as "select" | "insert" | "update",
      filters: [] as Array<{ c: string; v: unknown }>,
      nulls: [] as string[],
      patch: {} as Row,
      insertRow: null as Row | null,
    };
    const matches = () =>
      rows.filter(
        (r) =>
          state.filters.every((f) => r[f.c] === f.v) &&
          state.nulls.every((c) => r[c] === null || r[c] === undefined),
      );
    const q: Record<string, unknown> = {
      insert(row: Row) { state.op = "insert"; state.insertRow = row; return q; },
      update(patch: Row) { state.op = "update"; state.patch = patch; return q; },
      select() { return q; },
      eq(c: string, v: unknown) { state.filters.push({ c, v }); return q; },
      is(c: string, v: unknown) { if (v === null) state.nulls.push(c); return q; },
      order() { return q; },
      returns() { return q; },
      single() {
        const hit = matches()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: hit ? null : { message: "not found" } });
      },
      maybeSingle() {
        if (state.op === "insert" && state.insertRow) {
          const row = { id: `${table}-${rows.length + 1}`, ...state.insertRow };
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        if (state.op === "update") {
          const hits = matches();
          hits.forEach((r) => Object.assign(r, state.patch));
          return Promise.resolve({ data: hits[0] ? { ...hits[0] } : null, error: null });
        }
        const hit = matches()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      then(onF: (v: { data: unknown; error: unknown }) => unknown) {
        if (state.op === "insert" && state.insertRow) {
          rows.push({ id: `${table}-${rows.length + 1}`, ...state.insertRow });
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        if (state.op === "update") matches().forEach((r) => Object.assign(r, state.patch));
        return Promise.resolve({ data: matches().map((r) => ({ ...r })), error: null }).then(onF);
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const QUIZ_SNAPSHOT = {
  schemaVersion: 1,
  questions: [
    {
      id: "q1",
      text: "How soon must an incident be reported?",
      position: 1,
      choices: [
        { id: "a", label: "Within 24 hours" },
        { id: "b", label: "Within a week" },
      ],
      correctChoiceId: "a",
      explanation: "The policy names one day.",
    },
    {
      id: "q2",
      text: "Who signs it off?",
      position: 2,
      choices: [
        { id: "a", label: "The shift lead" },
        { id: "b", label: "Anyone present" },
      ],
      correctChoiceId: "a",
    },
  ],
};

function seed(over: { progress?: Row } = {}): { admin: SupabaseClient; tables: Tables } {
  const tables: Tables = {
    foundry_event_quizzes: [{ event_id: "ev-1", quiz_snapshot: QUIZ_SNAPSHOT }],
    foundry_event_quiz_attempts: [],
    foundry_event_training_progress: [
      {
        id: "pr-1",
        event_id: "ev-1",
        participant_id: "pt-1",
        video_completed_at: "2026-09-21T00:00:00Z",
        document_read_completed_at: null,
        written_guidance_read_at: null,
        completed_at: null,
        quiz_attempt_id: null,
        ...over.progress,
      },
    ],
  };
  return { admin: makeFakeAdmin(tables), tables };
}

beforeEach(() => {
  resolvePublic.mockReset();
  finalizeCanonicalTrainingCompletion.mockClear();
  resolvePublic.mockResolvedValue({
    ok: true,
    event: { id: "ev-1", status: "open", owner_user_id: "owner-1" },
    participant: { id: "pt-1", user_id: null },
  });
});

describe("the answer key is never served before this learner has submitted", () => {
  it("GET returns questions and choices only", async () => {
    const { admin } = seed();
    const result = await publicQuiz(admin, "tok", "sess");
    expect(result.ok).toBe(true);
    if (!result.ok || result.submitted) return;
    const serialized = JSON.stringify(result.quiz);
    expect(serialized).not.toContain("correctChoiceId");
    expect(serialized).not.toContain("explanation");
    expect(result.quiz.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("the key arrives only WITH the learner's own result, after the attempt exists", async () => {
    const { admin } = seed();
    const submitted = await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "a" },
      { questionId: "q2", choiceId: "b" },
    ]);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.result).toMatchObject({ correctCount: 1, totalCount: 2, scorePercent: 50 });
    expect(submitted.result.questions[0]).toMatchObject({ correctChoiceId: "a", selectedChoiceId: "a" });

    const reread = await publicQuiz(admin, "tok", "sess");
    expect(reread.ok && reread.submitted).toBe(true);
  });
});

describe("one immutable attempt, scored by the server", () => {
  it("writes exactly one attempt and completes the progress row from it", async () => {
    const { admin, tables } = seed();
    await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "a" },
      { questionId: "q2", choiceId: "a" },
    ]);
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
    expect(tables.foundry_event_quiz_attempts[0]).toMatchObject({ correct_count: 2, total_count: 2 });
    const progress = tables.foundry_event_training_progress[0]!;
    expect(progress.completed_at).toBeTruthy();
    expect(progress.quiz_attempt_id).toBe(tables.foundry_event_quiz_attempts[0]!.id);
    // Completion evidence is the attempt. A written answer is NEVER fabricated.
    expect(progress.response_text ?? null).toBeNull();
    expect(finalizeCanonicalTrainingCompletion).toHaveBeenCalledTimes(1);
  });

  it("a second submit reuses the first attempt and never rescoring it", async () => {
    const { admin, tables } = seed();
    const first = await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "b" },
      { questionId: "q2", choiceId: "b" },
    ]);
    const second = await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "a" },
      { questionId: "q2", choiceId: "a" },
    ]);
    expect(first.ok && first.result.correctCount).toBe(0);
    expect(second.ok && second.alreadySubmitted).toBe(true);
    expect(second.ok && second.result.correctCount).toBe(0);
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
  });

  it("refuses before the learner has engaged the material at all", async () => {
    const { admin, tables } = seed({ progress: { video_completed_at: null } });
    expect(await submitPublicQuiz(admin, "tok", "sess", null, [{ questionId: "q1", choiceId: "a" }])).toEqual({
      ok: false,
      reason: "study_required",
    });
    expect(tables.foundry_event_quiz_attempts).toHaveLength(0);
  });

  it("accepts a TEXT training's own exposure stamp as the engagement gate", async () => {
    const { admin, tables } = seed({
      progress: { video_completed_at: null, written_guidance_read_at: "2026-09-21T00:00:00Z" },
    });
    const result = await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "a" },
      { questionId: "q2", choiceId: "a" },
    ]);
    expect(result.ok).toBe(true);
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
  });
});

describe("the frozen guidance contract still reads every snapshot written before this slice", () => {
  it("a legacy snapshot with no completionEvidence key is read as a response-backed training", () => {
    const legacy = {
      [PUBLISHED_GUIDANCE_KEY]: {
        version: 1,
        contentType: "written_guidance",
        materialText: "Ask one question before you act.",
        completionPrompt: "What will you ask next time?",
        sharedQuestion: null,
      },
    };
    expect(readPublishedGuidance(legacy)).toEqual({
      version: 1,
      contentType: "written_guidance",
      materialText: "Ask one question before you act.",
      completionPrompt: "What will you ask next time?",
      sharedQuestion: null,
      completionEvidence: "response",
    });
  });

  it("an UNRECOGNISED completionEvidence value fails closed, like every other bad field", () => {
    const unknown = {
      [PUBLISHED_GUIDANCE_KEY]: {
        version: 1,
        contentType: "written_guidance",
        materialText: "m",
        completionPrompt: "p",
        sharedQuestion: null,
        completionEvidence: "survey",
      },
    };
    expect(readPublishedGuidance(unknown)).toBeNull();
  });

  it("a quiz-backed snapshot that still carries a prompt is refused — the two are exclusive", () => {
    const incoherent = {
      [PUBLISHED_GUIDANCE_KEY]: {
        version: 1,
        contentType: "written_guidance",
        materialText: "m",
        completionPrompt: "p",
        sharedQuestion: null,
        completionEvidence: "quiz",
      },
    };
    expect(readPublishedGuidance(incoherent)).toBeNull();
  });
});
