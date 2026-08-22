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
 * THE resolution. One database read plus a pure decision.
 *
 * Telemetry is fired and NOT awaited: the classification is already decided, so waiting on a
 * counter would only add latency to every hosted-room action for no decision value.
 */
export async function resolveRelease(req: { headers: Headers }): Promise<ReleaseResolution> {
  const [mode, client] = [await readRolloutMode(), clientReleaseFromHeaders(req.headers)];
  void recordReleaseClient(client);
  return { mode, client, contract: decideContract(mode, client) };
}
