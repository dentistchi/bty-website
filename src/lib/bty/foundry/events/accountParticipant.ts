import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hashParticipantSessionToken,
} from "./participant-session";
import { resolveFoundryRoomSecret } from "./foundry-room-token";
import { resolveEventByToken, findParticipantBySession, type EventRow, type ParticipantRow } from "./foundryEventService";
import { resolveDisplayNames } from "@/lib/bty/announcement/recipientDisplayName.server";

/**
 * ACCOUNT-BACKED PARTICIPANT IDENTITY — the Teams-native learner. Slice Teams-Native Delivery V1.
 *
 * THE PROBLEM THIS SOLVES. The public Foundry room recognises a returning learner by an HttpOnly
 * per-event cookie. Inside the Teams tab that cookie does not exist and cannot be relied upon:
 * `/teams` is a THIRD-PARTY browsing context, Teams iOS blocks third-party cookies, and storage
 * partitioning makes anything durable unreliable there. That is exactly why the tab's Supabase
 * session is memory-only.
 *
 * But a Teams learner is not anonymous — Teams already authenticated them, and the tab already
 * turned that into a canonical Supabase session. So for this path identity comes from the SESSION,
 * and the participant row is resolved by (event, canonical user), never by display name, never by
 * email, never by UPN, and never by anything the client sends.
 *
 * ── THE ATOMICITY PROBLEM, AND WHY THERE IS NO MIGRATION ─────────────────────────────────────
 *
 * `foundry_event_participants` has a nullable `user_id` and a PARTIAL INDEX on
 * `(event_id, user_id) where user_id is not null` — an index, not a constraint. Its own column
 * comment states the intent plainly: "Not unique per (event_id, user_id): multiple devices for one
 * account each create their own participant." That is correct for the anonymous/web path and must
 * stay true there.
 *
 * Adding `unique (event_id, user_id)` would need a measurement of existing production duplicates
 * first, and would change the meaning of every EXISTING row — including web rows that are allowed
 * to duplicate. So this uses the alternative the mission permits: an equally strong ATOMIC SERVER
 * PRIMITIVE, built on a constraint that already exists.
 *
 * THE PRIMITIVE. The participant session token for an account-backed participant is DERIVED, not
 * random:
 *
 *     token = base64url( HMAC-SHA256( FOUNDRY_ROOM_QR_SECRET, "v1:<eventId>:<userId>" ) )
 *
 * Its SHA-256 is therefore a deterministic function of (event, user), and the table already
 * carries `unique (participant_session_token_hash)`. So:
 *
 *   - two concurrent opens compute the SAME hash; the database admits exactly one INSERT and
 *     answers the other with 23505, which this module resolves by re-reading the winner's row;
 *   - a second device for the same account resolves the SAME participant instead of forking one,
 *     which is the property the mission asked for;
 *   - the anonymous path is untouched: it keeps minting random tokens and keeps being allowed to
 *     create one participant per device.
 *
 * The token stays a secret capability: it is an HMAC under the deployment's Foundry secret, so it
 * is no more guessable than the random one, and it is only ever returned to a caller who has
 * ALREADY proven they are that account.
 */

/** Derive the deterministic, secret session token for (event, account). */
export function accountParticipantSessionToken(eventId: string, userId: string): string {
  return createHmac("sha256", resolveFoundryRoomSecret())
    .update(`bty-foundry-account-participant:v1:${eventId}:${userId}`, "utf8")
    .digest("base64url");
}

export type AccountRoomResult =
  | {
      ok: true;
      event: EventRow;
      participant: ParticipantRow;
      /** The raw participant session token, for the caller's in-memory transport. Never logged. */
      participantSession: string;
      created: boolean;
    }
  | { ok: false; reason: string };

/** The honest stand-in when Microsoft supplied no name for this account. */
export const ACCOUNT_PARTICIPANT_FALLBACK_NAME = "BTY member";

