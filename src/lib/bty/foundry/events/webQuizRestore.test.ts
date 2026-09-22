/**
 * THE OLD WEB LINK QUIZ — visible, restorable, and still one immutable attempt.
 * Slice Teams Delivery Diagnostics V1 (§7).
 *
 * Quiz STORAGE is unchanged; this pins the behaviour a Morning-style written_guidance + quiz
 * training must keep on the public web path while Teams delivery is being repaired.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const H = vi.hoisted(() => ({
  resolvePublic: vi.fn(),
  finalize: vi.fn(async () => ({ applyWindowResult: "skipped" as const })),
}));
vi.mock("./foundryTrainingService", async (orig) => {
  const actual = await orig<typeof import("./foundryTrainingService")>();
  return { ...actual, resolvePublic: H.resolvePublic, finalizeCanonicalTrainingCompletion: H.finalize };
});

import { publicQuiz, submitPublicQuiz } from "./quickTrainingQuizService";

const QUIZ = {
  schemaVersion: 1,
  questions: [
    { id: "q1", text: "Q1?", position: 1, correctChoiceId: "a", explanation: "because", choices: [{ id: "a", label: "Yes" }, { id: "b", label: "No" }] },
    { id: "q2", text: "Q2?", position: 2, correctChoiceId: "b", choices: [{ id: "a", label: "Yes" }, { id: "b", label: "No" }] },
  ],
};

type Row = Record<string, unknown>;

function makeAdmin(over: { attempt?: Row | null; progress?: Row } = {}) {
  let n = 0;
  const tables: Record<string, Row[]> = {
    foundry_event_quizzes: [{ event_id: "ev-1", quiz_snapshot: QUIZ }],
    foundry_event_quiz_attempts: over.attempt ? [over.attempt] : [],
    foundry_event_training_progress: [
      {
        id: "pr-1", event_id: "ev-1", participant_id: "pt-1",
        video_completed_at: null, document_read_completed_at: null,
        written_guidance_read_at: "2026-09-21T00:00:00Z",
        completed_at: null, quiz_attempt_id: null, ...over.progress,
      },
    ],
  };
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const st = { op: "select" as string, f: [] as { c: string; v: unknown }[], nulls: [] as string[], patch: {} as Row, ins: null as Row | null };
    const match = () => rows.filter((r) => st.f.every((x) => r[x.c] === x.v) && st.nulls.every((c) => (r[c] ?? null) === null));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { st.f.push({ c, v }); return q; },
      is: (c: string, v: unknown) => { if (v === null) st.nulls.push(c); return q; },
      insert: (r: Row) => { st.op = "insert"; st.ins = r; return q; },
      update: (p: Row) => { st.op = "update"; st.patch = p; return q; },
      maybeSingle: () => {
        if (st.op === "insert" && st.ins) {
          const row = { id: `${table}-${++n}`, ...st.ins };
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        if (st.op === "update") {
          const hits = match();
          hits.forEach((r) => Object.assign(r, st.patch));
          return Promise.resolve({ data: hits[0] ? { ...hits[0] } : null, error: null });
        }
        return Promise.resolve({ data: match()[0] ?? null, error: null });
      },
      single: () => (q.maybeSingle as () => unknown)(),
    };
    return q;
  }
  return { admin: { from } as unknown as SupabaseClient, tables };
}

const PUBLIC_OK = {
  ok: true,
  event: { id: "ev-1", owner_user_id: "owner-1", title: "Morning Office Opening", status: "open", content_type: "written_guidance" },
  participant: { id: "pt-1", event_id: "ev-1", display_name: "Ari", status: "joined", user_id: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  H.resolvePublic.mockResolvedValue(PUBLIC_OK);
  H.finalize.mockResolvedValue({ applyWindowResult: "skipped" });
});

describe("★ a fresh anonymous participant can SEE the quiz", () => {
  it("is served the questions, with the answer key withheld", async () => {
    const { admin } = makeAdmin();
    const res = await publicQuiz(admin, "tok", "sess");
    expect(res.ok).toBe(true);
    if (!res.ok || res.submitted) return;
    expect(res.quiz.questions).toHaveLength(2);
    const s = JSON.stringify(res.quiz);
    expect(s).not.toContain("correctChoiceId");
    expect(s).not.toContain("explanation");
  });
});

describe("★ an ALREADY-COMPLETED participant restores their result", () => {
  const attempt = {
    id: "at-1", event_id: "ev-1", participant_id: "pt-1",
    answers: [{ questionId: "q1", choiceId: "a" }, { questionId: "q2", choiceId: "a" }],
    correct_count: 1, total_count: 2, submitted_at: "2026-09-21T01:00:00Z",
  };

  it("returns the factual result instead of a fresh quiz", async () => {
    const { admin } = makeAdmin({ attempt, progress: { completed_at: "2026-09-21T01:00:00Z", quiz_attempt_id: "at-1" } });
    const res = await publicQuiz(admin, "tok", "sess");
    expect(res.ok && res.submitted).toBe(true);
    if (!res.ok || !res.submitted) return;
    expect(res.result).toMatchObject({ correctCount: 1, totalCount: 2, scorePercent: 50 });
    // The result carries what they chose and what was right — this is the read-only restore.
    expect(res.result.questions[0]).toMatchObject({ selectedChoiceId: "a", correctChoiceId: "a" });
    // ...and there is no fresh quiz to start.
    expect("quiz" in res).toBe(false);
  });

  it("★ NO RETAKE: a second submit reuses the one immutable attempt and never rescoring", async () => {
    const { admin, tables } = makeAdmin({ attempt, progress: { completed_at: "2026-09-21T01:00:00Z", quiz_attempt_id: "at-1" } });
    const res = await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "a" },
      { questionId: "q2", choiceId: "b" }, // would have scored 2/2 if it were rescored
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.alreadySubmitted).toBe(true);
    expect(res.result.correctCount).toBe(1); // the ORIGINAL score, untouched
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
    expect(tables.foundry_event_quiz_attempts[0]!.correct_count).toBe(1);
  });
});

describe("the one-attempt contract on the public path is unchanged", () => {
  it("a first submit writes exactly one attempt and completes the progress row", async () => {
    const { admin, tables } = makeAdmin();
    const res = await submitPublicQuiz(admin, "tok", "sess", null, [
      { questionId: "q1", choiceId: "a" },
      { questionId: "q2", choiceId: "b" },
    ]);
    expect(res.ok).toBe(true);
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
    expect(tables.foundry_event_quiz_attempts[0]).toMatchObject({ correct_count: 2, total_count: 2 });
    expect(tables.foundry_event_training_progress[0]!.completed_at).toBeTruthy();
    // Completion evidence is the attempt — a written answer is never fabricated.
    expect(tables.foundry_event_training_progress[0]!.response_text ?? null).toBeNull();
  });

  it("the engagement gate still applies before any attempt exists", async () => {
    const { admin, tables } = makeAdmin({ progress: { written_guidance_read_at: null } });
    expect(await submitPublicQuiz(admin, "tok", "sess", null, [{ questionId: "q1", choiceId: "a" }])).toEqual({
      ok: false, reason: "study_required",
    });
    expect(tables.foundry_event_quiz_attempts).toHaveLength(0);
  });
});
