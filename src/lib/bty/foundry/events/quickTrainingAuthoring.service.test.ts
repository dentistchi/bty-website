/**
 * Quick Training authoring — what actually gets STORED (Slice Quick Training Authoring V1).
 *
 * The rules are proved pure elsewhere; this file proves the three creation paths obey them
 * against a faithful in-memory Supabase, including the two facts that matter most:
 *
 *   - a quiz-backed training stores NULL where the completion question used to be, and never a
 *     fabricated placeholder;
 *   - a training with NO quiz still cannot be created without one, exactly as before.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ newCoreTotal: 10 })),
}));

const embedState = { value: "embeddable" as string };
vi.mock("./youtubeEmbed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./youtubeEmbed")>();
  return { ...actual, resolveYoutubeEmbeddable: async () => embedState.value };
});

import { createTrainingEvent } from "./foundryTrainingService";
import { createDocumentEvent } from "./foundryDocumentService";
import { createQuickTextEvent } from "./quickTrainingTextService";
import { attachReviewedQuiz, readReviewedQuiz, readQuizSourceKind } from "./quickTrainingQuizService";
import { readPublishedGuidance } from "@/domain/foundry/module/module-publish";
import type { Quiz } from "@/domain/foundry/events/quickTrainingQuiz";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-quick-training-authoring-secret-0123456789";
});
beforeEach(() => {
  embedState.value = "embeddable";
});

type Row = Record<string, unknown>;

const UNIQUE: Record<string, string[][]> = {
  foundry_event_training_content: [["event_id"]],
  foundry_event_document_content: [["event_id"]],
  foundry_event_module: [["event_id"]],
  foundry_event_quizzes: [["event_id"]],
};

/** Columns the live schema declares NOT NULL and this fake therefore refuses too. */
const NOT_NULL: Record<string, string[]> = {
  foundry_event_quizzes: ["event_id", "source_kind", "quiz_snapshot", "question_count", "created_by_user_id"],
  foundry_event_module: ["event_id", "module_snapshot", "module_version"],
};

