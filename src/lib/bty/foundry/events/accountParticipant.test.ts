/**
 * ACCOUNT-BACKED PARTICIPANT IDENTITY. Slice Teams-Native Delivery V1.
 *
 * The Teams learner is not anonymous, so the participant row is resolved by (event, canonical
 * user). This file proves the three properties that makes that safe:
 *
 *   - the SAME account on the same event always resolves the SAME participant, even concurrently
 *     and even from a second device, with no `unique (event_id, user_id)` constraint to lean on;
 *   - a participant session minted for one event resolves NOTHING on another;
 *   - the display name is server-resolved from provider data and is never taken from a caller.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { resolveDisplayNames } = vi.hoisted(() => ({
  resolveDisplayNames: vi.fn(async (_admin: unknown, ids: readonly string[]) => {
    const m = new Map<string, string | null>();
    for (const id of ids ?? []) m.set(id, id === "user-A" ? "Ari Kim" : null);
    return m;
  }),
}));
vi.mock("@/lib/bty/announcement/recipientDisplayName.server", () => ({ resolveDisplayNames }));

import { accountParticipantSessionToken, openAccountRoom, ACCOUNT_PARTICIPANT_FALLBACK_NAME } from "./accountParticipant";
import { signFoundryRoomToken } from "./foundry-room-token";
import { hashParticipantSessionToken } from "./participant-session";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-teams-native-secret-0123456789abcdef";
});
beforeEach(() => resolveDisplayNames.mockClear());

type Row = Record<string, unknown>;

/** In-memory Supabase with the REAL global unique on `participant_session_token_hash`. */
function makeFakeAdmin(events: Row[]) {
  const tables: Record<string, Row[]> = {
    foundry_events: events,
    foundry_event_participants: [],
  };
  let n = 0;
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const st = { op: "select" as "select" | "insert", filters: [] as Array<{ c: string; v: unknown }>, insert: null as Row | null };
    const matches = () => rows.filter((r) => st.filters.every((f) => r[f.c] === f.v));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { st.filters.push({ c, v }); return q; },
      insert: (r: Row) => { st.op = "insert"; st.insert = r; return q; },
      maybeSingle: () => {
        if (st.op === "insert" && st.insert) {
          const row = st.insert;
          // THE REAL CONSTRAINT: unique (participant_session_token_hash), globally.
          if (rows.some((r) => r.participant_session_token_hash === row.participant_session_token_hash)) {
            return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } });
          }
          const stored = { id: `pt-${++n}`, status: "joined", joined_at: "t", last_seen_at: "t", ...row };
          rows.push(stored);
          return Promise.resolve({ data: { ...stored }, error: null });
        }
        const hit = matches()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      single: () => q.maybeSingle as never,
    };
    return q;
  }
  return { admin: { from } as unknown as SupabaseClient, tables };
}

function seedEvent(over: Row = {}) {
  return {
    id: "ev-1",
    owner_user_id: "owner-1",
    title: "Morning Office Opening",
    status: "open",
    content_type: "written_guidance",
    join_version: 1,
    created_at: "t",
    closed_at: null,
    ...over,
  };
}

const mint = (eventId: string, joinVersion: number) =>
  signFoundryRoomToken({ type: "foundry_room", eventId, joinVersion, iat: Date.now() });
const tokenFor = (event: Row) => mint(event.id as string, event.join_version as number);

describe("the same account always resolves the SAME participant", () => {
  it("creates once, then reuses — a second device does not fork a second participant", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    const token = tokenFor(event);

    const first = await openAccountRoom(admin, token, "user-A");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.created).toBe(true);

    const second = await openAccountRoom(admin, token, "user-A");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    expect(second.participant.id).toBe(first.participant.id);
    expect(second.participantSession).toBe(first.participantSession);
    expect(tables.foundry_event_participants).toHaveLength(1);
  });

  it("CONCURRENT opens settle on one row — the database, not a check-then-write, decides", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    const token = tokenFor(event);

    const results = await Promise.all([
      openAccountRoom(admin, token, "user-A"),
      openAccountRoom(admin, token, "user-A"),
      openAccountRoom(admin, token, "user-A"),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.participant.id : "x")));
    expect(ids.size).toBe(1);
    expect(tables.foundry_event_participants).toHaveLength(1);
  });

  it("binds the account edge on the row, and never takes it from a caller", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    await openAccountRoom(admin, tokenFor(event), "user-A");
    expect(tables.foundry_event_participants[0]!.user_id).toBe("user-A");
  });

  it("a DIFFERENT account on the same event gets its own participant", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    const token = tokenFor(event);
    const a = await openAccountRoom(admin, token, "user-A");
    const b = await openAccountRoom(admin, token, "user-B");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.participant.id).not.toBe(b.participant.id);
    expect(tables.foundry_event_participants).toHaveLength(2);
  });
});

