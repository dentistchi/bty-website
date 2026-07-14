import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the canonical Core XP primitive so the test never touches arena_profiles/avatar.
vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ newCoreTotal: 10 })),
}));

import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { createEvent, joinEvent } from "./foundryEventService";
import {
  createTrainingEvent,
  getOwnerTrainingSnapshot,
  getPublicTrainingSnapshot,
  startVideo,
  completeVideo,
  completeTraining,
  claimXp,
} from "./foundryTrainingService";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-training-secret-0123456789";
});

const awardSpy = applyDirectCoreXp as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => awardSpy.mockClear());

// ---- Capable in-memory fake (4 tables + core_xp_ledger, with unique constraints) ----
type Row = Record<string, unknown>;

const UNIQUE: Record<string, string[][]> = {
  foundry_event_participants: [["participant_session_token_hash"]],
  foundry_event_training_content: [["event_id"]],
  foundry_event_training_progress: [["event_id", "participant_id"]],
  core_xp_ledger: [["source_type", "source_id"]],
};

function makeFakeAdmin() {
  const tables: Record<string, Row[]> = {
    foundry_events: [],
    foundry_event_participants: [],
    foundry_event_training_content: [],
    foundry_event_training_progress: [],
    core_xp_ledger: [],
  };
  let counter = 0;
  const nid = (t: string) => `${t}-${++counter}`;

  function defaults(table: string, r: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_events")
      return { id: nid("ev"), status: "open", join_version: 1, created_at: now, closed_at: null, ...r };
    if (table === "foundry_event_participants")
      return { id: nid("pt"), status: "joined", joined_at: now, last_seen_at: now, removed_at: null, ...r };
    if (table === "foundry_event_training_content")
      return { youtube_title: null, youtube_channel_title: null, youtube_thumbnail_url: null, created_at: now, ...r };
    if (table === "foundry_event_training_progress")
      return {
        id: nid("pr"),
        video_started_at: null,
        video_completed_at: null,
        response_text: null,
        completed_at: null,
        linked_user_id: null,
        xp_awarded_at: null,
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
    select() {
      return this;
    }
    insert(r: Row | Row[]) {
      this.mode = "insert";
      this.rows = Array.isArray(r) ? r : [r];
      return this;
    }
    update(p: Row) {
      this.mode = "update";
      this.patch = p;
      return this;
    }
    delete() {
      this.mode = "delete";
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push({ col, val, kind: "eq" });
      return this;
    }
    in(col: string, vals: unknown[]) {
      this.filters.push({ col, val: vals, kind: "in" });
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.push({ col, val, kind: "is" });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderCol = col;
      this.orderAsc = opts?.ascending !== false;
      return this;
    }
    returns() {
      return this;
    }
    private match(row: Row) {
      return this.filters.every((f) => {
        if (f.kind === "eq") return row[f.col] === f.val;
        if (f.kind === "in") return (f.val as unknown[]).includes(row[f.col]);
        return (row[f.col] ?? null) === (f.val ?? null); // is
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
        const removed = this.store.filter((r) => this.match(r));
        this.store.length = 0;
        this.store.push(...keep);
        return { data: removed, error: null };
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

  return {
    admin: { from: (t: string) => new Q(tables[t], t) } as unknown as SupabaseClient,
    tables,
  };
}

const OWNER = "owner-1";
const AUTH = "auth-user-9";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function setupJoined() {
  const { admin, tables } = makeFakeAdmin();
  const created = await createTrainingEvent(admin, OWNER, {
    title: "Handling Difficult Conversations",
    youtube_url: YT,
    completion_prompt: "What will you do differently?",
  });
  if (!created.ok) throw new Error("setup create failed: " + created.reason);
  const eventId = created.value.event.id;
  const token = created.value.event.join_token;
  const joined = await joinEvent(admin, token, "Sarah", null);
  if (!joined.ok) throw new Error("setup join failed");
  return { admin, tables, eventId, token, session: joined.sessionToken };
}

describe("createTrainingEvent", () => {
  it("creates event + content and returns a training snapshot", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, {
      title: "Safety Training",
      youtube_url: YT,
      completion_prompt: "One safety habit?",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.event.training?.youtube_video_id).toBe("dQw4w9WgXcQ");
      expect(r.value.event.join_token.startsWith("btyfr1.")).toBe(true);
      expect(r.value.joined_count).toBe(0);
      expect(r.value.completed_count).toBe(0);
    }
  });

  it("rejects an invalid YouTube URL (and leaves no event behind)", async () => {
    const { admin, tables } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, {
      title: "Bad",
      youtube_url: "https://vimeo.com/12345",
      completion_prompt: "q",
    });
    expect(r).toEqual({ ok: false, reason: "youtube_url_invalid" });
    expect(tables.foundry_events).toHaveLength(0);
  });

  it("rejects a blank prompt", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, { title: "T", youtube_url: YT, completion_prompt: "  " });
    expect(r).toEqual({ ok: false, reason: "prompt_required" });
  });
});

