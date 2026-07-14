import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEvent,
  listOwnerEvents,
  getOwnerEventSnapshot,
  closeEvent,
  rotateJoinVersion,
  removeParticipant,
  joinEvent,
  getPublicSnapshot,
} from "./foundryEventService";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-room-secret-service-0123456789";
});

/**
 * Minimal in-memory fake of the exact Supabase query chains the service uses.
 * Not a general Supabase mock — just enough surface for these tests.
 */
type Row = Record<string, unknown>;

function makeFakeAdmin(seed?: { events?: Row[]; participants?: Row[] }) {
  const tables: Record<string, Row[]> = {
    foundry_events: [...(seed?.events ?? [])],
    foundry_event_participants: [...(seed?.participants ?? [])],
  };
  let counter = 0;
  const nextId = (t: string) => `${t}-${++counter}`;

  function applyDefaults(table: string, r: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_events") {
      return {
        id: nextId("ev"),
        status: "open",
        join_version: 1,
        created_at: now,
        closed_at: null,
        ...r,
      };
    }
    return {
      id: nextId("pt"),
      status: "joined",
      joined_at: now,
      last_seen_at: now,
      removed_at: null,
      ...r,
    };
  }

  class Q {
    private filters: Array<{ col: string; val: unknown; kind: "eq" | "in" }> = [];
    private orderCol: string | null = null;
    private orderAsc = true;
    private mode: "select" | "insert" | "update" = "select";
    private insertRows: Row[] = [];
    private patch: Row = {};
    private lastInserted: Row[] = [];
    constructor(private store: Row[], private table: string) {}
    select() {
      return this;
    }
    insert(rows: Row | Row[]) {
      this.mode = "insert";
      this.insertRows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(patch: Row) {
      this.mode = "update";
      this.patch = patch;
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
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderCol = col;
      this.orderAsc = opts?.ascending !== false;
      return this;
    }
    returns() {
      return this;
    }
    private match(row: Row) {
      return this.filters.every((f) =>
        f.kind === "eq" ? row[f.col] === f.val : (f.val as unknown[]).includes(row[f.col]),
      );
    }
    private ordered(rows: Row[]) {
      if (!this.orderCol) return rows;
      const c = this.orderCol;
      return [...rows].sort((a, b) => {
        const av = a[c] as string;
        const bv = b[c] as string;
        if (av < bv) return this.orderAsc ? -1 : 1;
        if (av > bv) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }
    private exec(): { data: Row[]; error: null } {
      if (this.mode === "insert") {
        this.lastInserted = this.insertRows.map((r) => applyDefaults(this.table, r));
        this.lastInserted.forEach((r) => this.store.push(r));
        return { data: this.lastInserted, error: null };
      }
      if (this.mode === "update") {
        const targets = this.store.filter((r) => this.match(r));
        targets.forEach((r) => Object.assign(r, this.patch));
        return { data: targets, error: null };
      }
      return { data: this.ordered(this.store.filter((r) => this.match(r))), error: null };
    }
    single() {
      const res = this.exec();
      const first = this.mode === "insert" ? this.lastInserted[0] : res.data[0];
      return Promise.resolve({ data: first ?? null, error: null });
    }
    maybeSingle() {
      const res = this.exec();
      return Promise.resolve({ data: res.data[0] ?? null, error: null });
    }
    then(onF: (v: { data: Row[]; error: null }) => unknown, onR?: (e: unknown) => unknown) {
      return Promise.resolve(this.exec()).then(onF, onR);
    }
  }

  const admin = {
    from(table: string) {
      return new Q(tables[table], table);
    },
  };
  return { admin: admin as unknown as SupabaseClient, tables };
}

const OWNER = "owner-1";
const OTHER = "owner-2";

describe("createEvent", () => {
  it("creates an open event and returns a join token", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createEvent(admin, OWNER, "  July Manager Meeting ");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.event.title).toBe("July Manager Meeting");
      expect(r.value.event.status).toBe("open");
      expect(r.value.event.join_token.startsWith("btyfr1.")).toBe(true);
      expect(r.value.participants).toEqual([]);
    }
  });

  it("rejects a blank title", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createEvent(admin, OWNER, "   ");
    expect(r).toEqual({ ok: false, reason: "title_required" });
  });
});

describe("ownership", () => {
  it("does not return another owner's event", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Owner Event");
    const id = created.ok ? created.value.event.id : "";
    expect(await getOwnerEventSnapshot(admin, OTHER, id)).toBeNull();
    expect(await getOwnerEventSnapshot(admin, OWNER, id)).not.toBeNull();
  });

  it("close/rotate/remove are no-ops for a non-owner", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Owner Event");
    const id = created.ok ? created.value.event.id : "";
    expect(await closeEvent(admin, OTHER, id)).toBeNull();
    expect(await rotateJoinVersion(admin, OTHER, id)).toBeNull();
    expect(await removeParticipant(admin, OTHER, id, "pt-x")).toBe(false);
  });
});

