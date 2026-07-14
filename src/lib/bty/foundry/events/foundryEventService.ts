import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateEventTitle,
  validateDisplayName,
  canAcceptNewJoin,
  isJoinVersionCurrent,
  nextJoinVersion,
  type FoundryEventStatus,
  type FoundryParticipantStatus,
} from "@/domain/foundry/events/foundry-event";
import {
  signFoundryRoomToken,
  verifyFoundryRoomToken,
} from "./foundry-room-token";
import {
  generateParticipantSessionToken,
  hashParticipantSessionToken,
} from "./participant-session";

/**
 * Foundry Event Rooms — service layer.
 *
 * All DB access runs through the caller-provided service-role client (`admin`).
 * Every function that acts on behalf of a MANAGER takes `ownerUserId` and scopes
 * the query by `owner_user_id` so a caller can never touch another owner's event
 * (missing row => null => the route returns a non-disclosing 404). PUBLIC
 * functions take a signed join token + optional session-cookie token and never
 * expose owner id, internal counts, or the roster to the anonymous caller.
 *
 * Business rules (validation, status transitions, version currency) live in the
 * domain module; this layer only orchestrates domain + DB + token crypto.
 */

const EVENT_COLS = "id, owner_user_id, title, status, join_version, created_at, closed_at";

type EventRow = {
  id: string;
  owner_user_id: string;
  title: string;
  status: FoundryEventStatus;
  join_version: number;
  created_at: string;
  closed_at: string | null;
};

type ParticipantRow = {
  id: string;
  event_id: string;
  display_name: string;
  status: FoundryParticipantStatus;
  joined_at: string;
  last_seen_at: string;
};

export type ManagerEventSummary = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  joined_count: number;
  created_at: string;
  closed_at: string | null;
};

export type ManagerParticipant = {
  id: string;
  display_name: string;
  joined_at: string;
  status: FoundryParticipantStatus;
};

export type ManagerEventSnapshot = {
  event: {
    id: string;
    title: string;
    status: FoundryEventStatus;
    join_token: string;
    created_at: string;
    closed_at: string | null;
  };
  participants: ManagerParticipant[];
};

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/** Mint the current signed join capability for an event row. */
function mintJoinToken(event: Pick<EventRow, "id" | "join_version">): string {
  return signFoundryRoomToken({
    type: "foundry_room",
    eventId: event.id,
    joinVersion: event.join_version,
    iat: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Manager operations (owner-scoped)
// ---------------------------------------------------------------------------

/** Create an event owned by `ownerUserId`. Status starts `open`, version 1. */
export async function createEvent(
  admin: SupabaseClient,
  ownerUserId: string,
  rawTitle: unknown,
): Promise<ServiceResult<ManagerEventSnapshot>> {
  const title = validateEventTitle(rawTitle);
  if (!title.ok) return { ok: false, reason: title.reason };

  const { data, error } = await admin
    .from("foundry_events")
    .insert({ owner_user_id: ownerUserId, title: title.value })
    .select(EVENT_COLS)
    .single<EventRow>();

  if (error || !data) return { ok: false, reason: error?.message ?? "event_insert_failed" };

  return {
    ok: true,
    value: {
      event: {
        id: data.id,
        title: data.title,
        status: data.status,
        join_token: mintJoinToken(data),
        created_at: data.created_at,
        closed_at: data.closed_at,
      },
      participants: [],
    },
  };
}

/** List an owner's events (newest first) with joined-participant counts. */
export async function listOwnerEvents(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<ManagerEventSummary[]> {
  const { data: events, error } = await admin
    .from("foundry_events")
    .select(EVENT_COLS)
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .returns<EventRow[]>();

  if (error || !events || events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const { data: parts } = await admin
    .from("foundry_event_participants")
    .select("event_id, status")
    .in("event_id", ids)
    .eq("status", "joined")
    .returns<Pick<ParticipantRow, "event_id" | "status">[]>();

  const counts = new Map<string, number>();
  for (const p of parts ?? []) counts.set(p.event_id, (counts.get(p.event_id) ?? 0) + 1);

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    joined_count: counts.get(e.id) ?? 0,
    created_at: e.created_at,
    closed_at: e.closed_at,
  }));
}

/** Fetch an owner's event + roster. Returns null if the event is not owned by the caller. */
export async function getOwnerEventSnapshot(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerEventSnapshot | null> {
  const { data: event } = await admin
    .from("foundry_events")
    .select(EVENT_COLS)
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<EventRow>();

  if (!event) return null;

  const { data: parts } = await admin
    .from("foundry_event_participants")
    .select("id, display_name, status, joined_at, last_seen_at, event_id")
    .eq("event_id", eventId)
    .order("joined_at", { ascending: true })
    .returns<ParticipantRow[]>();

  return {
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      join_token: mintJoinToken(event),
      created_at: event.created_at,
      closed_at: event.closed_at,
    },
    participants: (parts ?? [])
      .filter((p) => p.status === "joined")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        joined_at: p.joined_at,
        status: p.status,
      })),
  };
}