describe("progress: watch → response → complete", () => {
  it("advances stages and gates the response on video completion", async () => {
    const { admin, token, session } = await setupJoined();

    // Watch stage exposes the video, not the prompt.
    let snap = await getPublicTrainingSnapshot(admin, token, session);
    expect(snap.stage).toBe("watch");
    expect(snap.training?.youtube_video_id).toBe("dQw4w9WgXcQ");
    expect(snap.training?.completion_prompt).toBeNull();

    // Cannot submit a response before the video is server-marked complete.
    const early = await completeTraining(admin, token, session, "too soon", null);
    expect(early).toEqual({ ok: false, reason: "video_not_complete" });

    await startVideo(admin, token, session);
    const afterVideo = await completeVideo(admin, token, session);
    expect(afterVideo.ok && afterVideo.snapshot.stage).toBe("response");
    expect(afterVideo.ok && afterVideo.snapshot.training?.completion_prompt).toBe("What will you do differently?");

    // Anonymous completion → claimable, no XP written.
    const done = await completeTraining(admin, token, session, "I will pause before replying.", null);
    expect(done.ok && done.snapshot.stage).toBe("completed_claimable");
    expect(done.ok && done.snapshot.xp_status).toBe("claimable");
    expect(awardSpy).not.toHaveBeenCalled();

    // Idempotent: re-completing does not re-open or re-award.
    const again = await completeTraining(admin, token, session, "changed answer", null);
    expect(again.ok && again.snapshot.stage).toBe("completed_claimable");
  });

  it("blank response is rejected", async () => {
    const { admin, token, session } = await setupJoined();
    await completeVideo(admin, token, session);
    expect(await completeTraining(admin, token, session, "   ", null)).toEqual({
      ok: false,
      reason: "response_required",
    });
  });
});

describe("XP: authenticated award vs anonymous claim", () => {
  it("authenticated completion awards 10 Core XP once via the canonical path", async () => {
    const { admin, token, session, tables } = await setupJoined();
    await completeVideo(admin, token, session);
    const done = await completeTraining(admin, token, session, "My reflection.", AUTH);
    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    expect(done.ok && done.snapshot.xp_status).toBe("awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(awardSpy).toHaveBeenCalledWith(admin, AUTH, 10);
    // Exactly one ledger row, attributed to Foundry training.
    expect(tables.core_xp_ledger).toHaveLength(1);
    expect(tables.core_xp_ledger[0].source_type).toBe("foundry_training_completion");
  });

  it("anonymous completion then claim awards exactly once", async () => {
    const { admin, token, session } = await setupJoined();
    await completeVideo(admin, token, session);
    await completeTraining(admin, token, session, "Anon reflection.", null);
    expect(awardSpy).not.toHaveBeenCalled();

    const claim = await claimXp(admin, token, session, AUTH);
    expect(claim.ok && claim.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);

    // Second claim is idempotent — no second award.
    const claim2 = await claimXp(admin, token, session, AUTH);
    expect(claim2.ok && claim2.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
  });

  it("claim requires a completed progress row", async () => {
    const { admin, token, session } = await setupJoined();
    expect(await claimXp(admin, token, session, AUTH)).toEqual({ ok: false, reason: "not_completed" });
  });
});

describe("close + privacy + roster projection", () => {
  it("blocks new completion after close but keeps completed results", async () => {
    const { admin, token, session, eventId } = await setupJoined();
    await completeVideo(admin, token, session);
    // Close the event directly (owner-close path is covered by the base service test).
    await admin.from("foundry_events").update({ status: "closed" }).eq("id", eventId);

    expect(await completeTraining(admin, token, session, "late", null)).toEqual({
      ok: false,
      reason: "event_closed",
    });
    const snap = await getPublicTrainingSnapshot(admin, token, session);
    expect(snap.stage).toBe("closed_incomplete");
  });

  it("manager roster shows training status + counts, never the response text", async () => {
    const { admin, token, session } = await setupJoined();
    await completeVideo(admin, token, session);
    await completeTraining(admin, token, session, "A private reflection.", null);

    const owner = await getOwnerTrainingSnapshot(admin, OWNER, (await getFirstEventId(admin)));
    expect(owner).not.toBeNull();
    if (owner) {
      expect(owner.joined_count).toBe(1);
      expect(owner.completed_count).toBe(1);
      expect(owner.participants[0].training_status).toBe("complete");
      // Privacy: no response text anywhere in the manager snapshot.
      const json = JSON.stringify(owner);
      expect(json).not.toContain("A private reflection.");
      expect(owner.participants[0]).not.toHaveProperty("response_text");
    }
  });
});

async function getFirstEventId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("foundry_events").select("id").maybeSingle();
  return (data as { id: string }).id;
}
