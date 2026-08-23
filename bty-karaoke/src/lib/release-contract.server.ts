// BUILD 26U-R2 — THE release-contract authority. One resolution, projected by every route.
//
// R2 §5 requires one centralized rollout authority rather than a decision scattered across
// routes and components. This module is it: a route asks `resolveReleaseContract(req)` once and
// projects the answer. No route reads `premium_room_mode`, parses a header, or compares a build
// number itself, and no client component decides any of it.
//
// THE ORDER OF OPERATIONS IS THE SAFETY PROPERTY:
//
//     read the server-side mode  ──┐
//     parse the client header    ──┴─→  pure matrix  →  'legacy' | 'premium' | 'unsupported'
//
// The mode comes from the database and cannot be influenced by the caller. The header comes
// from the caller and is spoofable. The matrix is a total pure function of the two. A caller can
// therefore choose, at most, between the contracts the SERVER has already decided to offer —
// and under `legacy_free` and `premium_all` it cannot influence the outcome at all, because
// those rows of the matrix are constant.
//
// WHAT A CALLER CAN GET BY LYING, stated plainly: under `dual` only, by omitting the header, a
// caller receives the LEGACY contract — a hosted room that asks for no entitlement. It creates
// no grant, activates no pass and marks nobody entitled, so it cannot produce financial value;
// it is bounded by the DUAL window; and every occurrence is counted in §B telemetry so the
// window can be closed on evidence rather than on hope.

import { karaokeDb } from './supabase.server';
import {
  parseClientRelease,
  normalizeRolloutMode,
  resolveReleaseContract as decideContract,
  releaseClientBucket,
  CLIENT_HEADER,
  DEFAULT_ROLLOUT_MODE,
  type ClientRelease,
  type ReleaseContract,
  type RolloutMode,
} from '@/domain/release-contract';

export interface ReleaseResolution {
  mode: RolloutMode;
  client: ClientRelease;
  contract: ReleaseContract;
}

/**
 * Read the rollout mode from the policy singleton.
 *
 * FAILS TO `legacy_free`, ALWAYS. A database hiccup must never be able to start refusing the
 * public v1.0 app, and it must never be able to hand out a premium session either — the legacy
 * contract is the only answer that is safe in both directions, because it is exactly what the
 * live system does today.
 */
export async function readRolloutMode(): Promise<RolloutMode> {
  try {
    const { data, error } = await karaokeDb().rpc('karaoke_premium_room_mode');
    if (error) return DEFAULT_ROLLOUT_MODE;
    const v = Array.isArray(data) ? data[0] : data;
    return normalizeRolloutMode(v);
  } catch {
    return DEFAULT_ROLLOUT_MODE;
  }
}

/**
 * Count one classification. Best-effort and fail-open without exception: a telemetry failure
 * must never convert a working hosted room into an outage. Under-counting shows up as a
 * discrepancy against traffic volume, which is a reconciliation problem; a blocked room is a
 * product regression.
 */
export async function recordReleaseClient(client: ClientRelease): Promise<void> {
  try {
    await karaokeDb().rpc('karaoke_record_release_client', { p_bucket: releaseClientBucket(client) });
  } catch {
    /* deliberately swallowed — see above */
  }
}

/** Read the client header from any Request-like object (Next's NextRequest included). */
export function clientReleaseFromHeaders(headers: Headers): ClientRelease {
  return parseClientRelease(headers.get(CLIENT_HEADER));
}

/**
 * THE resolution, with no room in scope.
 *
 * Under `dual_allowlist` this necessarily resolves `legacy` for everyone, because participation
 * is a property of an (account, room) pair and neither is known here. That is the containing
 * answer and it is deliberate: a caller that has not said which room it means must not be able
 * to obtain the premium contract.
 *
 * Telemetry is fired and NOT awaited: the classification is already decided, so waiting on a
 * counter would only add latency to every hosted-room action for no decision value.
 */
export async function resolveRelease(req: { headers: Headers }): Promise<ReleaseResolution> {
  const [mode, client] = [await readRolloutMode(), clientReleaseFromHeaders(req.headers)];
  void recordReleaseClient(client);
  return { mode, client, contract: decideContract(mode, client) };
}

/**
 * BUILD 26U-R4A — THE ROOM-SCOPED resolution: the enforcement authority.
 *
 * `inRollout` is the EXACT (owner account, room) pair, resolved server-side from the room's
 * canonical owner — never from the caller's credential, so a delegated DJ token or a QR join
 * cannot influence it. A room with ambiguous ownership is not in the rollout.
 *
 * The allowlist read happens ONLY under `dual_allowlist`; in every other mode the pair is
 * irrelevant and the query is skipped, so the common paths cost exactly what they did before.
 */
export async function resolveRoomRelease(
  req: { headers: Headers },
  roomId: string,
): Promise<ReleaseResolution> {
  const mode = await readRolloutMode();
  const client = clientReleaseFromHeaders(req.headers);
  void recordReleaseClient(client);
  const inRollout = mode === 'dual_allowlist' ? await roomInPremiumRollout(roomId) : false;
  return { mode, client, contract: decideContract(mode, client, inRollout) };
}

/**
 * BUILD 26U-R4A — THE ACCOUNT-SCOPED resolution: commerce VISIBILITY only.
 *
 * A different scope from the room one, and the difference is the product's: BTY Room time is
 * bought FOR AN ACCOUNT, so an account taking part in the controlled rollout may be shown the
 * store. WHERE that time may then be spent stays exact-pair scoped by `resolveRoomRelease`.
 *
 * This must never be used to authorize a hosted session. A permanent test (ALLOW-11) asserts
 * that the session-start path does not call it.
 */
export async function resolveAccountRelease(
  req: { headers: Headers },
  accountId: string,
): Promise<ReleaseResolution> {
  const mode = await readRolloutMode();
  const client = clientReleaseFromHeaders(req.headers);
  void recordReleaseClient(client);
  const inRollout = mode === 'dual_allowlist' ? await accountInPremiumRollout(accountId) : false;
  return { mode, client, contract: decideContract(mode, client, inRollout) };
}

/** Exact (owner account, room) participation. Fails CLOSED on any error. */
export async function roomInPremiumRollout(roomId: string): Promise<boolean> {
  try {
    const { data, error } = await karaokeDb().rpc('karaoke_room_in_premium_rollout', { p_room_id: roomId });
    if (error) return false;
    return (Array.isArray(data) ? data[0] : data) === true;
  } catch {
    return false;
  }
}

/** Account-level participation, for the store surface only. Fails CLOSED on any error. */
export async function accountInPremiumRollout(accountId: string): Promise<boolean> {
  try {
    const { data, error } = await karaokeDb().rpc('karaoke_account_in_premium_rollout', {
      p_account_id: accountId,
    });
    if (error) return false;
    return (Array.isArray(data) ? data[0] : data) === true;
  } catch {
    return false;
  }
}
