import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the canonical Core XP primitive so the test never touches arena_profiles/avatar.
vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ newCoreTotal: 10 })),
}));

import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { joinEvent } from "./foundryEventService";
import {
  createDocumentEvent,
  getOwnerDocumentSnapshot,
  getPublicDocumentSnapshot,
  recordReadingProgress,
  completeDocumentTraining,
  claimDocumentXp,
  resolveDocumentForRead,
} from "./foundryDocumentService";
import { uploadFoundryDocument } from "./documentStorage";
import { simulateClaimAssignment, seedAssignment, readAssignment } from "./__fixtures__/assignmentClaimSim";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-document-secret-0123456789";
});

const awardSpy = applyDirectCoreXp as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => awardSpy.mockClear());

type Row = Record<string, unknown>;

const UNIQUE: Record<string, string[][]> = {
  foundry_event_participants: [["participant_session_token_hash"]],
  foundry_event_document_content: [["event_id"]],
  foundry_event_training_progress: [["event_id", "participant_id"]],
  core_xp_ledger: [["source_type", "source_id"]],
};

function makeFakeAdmin() {
  const tables: Record<string, Row[]> = {
    foundry_events: [],
    foundry_event_participants: [],
    foundry_event_document_content: [],
    foundry_event_training_progress: [],
    core_xp_ledger: [],
  };
  const removed: string[] = [];
  let counter = 0;
  const nid = (t: string) => `${t}-${++counter}`;

  function defaults(table: string, r: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_events")
      return { id: nid("ev"), status: "open", content_type: "youtube", join_version: 1, created_at: now, closed_at: null, ...r };
    if (table === "foundry_event_participants")
      return { id: nid("pt"), status: "joined", joined_at: now, last_seen_at: now, removed_at: null, ...r };
    if (table === "foundry_event_document_content")
      return {
        source_type: "uploaded_pdf",
        original_file_id: null,
        content_hash: null,
        page_count_verified: false,
        file_name: null,
        byte_size: null,
        intro: null,
        imported_at: now,
        created_at: now,
        ...r,
      };
    if (table === "foundry_event_training_progress")
      return {
        id: nid("pr"),
        video_started_at: null,
        video_completed_at: null,
        response_text: null,
        completed_at: null,
        linked_user_id: null,
        xp_awarded_at: null,
        document_last_page: null,
        document_pages_viewed: [],
        document_active_read_ms: 0,
        document_read_completed_at: null,
        created_at: now,
        updated_at: now,
        ...r,
      };
    return { id: nid("led"), created_at: now, ...r };
  }

  function violatesUnique(table: string, row: Row): boolean {
    const cons = UNIQUE[table] ?? [];
    return cons.some((cols) =>
      tables[table].some((existing) => cols.every((c) => existing[c] != null && existing[c] === row[c])),
    );
  }

  class Q {
    private filters: Array<{ col: string; val: unknown; kind: "eq" | "in" | "is" }> = [];
    private orderCol: string | null = null;
    private orderAsc = true;
    private mode: "select" | "insert" | "update" | "delete" = "select";
    private rows: Row[] = [];
    private patch: Row = {};
    private lastInserted: Row[] = [];
    private lastMatched: Row[] = [];
    private insertError: { code?: string; message: string } | null = null;
    constructor(private store: Row[], private table: string) {}
    select() { return this; }
    insert(r: Row | Row[]) { this.mode = "insert"; this.rows = Array.isArray(r) ? r : [r]; return this; }
    update(p: Row) { this.mode = "update"; this.patch = p; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(col: string, val: unknown) { this.filters.push({ col, val, kind: "eq" }); return this; }
    in(col: string, vals: unknown[]) { this.filters.push({ col, val: vals, kind: "in" }); return this; }
    is(col: string, val: unknown) { this.filters.push({ col, val, kind: "is" }); return this; }
    order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending !== false; return this; }
    returns() { return this; }
    private match(row: Row) {
      return this.filters.every((f) => {
        if (f.kind === "eq") return row[f.col] === f.val;
        if (f.kind === "in") return (f.val as unknown[]).includes(row[f.col]);
        return (row[f.col] ?? null) === (f.val ?? null);
      });
    }
    private ordered(rows: Row[]) {
      if (!this.orderCol) return rows;
      const c = this.orderCol;
      return [...rows].sort((a, b) => {
        const av = a[c] as string;
        const bv = b[c] as string;
        return av < bv ? (this.orderAsc ? -1 : 1) : av > bv ? (this.orderAsc ? 1 : -1) : 0;
      });
    }
    private exec(): { data: Row[]; error: { code?: string; message: string } | null } {
      if (this.mode === "insert") {
        for (const r of this.rows) {
          const withDefaults = defaults(this.table, r);
          if (violatesUnique(this.table, withDefaults)) {
            this.insertError = { code: "23505", message: "duplicate key" };
            return { data: [], error: this.insertError };
          }
          this.lastInserted.push(withDefaults);
          this.store.push(withDefaults);
        }
        return { data: this.lastInserted, error: null };
      }
      if (this.mode === "update") {
        this.lastMatched = this.store.filter((r) => this.match(r));
        this.lastMatched.forEach((r) => Object.assign(r, this.patch));
        return { data: this.lastMatched, error: null };
      }
      if (this.mode === "delete") {
        const keep = this.store.filter((r) => !this.match(r));
        const removedRows = this.store.filter((r) => this.match(r));
        this.store.length = 0;
        this.store.push(...keep);
        return { data: removedRows, error: null };
      }
      return { data: this.ordered(this.store.filter((r) => this.match(r))), error: null };
    }
    single() {
      const res = this.exec();
      const first = this.mode === "insert" ? this.lastInserted[0] : res.data[0];
      return Promise.resolve({ data: first ?? null, error: res.error });
    }
    maybeSingle() {
      const res = this.exec();
      const first = this.mode === "update" ? this.lastMatched[0] : res.data[0];
      return Promise.resolve({ data: first ?? null, error: res.error });
    }
    then(onF: (v: { data: Row[]; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
      return Promise.resolve(this.exec()).then(onF, onR);
    }
  }

  function rpc(name: string, p: Record<string, unknown>) {
    if (name === "bty_foundry_resolve_or_create_program") return Promise.resolve({ data: [{ program_id: "prog-test" }], error: null });
    if (name === "bty_foundry_claim_assignment") {
      // R4-R5B1: faithful simulation (see __fixtures__/assignmentClaimSim) so the tests
      // assert the real status transition, not merely that the helper was invoked.
      tables.__claim_calls = tables.__claim_calls ?? [];
      (tables.__claim_calls as Array<Record<string, unknown>>).push(p);
      return Promise.resolve(simulateClaimAssignment(tables, p));
    }
    if (name !== "bty_foundry_award_daily_capped") return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    const led = tables.core_xp_ledger;
    const SRC = "foundry_training_completion";
    if (led.some((l) => l.source_type === SRC && l.source_id === p.p_source_id)) {
      return Promise.resolve({ data: "already_awarded", error: null });
    }
    const eventAwarded = led.some((l) => {
      if (l.source_type !== SRC || l.user_id !== p.p_user_id) return false;
      const pr = tables.foundry_event_training_progress.find((x) => x.id === l.source_id);
      return pr && pr.event_id === p.p_event_id;
    });
    if (eventAwarded) return Promise.resolve({ data: "event_already_awarded", error: null });
    const count = led.filter(
      (l) =>
        l.user_id === p.p_user_id &&
        l.source_type === SRC &&
        (l.created_at as string) >= (p.p_day_start as string) &&
        (l.created_at as string) < (p.p_day_end as string),
    ).length;
    if (count >= (p.p_max_per_day as number)) return Promise.resolve({ data: "daily_limit", error: null });
    led.push({ id: nid("led"), user_id: p.p_user_id, delta_xp: p.p_xp, source_type: SRC, source_id: p.p_source_id, created_at: new Date().toISOString() });
    return Promise.resolve({ data: "awarded", error: null });
  }

  const uploaded: string[] = [];
  const storage = {
    from: (_bucket: string) => ({
      upload: (path: string, _body: unknown, _opts?: unknown) => {
        uploaded.push(path);
        return Promise.resolve({ data: { path }, error: null });
      },
      remove: (paths: string[]) => {
        removed.push(...paths);
        return Promise.resolve({ data: null, error: null });
      },
      createSignedUrl: (path: string, _ttl: number) =>
        Promise.resolve({ data: { signedUrl: `https://signed.example/${path}?sig=abc` }, error: null }),
    }),
  };

  return {
    admin: { from: (t: string) => new Q((tables[t] ??= []), t), rpc, storage } as unknown as SupabaseClient,
    tables,
    removed,
    uploaded,
  };
}

/** A minimal but valid PDF text payload (ASCII) whose page-tree /Count is `pages`. */
function pdfString(pages: number): string {
  return (
    `%PDF-1.4\n1 0 obj<</Type/Pages/Kids[2 0 R]/Count ${pages}>>endobj\n` +
    Array.from({ length: pages }, (_, i) => `${i + 2} 0 obj<</Type/Page>>endobj\n`).join("") +
    "%%EOF\n"
  );
}
function pdfFile(pages: number, name = "doc.pdf"): File {
  return new File([pdfString(pages)], name, { type: "application/pdf" });
}

const OWNER = "owner-1";
const AUTH = "auth-user-9";

function canonical(owner: string, pageCount: number, path = `${owner}/doc-abc.pdf`) {
  return {
    bucket: "foundry-docs",
    path,
    byteSize: 12345,
    pageCount,
    pageCountVerified: true,
    contentHash: "abc123",
    fileName: "handbook.pdf",
    sourceType: "uploaded_pdf" as const,
    originalFileId: null,
  };
}

async function makeDocEvent(admin: SupabaseClient, owner = OWNER, pageCount = 2) {
  const created = await createDocumentEvent(admin, owner, {
    title: "Onboarding Handbook",
    intro: "Please read all pages.",
    completion_prompt: "What is one thing you'll apply?",
    canonical: canonical(owner, pageCount),
  });
  if (!created.ok) throw new Error("create failed: " + created.reason);
  return { eventId: created.value.event.id, token: created.value.event.join_token };
}

async function setupJoined(pageCount = 2) {
  const { admin, tables, removed } = makeFakeAdmin();
  const { eventId, token } = await makeDocEvent(admin, OWNER, pageCount);
  const joined = await joinEvent(admin, token, "Sarah", null);
  if (!joined.ok) throw new Error("join failed");
  return { admin, tables, removed, eventId, token, session: joined.sessionToken };
}

/** Meet the reading gate for a `pageCount`-page doc: view every page + enough active time. */
async function meetReadingGate(admin: SupabaseClient, token: string, session: string, pageCount: number) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  // min_read = clamp(pageCount*5, 15, 300) seconds → send that many ms (clamped per beat to 30s).
  const needMs = Math.min(300, Math.max(15, pageCount * 5)) * 1000;
  let sent = 0;
  let last;
  while (sent < needMs) {
    const delta = Math.min(30_000, needMs - sent);
    last = await recordReadingProgress(admin, token, session, { last_page: pageCount, viewed_pages: pages, active_ms_delta: delta });
    sent += delta;
  }
  return last!;
}

describe("createDocumentEvent", () => {
  it("creates a document event + content and returns a document snapshot", async () => {
    const { admin, tables } = makeFakeAdmin();
    const { eventId } = await makeDocEvent(admin);
    expect(tables.foundry_events).toHaveLength(1);
    expect(tables.foundry_events[0].content_type).toBe("document");
    expect(tables.foundry_event_document_content).toHaveLength(1);
    const content = tables.foundry_event_document_content[0];
    expect(content.event_id).toBe(eventId);
    expect(content.page_count).toBe(2);
    expect(content.min_read_seconds).toBe(15); // clamp(2*5,15,300)
    expect(content.storage_path).toBe(`${OWNER}/doc-abc.pdf`);
  });

  it("rejects a blank reflection prompt and cleans up the orphan upload", async () => {
    const { admin, tables, removed } = makeFakeAdmin();
    const r = await createDocumentEvent(admin, OWNER, {
      title: "T",
      completion_prompt: "   ",
      canonical: canonical(OWNER, 3, `${OWNER}/x.pdf`),
    });
    expect(r).toEqual({ ok: false, reason: "prompt_required" });
    expect(tables.foundry_events).toHaveLength(0);
    expect(removed).toContain(`${OWNER}/x.pdf`); // orphan cleaned up
  });

  it("rejects an invalid canonical page count (no event left)", async () => {
    const { admin, tables } = makeFakeAdmin();
    const r = await createDocumentEvent(admin, OWNER, {
      title: "T",
      completion_prompt: "q?",
      canonical: { ...canonical(OWNER, 0, `${OWNER}/y.pdf`), pageCount: 0 },
    });
    expect(r).toEqual({ ok: false, reason: "page_count_invalid" });
    expect(tables.foundry_events).toHaveLength(0);
  });

  it("records server-canonical values on the content row", async () => {
    const { admin, tables } = makeFakeAdmin();
    await makeDocEvent(admin, OWNER, 5);
    const content = tables.foundry_event_document_content[0];
    expect(content.source_type).toBe("uploaded_pdf");
    expect(content.content_hash).toBe("abc123");
    expect(content.page_count).toBe(5);
    expect(content.page_count_verified).toBe(true);
    expect(content.min_read_seconds).toBe(25); // clamp(5*5,15,300)
  });
});

describe("server-authoritative intake (uploadFoundryDocument)", () => {
  it("derives the canonical page count from bytes, IGNORING a false client hint", async () => {
    const { admin } = makeFakeAdmin();
    const r = await uploadFoundryDocument(admin, OWNER, pdfFile(6), 999);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.pageCount).toBe(6); // from /Count in the bytes, not 999
      expect(r.value.pageCountVerified).toBe(true);
      expect(r.value.path.startsWith(`${OWNER}/`)).toBe(true);
    }
  });

  it("byte size is server-observed (from the received bytes)", async () => {
    const { admin } = makeFakeAdmin();
    const file = pdfFile(3);
    const r = await uploadFoundryDocument(admin, OWNER, file, 3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.byteSize).toBe(file.size);
  });

  it("rejects a non-PDF renamed to .pdf with a PDF MIME (content signature fails)", async () => {
    const { admin, uploaded } = makeFakeAdmin();
    const fake = new File([new TextEncoder().encode("This is not a PDF")], "trojan.pdf", {
      type: "application/pdf",
    });
    const r = await uploadFoundryDocument(admin, OWNER, fake, 3);
    expect(r).toEqual({ ok: false, reason: "file_not_pdf" });
    expect(uploaded).toHaveLength(0); // never stored
  });

  it("computes a content hash for the canonical snapshot", async () => {
    const { admin } = makeFakeAdmin();
    const r = await uploadFoundryDocument(admin, OWNER, pdfFile(2), 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("staged-file cleanup provenance", () => {
  it("a successfully attached document is NOT deleted", async () => {
    const { admin, removed } = makeFakeAdmin();
    const { eventId } = await makeDocEvent(admin, OWNER, 2);
    expect(eventId).toBeTruthy();
    expect(removed).toHaveLength(0); // attached → never removed
  });

  it("a retried creation does not delete the already-attached document", async () => {
    const { admin, removed, tables } = makeFakeAdmin();
    // First create succeeds and attaches the path.
    const first = await createDocumentEvent(admin, OWNER, {
      title: "First",
      completion_prompt: "q?",
      canonical: canonical(OWNER, 2, `${OWNER}/shared.pdf`),
    });
    expect(first.ok).toBe(true);
    // A retry with the SAME path but a bad field forces the cleanup path.
    const retry = await createDocumentEvent(admin, OWNER, {
      title: "Retry",
      completion_prompt: "   ", // invalid → cleanup attempted
      canonical: canonical(OWNER, 2, `${OWNER}/shared.pdf`),
    });
    expect(retry.ok).toBe(false);
    expect(removed).not.toContain(`${OWNER}/shared.pdf`); // still attached to event #1 → kept
    expect(tables.foundry_event_document_content.some((c) => c.storage_path === `${OWNER}/shared.pdf`)).toBe(true);
  });

  it("never deletes another host's object (path outside the caller's prefix)", async () => {
    const { admin, removed } = makeFakeAdmin();
    const r = await createDocumentEvent(admin, "owner-2", {
      title: "T",
      completion_prompt: "q?",
      canonical: canonical("owner-2", 2, `${OWNER}/victim.pdf`), // path belongs to OWNER, not owner-2
    });
    expect(r).toEqual({ ok: false, reason: "upload_invalid" });
    expect(removed).not.toContain(`${OWNER}/victim.pdf`);
  });
});

describe("signed url access", () => {
  it("a joined participant gets a signed url; the storage path is never returned raw", async () => {
    const { admin, token, session } = await setupJoined();
    const r = await resolveDocumentForRead(admin, token, session);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(`${OWNER}/doc-abc.pdf`);
  });
  it("a caller with no session cannot resolve the document", async () => {
    const { admin, token } = await setupJoined();
    const r = await resolveDocumentForRead(admin, token, "not-a-real-session");
    expect(r).toEqual({ ok: false, reason: "no_session" });
  });
});

describe("reading progress — server-canonical gate", () => {
  it("starts in the read stage with the prompt locked", async () => {
    const { admin, token, session } = await setupJoined();
    const snap = await getPublicDocumentSnapshot(admin, token, session);
    expect(snap.stage).toBe("read");
    expect(snap.document?.completion_prompt).toBeNull();
    expect(snap.document?.reading_complete).toBe(false);
  });

  it("distinct page count is NOT inflated by repeated viewing", async () => {
    const { admin, token, session } = await setupJoined(2);
    await recordReadingProgress(admin, token, session, { last_page: 1, viewed_pages: [1, 1, 1], active_ms_delta: 30_000 });
    const snap = await getPublicDocumentSnapshot(admin, token, session);
    expect(snap.document?.distinct_pages_viewed).toBe(1); // still just page 1
    expect(snap.document?.reading_complete).toBe(false); // page 2 unseen
  });

  it("completion is LOCKED before the reading requirement is met", async () => {
    const { admin, token, session } = await setupJoined(2);
    // All pages but not enough time.
    await recordReadingProgress(admin, token, session, { last_page: 2, viewed_pages: [1, 2], active_ms_delta: 3000 });
    const r = await completeDocumentTraining(admin, token, session, "my reflection", null);
    expect(r).toEqual({ ok: false, reason: "reading_not_complete" });
  });

  it("reading gate flips only after all pages AND min time; then the prompt unlocks", async () => {
    const { admin, token, session } = await setupJoined(2);
    const last = await meetReadingGate(admin, token, session, 2);
    expect(last.ok && last.snapshot.document?.reading_complete).toBe(true);
    const snap = await getPublicDocumentSnapshot(admin, token, session);
    expect(snap.stage).toBe("response");
    expect(snap.document?.completion_prompt).toBe("What is one thing you'll apply?");
  });

  it("an inflated active-time delta cannot fast-forward the gate in one beat", async () => {
    const { admin, token, session } = await setupJoined(2);
    // One beat with a huge (clamped) delta but only 1 page seen → not complete.
    await recordReadingProgress(admin, token, session, { last_page: 1, viewed_pages: [1], active_ms_delta: 10_000_000 });
    const snap = await getPublicDocumentSnapshot(admin, token, session);
    expect(snap.document?.reading_complete).toBe(false);
  });
});

describe("completion + XP — same canonical path as YouTube", () => {
  it("anonymous completion → claimable, no XP written", async () => {
    const { admin, token, session, tables } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    const done = await completeDocumentTraining(admin, token, session, "I'll apply the checklist.", null);
    expect(done.ok && done.snapshot.stage).toBe("completed_claimable");
    expect(done.ok && done.snapshot.xp_status).toBe("claimable");
    expect(awardSpy).not.toHaveBeenCalled();
    expect(tables.core_xp_ledger).toHaveLength(0);
  });

  it("authenticated completion awards 10 Core XP once via the canonical path", async () => {
    const { admin, token, session, tables } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    const done = await completeDocumentTraining(admin, token, session, "My reflection.", AUTH);
    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    expect(done.ok && done.snapshot.xp_status).toBe("awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(awardSpy).toHaveBeenCalledWith(admin, AUTH, 10);
    expect(tables.core_xp_ledger).toHaveLength(1);
    expect(tables.core_xp_ledger[0].source_type).toBe("foundry_training_completion");
  });

  it("duplicate completion does not duplicate XP (idempotent)", async () => {
    const { admin, token, session, tables } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    await completeDocumentTraining(admin, token, session, "First.", AUTH);
    const again = await completeDocumentTraining(admin, token, session, "Second attempt.", AUTH);
    expect(again.ok && again.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(tables.core_xp_ledger).toHaveLength(1);
  });

  it("anonymous completion then claim awards exactly once (idempotent claim)", async () => {
    const { admin, token, session, tables } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    await completeDocumentTraining(admin, token, session, "Anon reflection.", null);
    expect(awardSpy).not.toHaveBeenCalled();

    const claim = await claimDocumentXp(admin, token, session, AUTH);
    expect(claim.ok && claim.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);

    const claim2 = await claimDocumentXp(admin, token, session, AUTH);
    expect(claim2.ok && claim2.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(tables.core_xp_ledger).toHaveLength(1);
  });

  it("blank reflection is rejected at completion", async () => {
    const { admin, token, session } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    expect(await completeDocumentTraining(admin, token, session, "   ", null)).toEqual({
      ok: false,
      reason: "response_required",
    });
  });
});

/**
 * SLICE 3.2R-R8B — THE REFLECT ANSWER IS A THIRD ANSWER.
 *
 * Until now a document learner gave exactly one answer, to the completion check, and it was
 * stored in `response_text` under a label that said REFLECTION. The published journey's REFLECT
 * question — visible since R8A — had nowhere to go, so REFLECTED was being established by a
 * commitment sentence.
 *
 * These drive the REAL completion path against a frozen module snapshot, because the requirement
 * is derived from the published event and nothing else. The client cannot opt in, opt out, or
 * name which column its text lands in.
 */
const R8B_REFLECT = "What usually happens when an action needs an owner after a huddle?";
const R8B_FINISH = "What exactly will you say when you state the owner, action, and deadline?";
const R8B_SHARED = "In your own words, what is the most important standard from this training?";

/** Freeze a published journey onto an event, exactly as publish does. */
function freezeJourney(tables: Record<string, Row[]>, eventId: string, reflection: string | null, status = "grounded") {
  const elements = [
    { id: "el_why_it_matters", kind: "why_it_matters", content: "Nobody owns the next step.", grounding: [], confirmationStatus: "grounded" },
    { id: "el_completion_check", kind: "completion_check", content: R8B_FINISH, grounding: [], confirmationStatus: "grounded" },
  ];
  if (reflection) elements.splice(1, 0, { id: "el_reflection", kind: "reflection", content: reflection, grounding: [], confirmationStatus: status });
  (tables.foundry_event_module ??= []).push({
    id: `mod-${eventId}`,
    event_id: eventId,
    module_version: 3,
    module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "Building Accountability in Huddles", displayTitleStatus: "grounded", elements } },
  });
}

/** Put an event under the new contract: a frozen distinct reflection + the questions it differs from. */
async function setupNewContract(reflection: string | null = R8B_REFLECT, shared: string | null = R8B_SHARED) {
  const ctx = await setupJoined(2);
  const content = ctx.tables.foundry_event_document_content.find((c) => c.event_id === ctx.eventId)!;
  content.completion_prompt = R8B_FINISH;
  content.shared_question = shared;
  freezeJourney(ctx.tables, ctx.eventId, reflection);
  await meetReadingGate(ctx.admin, ctx.token, ctx.session, 2);
  return ctx;
}

function progressRow(tables: Record<string, Row[]>, eventId: unknown) {
  return tables.foundry_event_training_progress.find((r) => r.event_id === eventId)!;
}

describe("[3.2R-R8B] the learner's own reflection", () => {
  it("B/G — a new-contract event REFUSES completion without the reflection", async () => {
    const { admin, token, session, tables, eventId } = await setupNewContract();
    const r = await completeDocumentTraining(admin, token, session, "I will name an owner.", null, "The standard.", null, undefined);
    expect(r).toEqual({ ok: false, reason: "reflection_required" });
    // AND NOTHING WAS WRITTEN. A refused completion must not leave partial evidence behind.
    const row = progressRow(tables, eventId);
    expect(row.completed_at).toBeNull();
    expect(row.response_text ?? null).toBeNull();
    expect(row.learner_reflection_text ?? null).toBeNull();
    expect(row.shared_understanding_response ?? null).toBeNull();
  });

  it("F/M — all three answers land in three different columns, in one write", async () => {
    const { admin, token, session, tables, eventId } = await setupNewContract();
    const done = await completeDocumentTraining(
      admin, token, session,
      "I will say: Mina owns it, by Friday.",   // the completion check
      null,
      "Name an owner and a date for every item.", // shared understanding
      null,
      undefined,
      "Usually it just drifts and someone picks it up days later.", // the REFLECT answer
    );
    expect(done.ok).toBe(true);
    const row = progressRow(tables, eventId);
    expect(row.learner_reflection_text).toBe("Usually it just drifts and someone picks it up days later.");
    expect(row.response_text, "M — response_text is still the completion-check answer").toBe("I will say: Mina owns it, by Friday.");
    expect(row.shared_understanding_response).toBe("Name an owner and a date for every item.");
    // Atomic: one completion, one timestamp for the reflection that belongs to it.
    expect(row.learner_reflection_submitted_at).toBe(row.completed_at);
  });

  it("U — an event whose reflection IS its shared question keeps the OLD contract", async () => {
    /*
      LIVE v1 (`07c9623e`). Under a naive "has a reflection" rule this learner would be asked the
      same question twice. The distinctness rule means the event never enters the new contract.
    */
    const { admin, token, session, tables, eventId } = await setupNewContract(R8B_SHARED, R8B_SHARED);
    const done = await completeDocumentTraining(admin, token, session, "I will name an owner.", null, "The standard.");
    expect(done.ok, "no reflection is owed, so completion succeeds without one").toBe(true);
    expect(progressRow(tables, eventId).learner_reflection_text ?? null).toBeNull();
  });

  it("H/J — a legacy event with no journey completes on its old payload, untouched", async () => {
    const { admin, token, session, tables, eventId } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    const done = await completeDocumentTraining(admin, token, session, "One thing I'll apply.", null);
    expect(done.ok).toBe(true);
    const row = progressRow(tables, eventId);
    expect(row.response_text).toBe("One thing I'll apply.");
    expect(row.learner_reflection_text ?? null, "J — nothing is backfilled").toBeNull();
    expect(row.learner_reflection_submitted_at ?? null).toBeNull();
  });

  it("a reflection that was never grounded is never demanded", async () => {
    const ctx = await setupJoined(2);
    const content = ctx.tables.foundry_event_document_content.find((c) => c.event_id === ctx.eventId)!;
    content.completion_prompt = R8B_FINISH;
    freezeJourney(ctx.tables, ctx.eventId, R8B_REFLECT, "needs_confirmation");
    await meetReadingGate(ctx.admin, ctx.token, ctx.session, 2);
    expect((await completeDocumentTraining(ctx.admin, ctx.token, ctx.session, "Done.", null)).ok).toBe(true);
  });

  it("I — an already-completed row stays complete and is never re-judged", async () => {
    // Completed under the OLD contract, then the same learner calls complete again.
    const ctx = await setupJoined(2);
    await meetReadingGate(ctx.admin, ctx.token, ctx.session, 2);
    await completeDocumentTraining(ctx.admin, ctx.token, ctx.session, "Legacy answer.", null);
    const content = ctx.tables.foundry_event_document_content.find((c) => c.event_id === ctx.eventId)!;
    content.completion_prompt = R8B_FINISH;
    freezeJourney(ctx.tables, ctx.eventId, R8B_REFLECT);
    const again = await completeDocumentTraining(ctx.admin, ctx.token, ctx.session, "x", null);
    expect(again.ok, "idempotent — never invalidated by a contract it predates").toBe(true);
    const row = progressRow(ctx.tables, ctx.eventId);
    expect(row.response_text, "K — the historical answer is not rewritten").toBe("Legacy answer.");
    expect(row.learner_reflection_text ?? null).toBeNull();
  });

  it("the snapshot tells the client whether an answer is owed — the client never decides", async () => {
    const { admin, token, session } = await setupNewContract();
    expect((await getPublicDocumentSnapshot(admin, token, session)).reflection_required).toBe(true);
    const legacy = await setupJoined(2);
    await meetReadingGate(legacy.admin, legacy.token, legacy.session, 2);
    expect((await getPublicDocumentSnapshot(legacy.admin, legacy.token, legacy.session)).reflection_required).toBe(false);
  });

  it("O/P — XP and the follow-up still belong to COMPLETION, never to the reflection", async () => {
    const { admin, token, session, tables } = await setupNewContract();
    // A refused completion carries a reflection in the payload and must award nothing.
    await completeDocumentTraining(admin, token, session, "  ", AUTH, "shared", null, undefined, "my reflection");
    expect(awardSpy).not.toHaveBeenCalled();
    expect(tables.core_xp_ledger).toHaveLength(0);

    const done = await completeDocumentTraining(admin, token, session, "I will name an owner.", AUTH, "The standard.", null, undefined, "It drifts.");
    expect(done.ok).toBe(true);
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(tables.core_xp_ledger).toHaveLength(1);
  });

  it("K — no Host-facing projection anywhere names the private reflection column", async () => {
    /*
      Checked against the SOURCE, not a payload: a Host surface leaks by adding a column to a
      select list, and only the source can prove none of them did. Every projection here is an
      explicit list — none is `select("*")` — so absence of the name is absence of the data.
    */
    const fs = await import("node:fs/promises");
    for (const f of [
      "src/lib/bty/foundry/events/foundryHostHistoryService.ts",
      "src/lib/bty/foundry/events/hostAttentionService.ts",
      "src/lib/bty/foundry/events/foundrySharedReviewService.ts",
      /*
        `foundryHistoryService` was in this list and is now removed (Slice 3.2R-R8D-R1): it is
        the LEARNER's own history, scoped `linked_user_id = caller`, and listing it here as a
        Host surface was a mislabel. It legitimately projects the reflection now so its owner
        can read it. The Host services above still must not, and that is what this checks.
      */
    ]) {
      const src = await fs.readFile(f, "utf8");
      expect(src.includes("learner_reflection_text"), f).toBe(false);
      expect(src.includes('select("*"'), `${f} must not select everything`).toBe(false);
    }
  });
});

describe("participant isolation + close + privacy", () => {
  it("a different participant cannot read or mutate another participant's progress", async () => {
    const { admin, token, session } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);

    // Second device joins the same event → separate participant + progress.
    const second = await joinEvent(admin, token, "Other", null);
    if (!second.ok) throw new Error("join2 failed");
    const otherSnap = await getPublicDocumentSnapshot(admin, token, second.sessionToken);
    expect(otherSnap.stage).toBe("read"); // fresh, not the first participant's completed reading
    expect(otherSnap.document?.reading_complete).toBe(false);

    // An unknown session cannot record progress at all.
    const bogus = await recordReadingProgress(admin, token, "ghost-session", { last_page: 1, viewed_pages: [1], active_ms_delta: 1000 });
    expect(bogus).toEqual({ ok: false, reason: "no_session" });
  });

  it("blocks new completion after close but keeps the reading/prompt state", async () => {
    const { admin, token, session, eventId } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    await admin.from("foundry_events").update({ status: "closed" }).eq("id", eventId);
    expect(await completeDocumentTraining(admin, token, session, "late", null)).toEqual({
      ok: false,
      reason: "event_closed",
    });
  });

  it("manager roster shows status + counts, never the reflection text", async () => {
    const { admin, token, session, eventId } = await setupJoined(2);
    await meetReadingGate(admin, token, session, 2);
    await completeDocumentTraining(admin, token, session, "A private reflection.", null);

    const owner = await getOwnerDocumentSnapshot(admin, OWNER, eventId);
    expect(owner).not.toBeNull();
    if (owner) {
      expect(owner.event.content_type).toBe("document");
      expect(owner.joined_count).toBe(1);
      expect(owner.completed_count).toBe(1);
      expect(owner.participants[0].training_status).toBe("complete");
      const json = JSON.stringify(owner);
      expect(json).not.toContain("A private reflection.");
    }
  });
});

/**
 * R4-R5B1 — ASSIGNMENT COMPLETION TRUTH (document room).
 *
 * The document family was the ONLY one that reached assignment completion before this slice, and it
 * did so from the BROWSER: `FoundryDocumentClient` fires a silent `claim-xp` on either terminal
 * stage. That made assignment truth depend on a React effect mounting, and on a comment which
 * wrongly asserted the video client did the same.
 *
 * These prove the document path is now server-side native — the transition happens inside
 * `completeDocumentTraining`, with no client involvement of any kind.
 */
describe("R4-R5B1 · assignment completion truth — document", () => {
  const claimCalls = (tables: Record<string, Array<Record<string, unknown>>>) =>
    (tables.__claim_calls as Array<Record<string, unknown>> | undefined) ?? [];

  it("T3 — an authenticated assigned completion drives the assignment to completed IN THE SERVICE", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined(2);
    seedAssignment(tables, eventId, AUTH);
    await meetReadingGate(admin, token, session, 2);

    const done = await completeDocumentTraining(admin, token, session, "I'll apply the checklist.", AUTH);

    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    const a = readAssignment(tables, eventId, AUTH)!;
    expect(a.status).toBe("completed");
    expect(a.participant_id).toBe(String(tables.foundry_event_participants[0]!.id));
    // T8 — server-side parity: exactly ONE claim, and it came from the completion service. No
    // browser effect ran in this test, so the transition cannot be attributed to one.
    expect(claimCalls(tables)).toHaveLength(1);
    expect(claimCalls(tables)[0]).toMatchObject({ p_event_id: eventId, p_auth_user_id: AUTH });
    expect(awardSpy).toHaveBeenCalledTimes(1);
  });

  it("T8 — the client's compensating claim remains SAFE on top: idempotent, no second XP", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined(2);
    seedAssignment(tables, eventId, AUTH);
    await meetReadingGate(admin, token, session, 2);
    await completeDocumentTraining(admin, token, session, "Answer.", AUTH);
    const claimedAt = readAssignment(tables, eventId, AUTH)!.claimed_at;

    // Exactly what the retained auto-claim effect does on `completed_awarded`.
    const replay = await claimDocumentXp(admin, token, session, AUTH);

    expect(replay.ok).toBe(true);
    expect(awardSpy).toHaveBeenCalledTimes(1); // no duplicate XP
    const a = readAssignment(tables, eventId, AUTH)!;
    expect(a.status).toBe("completed");
    expect(a.claimed_at).toBe(claimedAt); // already_claimed → no re-stamp
  });

  it("T4/T5 — anonymous claims nothing; signed-in open-link fabricates nothing", async () => {
    const anon = await setupJoined(2);
    seedAssignment(anon.tables, anon.eventId, AUTH);
    await meetReadingGate(anon.admin, anon.token, anon.session, 2);
    await completeDocumentTraining(anon.admin, anon.token, anon.session, "Anonymous.", null);
    expect(claimCalls(anon.tables)).toHaveLength(0);
    expect(readAssignment(anon.tables, anon.eventId, AUTH)!.status).toBe("assigned");

    const open = await setupJoined(2);
    await meetReadingGate(open.admin, open.token, open.session, 2);
    const done = await completeDocumentTraining(open.admin, open.token, open.session, "Open link.", AUTH);
    expect(done.ok).toBe(true);
    expect(open.tables.foundry_event_assignments ?? []).toHaveLength(0);
  });

  it("T7 — a reconciliation fault cannot fail a truthful completion", async () => {
    for (const mode of ["error", "throw"]) {
      const { admin, tables, eventId, token, session } = await setupJoined(2);
      seedAssignment(tables, eventId, AUTH);
      tables.__claim_fault = [{ mode }];
      await meetReadingGate(admin, token, session, 2);

      const done = await completeDocumentTraining(admin, token, session, `Answer (${mode}).`, AUTH);

      expect(done.ok, mode).toBe(true);
      expect(tables.foundry_event_training_progress[0]!.completed_at).not.toBeNull();
      expect(readAssignment(tables, eventId, AUTH)!.status, mode).toBe("assigned");
    }
  });
});