/**
 * A display LABEL for this account, resolved server-side from provider-written identity data.
 *
 * PRESENTATION ONLY. It never decides anything, and it is deliberately read from
 * `auth.identities.identity_data` (written by Microsoft) rather than `user_metadata` (writable by
 * the account holder) — a learner must not be able to rename themselves into a colleague on a
 * Host's roster. See `recipientDisplayName.server.ts` for the full reasoning; this reuses it
 * rather than growing a second name source.
 */
async function resolveParticipantLabel(admin: SupabaseClient, userId: string): Promise<string> {
  try {
    const names = await resolveDisplayNames(admin, [userId]);
    const name = names.get(userId);
    if (name && name.trim()) return name.trim().slice(0, 60);
  } catch {
    /* a name is never allowed to be the reason a learner cannot open their training */
  }
  return ACCOUNT_PARTICIPANT_FALLBACK_NAME;
}

/**
 * Open a Foundry room AS AN AUTHENTICATED ACCOUNT: resolve the event from its signed token, then
 * find-or-create this account's participant for it.
 *
 * `authUserId` is SERVER-DERIVED by the caller from the request's session. It is never read from
 * the body, never from the token, and never from a header the browser chose.
 *
 * The event's own gates are unchanged: a closed or rotated room refuses here exactly as it does on
 * the public path, because this asks the same `resolveEventByToken`.
 */
export async function openAccountRoom(
  admin: SupabaseClient,
  joinToken: string,
  authUserId: string,
): Promise<AccountRoomResult> {
  const resolved = await resolveEventByToken(admin, joinToken);
  if (!resolved.ok) return { ok: false, reason: "inactive" };
  const { event, tokenVersion } = resolved;

  const sessionToken = accountParticipantSessionToken(event.id, authUserId);
  const hash = hashParticipantSessionToken(sessionToken);

  // Already open on another device / an earlier visit — the SAME row, by construction.
  const existing = await findParticipantBySession(admin, event.id, sessionToken);
  if (existing) {
    if (existing.status !== "joined") return { ok: false, reason: "removed" };
    return { ok: true, event, participant: existing, participantSession: sessionToken, created: false };
  }

  /*
    QR ROTATION, THE SAME RULE THE PUBLIC ROOM ALREADY APPLIES.

    `resolveEventByToken` deliberately does not enforce the join version — it reports it, and each
    caller decides, because a RETURNING participant is admitted after a rotation while a NEW join
    is not. `getPublicSnapshot` encodes exactly that, and so does this: the reuse branch above ran
    first and is unaffected, and only the CREATE path below requires a current token.

    Without this line a rotated QR would still mint fresh participants through the Teams door,
    which would make rotation meaningless on the one surface that is easiest to forward.
  */
  if (tokenVersion !== event.join_version) return { ok: false, reason: "qr_rotated" };

  const displayName = await resolveParticipantLabel(admin, authUserId);
  const { data, error } = await admin
    .from("foundry_event_participants")
    .insert({
      event_id: event.id,
      display_name: displayName,
      participant_session_token_hash: hash,
      user_id: authUserId,
    })
    .select("id, event_id, display_name, status, joined_at, last_seen_at, user_id")
    .maybeSingle<ParticipantRow>();

  if (data) {
    return { ok: true, event, participant: data, participantSession: sessionToken, created: true };
  }

  /*
    THE RACE, RESOLVED BY THE DATABASE. A concurrent open computed the same hash and won the
    unique index. Re-read rather than retry: the winner's row IS this account's participant, so
    there is nothing to create and nothing to reconcile.
  */
  const winner = await findParticipantBySession(admin, event.id, sessionToken);
  if (winner) {
    if (winner.status !== "joined") return { ok: false, reason: "removed" };
    return { ok: true, event, participant: winner, participantSession: sessionToken, created: false };
  }
  return { ok: false, reason: error ? "participant_write_failed" : "participant_unresolved" };
}
