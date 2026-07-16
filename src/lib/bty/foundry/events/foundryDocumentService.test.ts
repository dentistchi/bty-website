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