describe("a session cannot cross-bind identity between events", () => {
  it("the derived session differs per event and per account", () => {
    expect(accountParticipantSessionToken("ev-1", "user-A")).not.toBe(
      accountParticipantSessionToken("ev-2", "user-A"),
    );
    expect(accountParticipantSessionToken("ev-1", "user-A")).not.toBe(
      accountParticipantSessionToken("ev-1", "user-B"),
    );
    // Deterministic — that is what makes the unique index an idempotency boundary.
    expect(accountParticipantSessionToken("ev-1", "user-A")).toBe(
      accountParticipantSessionToken("ev-1", "user-A"),
    );
  });

  it("event A's session hash is not event B's, so a lookup scoped by event finds nothing", async () => {
    const a = seedEvent({ id: "ev-1" });
    const b = seedEvent({ id: "ev-2" });
    const { admin, tables } = makeFakeAdmin([a, b]);
    await openAccountRoom(admin, tokenFor(a), "user-A");
    await openAccountRoom(admin, tokenFor(b), "user-A");
    const hashes = tables.foundry_event_participants.map((r) => r.participant_session_token_hash);
    expect(new Set(hashes).size).toBe(2);
    expect(hashes).toContain(hashApp("ev-1", "user-A"));
    expect(hashes).toContain(hashApp("ev-2", "user-A"));
  });
});

function hashApp(eventId: string, userId: string) {
  return hashParticipantSessionToken(accountParticipantSessionToken(eventId, userId));
}

describe("the display name is resolved server-side and is presentation only", () => {
  it("uses the provider-written name, never a client value", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    await openAccountRoom(admin, tokenFor(event), "user-A");
    expect(tables.foundry_event_participants[0]!.display_name).toBe("Ari Kim");
    expect(resolveDisplayNames).toHaveBeenCalledTimes(1);
  });

  it("falls back honestly when Microsoft supplied no name — never to an email or an id", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    await openAccountRoom(admin, tokenFor(event), "user-NONAME");
    const name = tables.foundry_event_participants[0]!.display_name as string;
    expect(name).toBe(ACCOUNT_PARTICIPANT_FALLBACK_NAME);
    expect(name).not.toContain("@");
    expect(name).not.toContain("user-NONAME");
  });
});

describe("the room's own gates are unchanged", () => {
  it("a stale (rotated) token is refused, exactly as on the public path", async () => {
    const event = seedEvent({ join_version: 2 });
    const { admin, tables } = makeFakeAdmin([event]);
    const stale = mint("ev-1", 1);
    expect(await openAccountRoom(admin, stale, "user-A")).toEqual({ ok: false, reason: "qr_rotated" });
    expect(tables.foundry_event_participants).toHaveLength(0);
  });

  it("a learner ALREADY in the room still returns after a rotation — as on the public path", async () => {
    const event = seedEvent({ join_version: 1 });
    const { admin, tables } = makeFakeAdmin([event]);
    const first = await openAccountRoom(admin, tokenFor(event), "user-A");
    expect(first.ok).toBe(true);
    // The Host rotates the QR; the learner's old invitation is stale.
    event.join_version = 2;
    const again = await openAccountRoom(admin, mint("ev-1", 1), "user-A");
    expect(again.ok).toBe(true);
    if (!again.ok || !first.ok) return;
    expect(again.participant.id).toBe(first.participant.id);
    expect(tables.foundry_event_participants).toHaveLength(1);
  });

  it("a forged/garbage token creates nothing", async () => {
    const { admin, tables } = makeFakeAdmin([seedEvent()]);
    for (const bad of ["btyfr1.a.b", "nonsense", ""]) {
      expect((await openAccountRoom(admin, bad, "user-A")).ok).toBe(false);
    }
    expect(tables.foundry_event_participants).toHaveLength(0);
  });

  it("a removed participant is refused rather than silently re-admitted", async () => {
    const event = seedEvent();
    const { admin, tables } = makeFakeAdmin([event]);
    await openAccountRoom(admin, tokenFor(event), "user-A");
    tables.foundry_event_participants[0]!.status = "removed";
    expect(await openAccountRoom(admin, tokenFor(event), "user-A")).toEqual({ ok: false, reason: "removed" });
  });
});