describe("listOwnerEvents", () => {
  it("returns only the caller's events with joined counts", async () => {
    const { admin } = makeFakeAdmin();
    const a = await createEvent(admin, OWNER, "A");
    await createEvent(admin, OTHER, "B");
    const aId = a.ok ? a.value.event.id : "";
    const aToken = a.ok ? a.value.event.join_token : "";
    await joinEvent(admin, aToken, "Sarah", null);
    await joinEvent(admin, aToken, "Mike", null);

    const list = await listOwnerEvents(admin, OWNER);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("A");
    expect(list[0].joined_count).toBe(2);
    expect(list[0].id).toBe(aId);
  });
});

describe("join + re-entry idempotency", () => {
  it("joins an open event and restores the same participant on re-entry", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Event");
    const token = created.ok ? created.value.event.join_token : "";

    const first = await joinEvent(admin, token, "Sarah", null);
    expect(first.ok).toBe(true);
    const session = first.ok ? first.sessionToken : "";
    expect(tables.foundry_event_participants).toHaveLength(1);

    // Re-entry with the same session — no duplicate row, reused=true.
    const again = await joinEvent(admin, token, "Sarah", session);
    expect(again.ok && again.reused).toBe(true);
    expect(tables.foundry_event_participants).toHaveLength(1);
  });

  it("rejects a blank name", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Event");
    const token = created.ok ? created.value.event.join_token : "";
    expect(await joinEvent(admin, token, "   ", null)).toEqual({ ok: false, reason: "name_required" });
  });

  it("rejects an invalid token as inactive", async () => {
    const { admin } = makeFakeAdmin();
    expect(await joinEvent(admin, "garbage", "Sarah", null)).toEqual({ ok: false, reason: "inactive" });
  });
});

describe("QR rotation", () => {
  it("invalidates the old QR for new joins but keeps existing participants", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Event");
    const id = created.ok ? created.value.event.id : "";
    const oldToken = created.ok ? created.value.event.join_token : "";

    // An existing participant joins on the old QR.
    const joined = await joinEvent(admin, oldToken, "Sarah", null);
    const session = joined.ok ? joined.sessionToken : "";

    // Rotate.
    const rotated = await rotateJoinVersion(admin, OWNER, id);
    const newToken = rotated?.event.join_token ?? "";
    expect(newToken).not.toBe(oldToken);

    // New joiner on the OLD QR is rejected.
    expect(await joinEvent(admin, oldToken, "Late", null)).toEqual({ ok: false, reason: "qr_rotated" });
    // New joiner on the NEW QR is accepted.
    expect((await joinEvent(admin, newToken, "Mike", null)).ok).toBe(true);
    // Existing participant is still restored via their session, even on the old QR.
    const snap = await getPublicSnapshot(admin, oldToken, session);
    expect(snap.room_state).toBe("joined");
    expect(snap.participant?.display_name).toBe("Sarah");
  });
});

describe("close", () => {
  it("is idempotent and blocks new joins; existing participant sees closed_joined", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Event");
    const id = created.ok ? created.value.event.id : "";
    const token = created.ok ? created.value.event.join_token : "";

    const joined = await joinEvent(admin, token, "Sarah", null);
    const session = joined.ok ? joined.sessionToken : "";

    const c1 = await closeEvent(admin, OWNER, id);
    expect(c1?.event.status).toBe("closed");
    const c2 = await closeEvent(admin, OWNER, id); // idempotent
    expect(c2?.event.status).toBe("closed");

    // New join blocked.
    expect(await joinEvent(admin, token, "Late", null)).toEqual({ ok: false, reason: "event_closed" });
    // Pre-join visitor sees the closed surface.
    const pre = await getPublicSnapshot(admin, token, null);
    expect(pre.room_state).toBe("closed");
    // Existing participant sees closed_joined.
    const post = await getPublicSnapshot(admin, token, session);
    expect(post.room_state).toBe("closed_joined");
  });
});

describe("removeParticipant", () => {
  it("removes a participant so their session can no longer restore the room", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Event");
    const id = created.ok ? created.value.event.id : "";
    const token = created.ok ? created.value.event.join_token : "";

    const joined = await joinEvent(admin, token, "Sarah", null);
    const session = joined.ok ? joined.sessionToken : "";
    const snap = await getOwnerEventSnapshot(admin, OWNER, id);
    const pid = snap?.participants[0].id ?? "";

    expect(await removeParticipant(admin, OWNER, id, pid)).toBe(true);

    // Their session now yields the removed surface.
    const after = await getPublicSnapshot(admin, token, session);
    expect(after.room_state).toBe("removed");
    // Roster no longer lists them.
    const snap2 = await getOwnerEventSnapshot(admin, OWNER, id);
    expect(snap2?.participants).toHaveLength(0);
  });
});

describe("getPublicSnapshot", () => {
  it("returns inactive for an invalid token", async () => {
    const { admin } = makeFakeAdmin();
    const snap = await getPublicSnapshot(admin, "not-a-token", null);
    expect(snap).toEqual({ event: null, participant: null, room_state: "inactive" });
  });

  it("returns pre_join for an open event with no session", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createEvent(admin, OWNER, "Event");
    const token = created.ok ? created.value.event.join_token : "";
    const snap = await getPublicSnapshot(admin, token, null);
    expect(snap.room_state).toBe("pre_join");
    expect(snap.event?.title).toBe("Event");
    expect(snap.participant).toBeNull();
  });
});