/** Close an event (idempotent). Returns null if not owned. Blocks future joins. */
export async function closeEvent(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerEventSnapshot | null> {
  const { data: event } = await admin
    .from("foundry_events")
    .select(EVENT_COLS)
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<EventRow>();

  if (!event) return null;

  if (event.status === "open") {
    await admin
      .from("foundry_events")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", eventId)
      .eq("owner_user_id", ownerUserId)
      .eq("status", "open"); // guard: only the open->closed transition
  }

  return getOwnerEventSnapshot(admin, ownerUserId, eventId);
}

/** Rotate the QR: bump join_version so every previously-minted token is stale. */
export async function rotateJoinVersion(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerEventSnapshot | null> {
  const { data: event } = await admin
    .from("foundry_events")
    .select(EVENT_COLS)
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<EventRow>();

  if (!event) return null;

  const { error } = await admin
    .from("foundry_events")
    .update({ join_version: nextJoinVersion(event.join_version) })
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .eq("join_version", event.join_version); // optimistic guard against concurrent rotate

  if (error) return null;

  return getOwnerEventSnapshot(admin, ownerUserId, eventId);
}

/** Remove a participant (owner-scoped). Their session can no longer restore the room. */
export async function removeParticipant(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
  participantId: string,
): Promise<boolean> {
  // Ownership: the event must belong to the caller.
  const { data: event } = await admin
    .from("foundry_events")
    .select("id")
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<{ id: string }>();

  if (!event) return false;

  const { error } = await admin
    .from("foundry_event_participants")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", participantId)
    .eq("event_id", eventId)
    .eq("status", "joined");

  return !error;
}

// ---------------------------------------------------------------------------
// Public operations (anonymous, join-token scoped)
// ---------------------------------------------------------------------------

export type PublicRoomState =
  | "pre_join" // open event, caller not yet a participant
  | "joined" // caller is an active participant, event open
  | "closed_joined" // caller joined, event has since closed
  | "closed" // event closed, caller never joined
  | "removed" // caller's session was removed by the manager
  | "inactive"; // token invalid / rotated / event missing

export type PublicSnapshot = {
  event: { title: string; status: FoundryEventStatus } | null;
  participant: { display_name: string; joined_at: string } | null;
  room_state: PublicRoomState;
};

/** Resolve an event strictly from a signed token (signature + shape + existence). */
async function resolveEventByToken(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; event: EventRow; tokenVersion: number } | { ok: false }> {
  const verified = verifyFoundryRoomToken(token);
  if (!verified.ok) return { ok: false };

  const { data: event } = await admin
    .from("foundry_events")
    .select(EVENT_COLS)
    .eq("id", verified.payload.eventId)
    .maybeSingle<EventRow>();

  if (!event) return { ok: false };
  return { ok: true, event, tokenVersion: verified.payload.joinVersion };
}

async function findParticipantBySession(
  admin: SupabaseClient,
  eventId: string,
  rawSessionToken: string | null | undefined,
): Promise<ParticipantRow | null> {
  if (!rawSessionToken) return null;
  const hash = hashParticipantSessionToken(rawSessionToken);
  const { data } = await admin
    .from("foundry_event_participants")
    .select("id, event_id, display_name, status, joined_at, last_seen_at")
    .eq("event_id", eventId)
    .eq("participant_session_token_hash", hash)
    .maybeSingle<ParticipantRow>();
  return data ?? null;
}

/**
 * The unified public snapshot for `/f/[token]`. Serves BOTH pre-join and room
 * restore: the client renders from `room_state`. A returning participant (valid
 * session cookie) is restored even after a QR rotation, because the room view is
 * gated on the session, not the join version — only NEW joins require a current
 * QR. Best-effort touches `last_seen_at` when a participant is resolved.
 */
export async function getPublicSnapshot(
  admin: SupabaseClient,
  token: string,
  rawSessionToken: string | null | undefined,
): Promise<PublicSnapshot> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) {
    return { event: null, participant: null, room_state: "inactive" };
  }
  const { event, tokenVersion } = resolved;

  const participant = await findParticipantBySession(admin, event.id, rawSessionToken);

  // Returning participant path (session-gated; join_version not required).
  if (participant) {
    if (participant.status === "removed") {
      return { event: null, participant: null, room_state: "removed" };
    }
    // best-effort presence touch
    void admin
      .from("foundry_event_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participant.id)
      .then(() => undefined, () => undefined);

    return {
      event: { title: event.title, status: event.status },
      participant: { display_name: participant.display_name, joined_at: participant.joined_at },
      room_state: event.status === "closed" ? "closed_joined" : "joined",
    };
  }

  // No session yet — pre-join path. A stale (rotated) QR is treated as inactive
  // so we never reveal the event to a scanner of an invalidated invitation.
  if (!isJoinVersionCurrent(tokenVersion, event.join_version)) {
    return { event: null, participant: null, room_state: "inactive" };
  }
  if (event.status === "closed") {
    return { event: { title: event.title, status: "closed" }, participant: null, room_state: "closed" };
  }
  return { event: { title: event.title, status: "open" }, participant: null, room_state: "pre_join" };
}

export type JoinResult =
  | { ok: true; snapshot: PublicSnapshot; sessionToken: string; eventId: string; reused: boolean }
  | { ok: false; reason: string };

/**
 * Join an event by name. Idempotent for a returning valid session (no duplicate
 * row). New joins require a current QR (join_version) AND an open event. Returns
 * the raw session token so the route can set the HttpOnly cookie (the token is
 * never stored raw — only its hash lands in the DB).
 */
export async function joinEvent(
  admin: SupabaseClient,
  token: string,
  rawName: unknown,
  existingSessionToken: string | null | undefined,
): Promise<JoinResult> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) return { ok: false, reason: "inactive" };
  const { event, tokenVersion } = resolved;

  // Idempotency / re-entry: a still-joined session just restores (no new row).
  const existing = await findParticipantBySession(admin, event.id, existingSessionToken);
  if (existing && existing.status === "joined") {
    return {
      ok: true,
      reused: true,
      eventId: event.id,
      sessionToken: existingSessionToken as string,
      snapshot: {
        event: { title: event.title, status: event.status },
        participant: { display_name: existing.display_name, joined_at: existing.joined_at },
        room_state: event.status === "closed" ? "closed_joined" : "joined",
      },
    };
  }

  // New join guards.
  if (!isJoinVersionCurrent(tokenVersion, event.join_version)) return { ok: false, reason: "qr_rotated" };
  if (!canAcceptNewJoin(event.status)) return { ok: false, reason: "event_closed" };

  const name = validateDisplayName(rawName);
  if (!name.ok) return { ok: false, reason: name.reason };

  const sessionToken = generateParticipantSessionToken();
  const hash = hashParticipantSessionToken(sessionToken);

  const { data, error } = await admin
    .from("foundry_event_participants")
    .insert({
      event_id: event.id,
      display_name: name.value,
      participant_session_token_hash: hash,
    })
    .select("id, event_id, display_name, status, joined_at, last_seen_at")
    .single<ParticipantRow>();

  if (error || !data) return { ok: false, reason: "join_failed" };

  return {
    ok: true,
    reused: false,
    eventId: event.id,
    sessionToken,
    snapshot: {
      event: { title: event.title, status: event.status },
      participant: { display_name: data.display_name, joined_at: data.joined_at },
      room_state: "joined",
    },
  };
}