function makeFakeAdmin(opts: { failQuizInsert?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    foundry_events: [],
    foundry_event_participants: [],
    foundry_event_training_content: [],
    foundry_event_document_content: [],
    foundry_event_module: [],
    foundry_event_quizzes: [],
    foundry_programs: [],
  };
  let counter = 0;
  const nid = (t: string) => `${t}-${++counter}`;
  const removedObjects: string[] = [];

  function defaults(table: string, r: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_events")
      return { id: nid("ev"), status: "open", content_type: "youtube", join_version: 1, created_at: now, closed_at: null, ...r };
    if (table === "foundry_event_module") return { created_at: now, source_draft_id: null, ...r };
    if (table === "foundry_event_quizzes") return { schema_version: 1, created_at: now, ...r };
    return { id: nid(table), created_at: now, ...r };
  }

  function violatesUnique(table: string, row: Row): boolean {
    return (UNIQUE[table] ?? []).some((cols) =>
      tables[table]!.some((existing) => cols.every((c) => existing[c] != null && existing[c] === row[c])),
    );
  }
  function violatesNotNull(table: string, row: Row): boolean {
    return (NOT_NULL[table] ?? []).some((c) => row[c] === undefined || row[c] === null);
  }

  class Q {
    private filters: Array<{ col: string; val: unknown; kind: "eq" | "in" | "is" }> = [];
    private mode: "select" | "insert" | "update" | "delete" = "select";
    private rows: Row[] = [];
    private patch: Row = {};
    private lastInserted: Row[] = [];
    private error: { message: string } | null = null;
    constructor(private store: Row[], private table: string) {}
    select() { return this; }
    insert(r: Row | Row[]) { this.mode = "insert"; this.rows = Array.isArray(r) ? r : [r]; return this; }
    update(p: Row) { this.mode = "update"; this.patch = p; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(col: string, val: unknown) { this.filters.push({ col, val, kind: "eq" }); return this; }
    in(col: string, vals: unknown[]) { this.filters.push({ col, val: vals, kind: "in" }); return this; }
    is(col: string, val: unknown) { this.filters.push({ col, val, kind: "is" }); return this; }
    order() { return this; }
    limit() { return this; }
    returns() { return this; }
    private match(row: Row) {
      return this.filters.every((f) => {
        if (f.kind === "eq") return row[f.col] === f.val;
        if (f.kind === "in") return (f.val as unknown[]).includes(row[f.col]);
        return (row[f.col] ?? null) === (f.val ?? null);
      });
    }
    private exec(): { data: Row[]; error: { message: string } | null } {
      if (this.mode === "insert") {
        for (const r of this.rows) {
          if (this.table === "foundry_event_quizzes" && opts.failQuizInsert) {
            this.error = { message: "quiz write refused" };
            return { data: [], error: this.error };
          }
          const withDefaults = defaults(this.table, r);
          if (violatesUnique(this.table, withDefaults) || violatesNotNull(this.table, withDefaults)) {
            this.error = { message: "constraint violation" };
            return { data: [], error: this.error };
          }
          this.lastInserted.push(withDefaults);
          this.store.push(withDefaults);
        }
        return { data: this.lastInserted, error: null };
      }
      if (this.mode === "update") {
        const matched = this.store.filter((r) => this.match(r));
        matched.forEach((r) => Object.assign(r, this.patch));
        return { data: matched, error: null };
      }
      if (this.mode === "delete") {
        const removed = this.store.filter((r) => this.match(r));
        const keep = this.store.filter((r) => !this.match(r));
        this.store.length = 0;
        this.store.push(...keep);
        // Cascade the two 1:1 children the live schema cascades on event delete.
        if (this.table === "foundry_events") {
          for (const child of ["foundry_event_training_content", "foundry_event_document_content", "foundry_event_module"]) {
            const ids = new Set(removed.map((r) => r.id));
            tables[child] = tables[child]!.filter((r) => !ids.has(r.event_id));
          }
        }
        return { data: removed, error: null };
      }
      return { data: this.store.filter((r) => this.match(r)), error: null };
    }
    single() {
      const res = this.exec();
      return Promise.resolve({ data: (this.mode === "insert" ? this.lastInserted[0] : res.data[0]) ?? null, error: res.error });
    }
    maybeSingle() {
      const res = this.exec();
      return Promise.resolve({ data: res.data[0] ?? null, error: res.error });
    }
    then(onF: (v: { data: Row[]; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
      return Promise.resolve(this.exec()).then(onF, onR);
    }
  }

  const rpc = (name: string) =>
    name === "bty_foundry_resolve_or_create_program"
      ? Promise.resolve({ data: [{ program_id: "prog-test" }], error: null })
      : Promise.resolve({ data: null, error: { message: "unknown rpc" } });

  const storage = {
    from: () => ({
      upload: (path: string) => Promise.resolve({ data: { path }, error: null }),
      remove: (paths: string[]) => {
        removedObjects.push(...paths);
        return Promise.resolve({ data: null, error: null });
      },
      createSignedUrl: (path: string) => Promise.resolve({ data: { signedUrl: `https://s/${path}` }, error: null }),
    }),
  };

  return {
    admin: { from: (t: string) => new Q((tables[t] ??= []), t), rpc, storage } as unknown as SupabaseClient,
    tables,
  };
}

const OWNER = "owner-1";
const YOUTUBE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const QUIZ: Quiz = {
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
  ],
};

function canonicalPdf(owner: string) {
  return {
    bucket: "foundry-docs",
    path: `${owner}/doc-abc.pdf`,
    byteSize: 12345,
    pageCount: 3,
    pageCountVerified: true,
    contentHash: "abc123",
    fileName: "handbook.pdf",
    sourceType: "uploaded_pdf" as const,
    originalFileId: null,
  };
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

describe("VIDEO + quiz — no completion question is stored, and none is invented", () => {
  it("creates the training with completion_prompt NULL and attaches the quiz", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createTrainingEvent(admin, OWNER, {
      title: "Incident reporting",
      youtube_url: YOUTUBE,
      quiz_attached: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const content = tables.foundry_event_training_content[0]!;
    expect(content.completion_prompt).toBeNull();
    expect(created.value.event.training?.completion_prompt ?? null).toBeNull();

    const attached = await attachReviewedQuiz(admin, created.value.event.id, OWNER, QUIZ, "manual");
    expect(attached).toEqual({ ok: true });
    expect(tables.foundry_event_quizzes[0]).toMatchObject({
      event_id: created.value.event.id,
      source_kind: "manual",
      question_count: 1,
      created_by_user_id: OWNER,
    });
  });

  it("refuses a completion question supplied alongside a quiz, and creates nothing", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createTrainingEvent(admin, OWNER, {
      title: "Incident reporting",
      youtube_url: YOUTUBE,
      completion_prompt: "What will you apply?",
      quiz_attached: true,
    });
    expect(created).toEqual({ ok: false, reason: "completion_prompt_not_applicable" });
    expect(tables.foundry_events).toHaveLength(0);
  });
});

describe("VIDEO without a quiz — the legacy contract is untouched", () => {
  it("still requires the completion question", async () => {
    const { admin, tables } = makeFakeAdmin();
    expect(await createTrainingEvent(admin, OWNER, { title: "T", youtube_url: YOUTUBE })).toEqual({
      ok: false,
      reason: "prompt_required",
    });
    expect(tables.foundry_events).toHaveLength(0);
  });

  it("stores the Host's question verbatim when one is given", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createTrainingEvent(admin, OWNER, {
      title: "T",
      youtube_url: YOUTUBE,
      completion_prompt: "  What will you apply?  ",
    });
    expect(created.ok).toBe(true);
    expect(tables.foundry_event_training_content[0]!.completion_prompt).toBe("What will you apply?");
  });
});

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

describe("PDF + quiz — the same rule on the other content table", () => {
  it("creates the document training with completion_prompt NULL", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createDocumentEvent(admin, OWNER, {
      title: "Handbook",
      quiz_attached: true,
      canonical: canonicalPdf(OWNER),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(tables.foundry_event_document_content[0]!.completion_prompt).toBeNull();
    expect(created.value.event.document?.completion_prompt ?? null).toBeNull();
  });

  it("without a quiz the reflection question is still required", async () => {
    const { admin, tables } = makeFakeAdmin();
    expect(
      await createDocumentEvent(admin, OWNER, { title: "Handbook", canonical: canonicalPdf(OWNER) }),
    ).toEqual({ ok: false, reason: "prompt_required" });
    expect(tables.foundry_events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Text — the EXISTING written-guidance runtime
// ---------------------------------------------------------------------------

describe("TEXT — reuses written_guidance and creates no second text system", () => {
  it("with a quiz: written_guidance event, frozen content, no completion prompt", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createQuickTextEvent(admin, OWNER, {
      title: "Escalation basics",
      material_text: "  Escalate an incident within 24 hours.  ",
      quiz_attached: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const event = tables.foundry_events[0]!;
    expect(event.content_type).toBe("written_guidance");
    // No new content table: the learner's text rides the existing module snapshot.
    expect(tables.foundry_event_training_content).toHaveLength(0);
    expect(tables.foundry_event_document_content).toHaveLength(0);

    const module = tables.foundry_event_module[0]!;
    expect(module.source_draft_id).toBeNull();
    const frozen = readPublishedGuidance(module.module_snapshot);
    expect(frozen).toEqual({
      version: 1,
      contentType: "written_guidance",
      materialText: "Escalate an incident within 24 hours.",
      completionPrompt: null,
      sharedQuestion: null,
      completionEvidence: "quiz",
    });
  });

  it("without a quiz: the completion question is required, and is what the learner is asked", async () => {
    const { admin, tables } = makeFakeAdmin();
    expect(
      await createQuickTextEvent(admin, OWNER, { title: "Escalation basics", material_text: "Escalate within a day." }),
    ).toEqual({ ok: false, reason: "prompt_required" });
    expect(tables.foundry_events).toHaveLength(0);

    const created = await createQuickTextEvent(admin, OWNER, {
      title: "Escalation basics",
      material_text: "Escalate within a day.",
      completion_prompt: "What will you escalate sooner?",
    });
    expect(created.ok).toBe(true);
    const frozen = readPublishedGuidance(tables.foundry_event_module[0]!.module_snapshot);
    expect(frozen?.completionPrompt).toBe("What will you escalate sooner?");
    expect(frozen?.completionEvidence).toBe("response");
  });

  it("refuses empty or over-long material before creating anything", async () => {
    const { admin, tables } = makeFakeAdmin();
    expect(await createQuickTextEvent(admin, OWNER, { title: "T", material_text: "   ", completion_prompt: "p" })).toEqual({
      ok: false,
      reason: "material_text_required",
    });
    expect(
      await createQuickTextEvent(admin, OWNER, { title: "T", material_text: "x".repeat(2001), completion_prompt: "p" }),
    ).toEqual({ ok: false, reason: "material_text_too_long" });
    expect(tables.foundry_events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Provenance + atomicity
// ---------------------------------------------------------------------------

describe("source_kind names the method that produced the questions", () => {
  it.each(["manual", "csv", "generated"] as const)("stores %s exactly as given", async (kind) => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createTrainingEvent(admin, OWNER, { title: "T", youtube_url: YOUTUBE, quiz_attached: true });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await attachReviewedQuiz(admin, created.value.event.id, OWNER, QUIZ, kind);
    expect(tables.foundry_event_quizzes[0]!.source_kind).toBe(kind);
  });

  it("never guesses: an unrecognised or missing source kind is refused, not coerced to 'manual'", () => {
    expect(readQuizSourceKind("generated")).toBe("generated");
    for (const bad of [undefined, null, "", "ai", "MANUAL"]) expect(readQuizSourceKind(bad)).toBeNull();
  });

  it("refuses a malformed quiz before anything is written", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createTrainingEvent(admin, OWNER, { title: "T", youtube_url: YOUTUBE, quiz_attached: true });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const noAnswer = { ...QUIZ, questions: [{ ...QUIZ.questions[0]!, correctChoiceId: "z" }] };
    expect(readReviewedQuiz(noAnswer)).toBeNull();
    expect(await attachReviewedQuiz(admin, created.value.event.id, OWNER, noAnswer, "manual")).toEqual({
      ok: false,
      reason: "quiz_invalid",
    });
    expect(tables.foundry_event_quizzes).toHaveLength(0);
  });
});

describe("a quiz that cannot be persisted must not leave a training with no completion check", () => {
  it("a failed quiz insert is reported, so the caller can compensate the event it belongs to", async () => {
    const { admin, tables } = makeFakeAdmin({ failQuizInsert: true });
    const created = await createTrainingEvent(admin, OWNER, { title: "T", youtube_url: YOUTUBE, quiz_attached: true });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const attached = await attachReviewedQuiz(admin, created.value.event.id, OWNER, QUIZ, "manual");
    expect(attached).toEqual({ ok: false, reason: "quiz_insert_failed" });

    // The route's compensation: delete the event, which cascades its content row.
    await admin.from("foundry_events").delete().eq("id", created.value.event.id).eq("owner_user_id", OWNER);
    expect(tables.foundry_events).toHaveLength(0);
    expect(tables.foundry_event_training_content).toHaveLength(0);
    expect(tables.foundry_event_quizzes).toHaveLength(0);
  });
});
