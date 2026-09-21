/**
 * POST /api/bty/foundry/events — the authoring contract, through the real route handler.
 *
 * What this pins, and what a service-level test cannot: the route decides ONCE, from the
 * payload, whether a quiz is attached; it passes that decision to whichever creation path the
 * material chose; and a quiz that cannot be persisted takes the event down with it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const deleted: Array<{ table: string; filters: Record<string, unknown> }> = [];

function fakeAdmin() {
  return {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const q = {
        delete: () => q,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return q;
        },
        then: (onF: (v: { data: null; error: null }) => unknown) => {
          deleted.push({ table, filters });
          return Promise.resolve({ data: null, error: null }).then(onF);
        },
      };
      return q;
    },
  };
}

vi.mock("@/lib/bty/foundry/events/managerGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bty/foundry/events/managerGate")>();
  return {
    ...actual,
    requireManager: async () => ({
      ok: true as const,
      ctx: { user: { id: "owner-1" }, admin: fakeAdmin(), base: NextResponse.json({}) },
    }),
  };
});

const trainingCalls: unknown[] = [];
const documentCalls: unknown[] = [];
const textCalls: unknown[] = [];
const quizCalls: unknown[] = [];
const quizResult = { ok: true as boolean, reason: "quiz_insert_failed" };

function snapshot(id: string) {
  return {
    event: { id, title: "T", status: "open", join_token: "tok", created_at: "", closed_at: null },
    participants: [],
    joined_count: 0,
    completed_count: 0,
  };
}

vi.mock("@/lib/bty/foundry/events/foundryTrainingService", () => ({
  createTrainingEvent: async (_a: unknown, _o: string, input: unknown) => {
    trainingCalls.push(input);
    return { ok: true, value: snapshot("ev-video") };
  },
}));
vi.mock("@/lib/bty/foundry/events/foundryDocumentService", () => ({
  createDocumentEvent: async (_a: unknown, _o: string, input: unknown) => {
    documentCalls.push(input);
    return { ok: true, value: snapshot("ev-pdf") };
  },
}));
vi.mock("@/lib/bty/foundry/events/quickTrainingTextService", () => ({
  createQuickTextEvent: async (_a: unknown, _o: string, input: unknown) => {
    textCalls.push(input);
    return { ok: true, value: snapshot("ev-text") };
  },
}));
vi.mock("@/lib/bty/foundry/events/documentUploadTicket", () => ({
  verifyDocumentUploadTicket: () => ({
    ok: true,
    payload: {
      ownerId: "owner-1",
      bucket: "foundry-docs",
      path: "owner-1/a.pdf",
      byteSize: 1,
      pageCount: 2,
      pageCountVerified: true,
      contentHash: "h",
      fileName: "a.pdf",
      sourceType: "uploaded_pdf",
      originalFileId: null,
    },
  }),
}));
vi.mock("@/lib/bty/foundry/events/quickTrainingQuizService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bty/foundry/events/quickTrainingQuizService")>();
  return {
    ...actual,
    attachReviewedQuiz: async (_a: unknown, eventId: string, owner: string, quiz: unknown, sourceKind: string) => {
      quizCalls.push({ eventId, owner, quiz, sourceKind });
      return quizResult.ok ? { ok: true as const } : { ok: false as const, reason: quizResult.reason };
    },
  };
});

import { POST } from "./route";

const QUIZ = {
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
    },
  ],
};

function post(body: unknown) {
  return POST(
    new NextRequest("https://bty.example/api/bty/foundry/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  trainingCalls.length = 0;
  documentCalls.length = 0;
  textCalls.length = 0;
  quizCalls.length = 0;
  deleted.length = 0;
  quizResult.ok = true;
});

describe("the quiz decision is made once, from the payload, for every material", () => {
  it("VIDEO + quiz: no completion prompt is forwarded, and the quiz is attached after creation", async () => {
    const res = await post({
      title: "Incident reporting",
      youtube_url: "https://youtu.be/dQw4w9WgXcQ",
      quiz: QUIZ,
      quiz_source: "manual",
    });
    expect(res.status).toBe(201);
    expect(trainingCalls[0]).toMatchObject({ quiz_attached: true });
    expect((trainingCalls[0] as Record<string, unknown>).completion_prompt).toBeUndefined();
    expect(quizCalls[0]).toMatchObject({ eventId: "ev-video", sourceKind: "manual" });
  });

  it("PDF + quiz: the document path is told too", async () => {
    const res = await post({
      title: "Handbook",
      content_type: "document",
      staging_ticket: "t",
      quiz: QUIZ,
      quiz_source: "csv",
    });
    expect(res.status).toBe(201);
    expect(documentCalls[0]).toMatchObject({ quiz_attached: true });
    expect(quizCalls[0]).toMatchObject({ eventId: "ev-pdf", sourceKind: "csv" });
  });

  it("TEXT + quiz: the written-guidance path is used, with the material text", async () => {
    const res = await post({
      title: "Escalation basics",
      content_type: "written_guidance",
      material_text: "Escalate within 24 hours.",
      quiz: QUIZ,
      quiz_source: "generated",
    });
    expect(res.status).toBe(201);
    expect(textCalls[0]).toMatchObject({ material_text: "Escalate within 24 hours.", quiz_attached: true });
    expect(quizCalls[0]).toMatchObject({ eventId: "ev-text", sourceKind: "generated" });
  });

  it("TEXT without a quiz: the completion question is forwarded and no quiz is attached", async () => {
    const res = await post({
      title: "Escalation basics",
      content_type: "written_guidance",
      material_text: "Escalate within 24 hours.",
      completion_prompt: "What will you escalate sooner?",
    });
    expect(res.status).toBe(201);
    expect(textCalls[0]).toMatchObject({
      quiz_attached: false,
      completion_prompt: "What will you escalate sooner?",
    });
    expect(quizCalls).toHaveLength(0);
  });

  it("no quiz at all: every path keeps its legacy payload untouched", async () => {
    await post({ title: "T", youtube_url: "https://youtu.be/x", completion_prompt: "What will you apply?" });
    expect(trainingCalls[0]).toMatchObject({ quiz_attached: false, completion_prompt: "What will you apply?" });
    expect(quizCalls).toHaveLength(0);
  });
});

describe("a quiz is refused before anything is created when it cannot be trusted", () => {
  it("400s a malformed quiz without calling any creation path", async () => {
    const res = await post({ title: "T", youtube_url: "https://youtu.be/x", quiz: { schemaVersion: 1, questions: [] }, quiz_source: "manual" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "quiz_invalid" });
    expect(trainingCalls).toHaveLength(0);
  });

  it("400s a quiz that will not say where it came from", async () => {
    const res = await post({ title: "T", youtube_url: "https://youtu.be/x", quiz: QUIZ });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "quiz_source_invalid" });
    expect(trainingCalls).toHaveLength(0);
  });
});

describe("atomicity — a training meant to be completed by a quiz never goes live without one", () => {
  it("compensates the event when the quiz cannot be persisted", async () => {
    quizResult.ok = false;
    const res = await post({ title: "T", youtube_url: "https://youtu.be/x", quiz: QUIZ, quiz_source: "manual" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "quiz_insert_failed" });
    expect(deleted).toEqual([
      { table: "foundry_events", filters: { id: "ev-video", owner_user_id: "owner-1" } },
    ]);
  });
});
