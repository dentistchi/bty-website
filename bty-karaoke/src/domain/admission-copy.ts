// BUILD 23 — the ONE place a fail-closed admission block's Host-facing wording is decided,
// and the ONE place that decides which authoritative admission values may be published.
//
// WHY THIS MODULE EXISTS: BUILD 21 put this wording inside `/dj/start/route.ts`. BUILD 23 has to
// say the SAME sentences from the auto-advance path (`/dj/pass-turn` and the complete/skip
// advance), and a route importing another route's private constants would make one endpoint's
// presentation an implicit dependency of another's. Extracting it here keeps a single source of
// truth without creating that coupling.
//
// PURE — no DB, no network, no clock, no framework. Everything below is a total function of its
// arguments, so every branch is directly unit-testable.
//
// BUILD 26U-R1 — the two retired ENTITLEMENT sentences (pass-cannot-cover-this-song, and the
// FREE video-second shortfall) now resolve to the ONE Premium Room sentence, which lives in
// `premium-room-copy` so the routes and this module cannot drift apart. The DURATION-block
// wording below is a separate concern and is untouched: it explains a technical failure to read
// a video's length, and sells nothing.
//
// The wording is BUILD 21's, moved VERBATIM. Two rules survive the move unchanged:
//   1. `too_long` may only ever be selected for a duration that was positively established as
//      finite and genuinely over the bound. A missing/malformed/zero/negative duration is not
//      length information and degrades to the generic retryable sentence — the classifier
//      (`classifyDurationSeconds`) already guarantees this, and nothing here may widen it.
//   2. An absent or unrecognized reason renders the exact sentence that shipped before BUILD 21,
//      so an older or unclassified payload is never worse off than it was.

import { PREMIUM_ROOM_EXPIRED_KO } from './premium-room-copy';

/**
 * The generic, retryable sentence. This is the ONLY case where "try again in a moment" is true,
 * so it doubles as `lookup_failed`'s wording and as the fallback for an absent/unknown reason.
 */
export const DURATION_BLOCK_GENERIC = '영상 길이를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';

/**
 * Reason-specific wording. Each branch states what happened AND the next action, and every branch
 * says the song is still queued — because it is. Nothing was mutated by a fail-closed block.
 *
 * Keyed by the server's raw `DurationFailureReason` string rather than an imported union: this
 * module sits below the layer that owns that type, and an unrecognized future key must degrade
 * through `durationBlockCopy` instead of failing to compile or throwing.
 */
export const DURATION_BLOCK_COPY: Readonly<Record<string, string>> = {
  too_long:
    '이 영상은 너무 길어요 (15분을 넘습니다). 노래는 대기열에 그대로 있습니다.\n더 짧은 버전을 선택해 주세요.',
  video_unavailable:
    '이 영상을 재생할 수 없어요 (삭제되었거나 비공개일 수 있어요). 노래는 대기열에 그대로 있습니다.\n다른 영상을 선택해 주세요.',
  quota_exceeded:
    'YouTube 일일 조회 한도를 초과해 영상 길이를 확인할 수 없어요. 노래는 대기열에 그대로 있습니다.\n한도가 복구된 뒤 다시 시도해 주세요.',
  lookup_failed: DURATION_BLOCK_GENERIC,
  not_configured:
    '영상 길이 확인이 설정되지 않아 재생을 시작할 수 없어요. 노래는 대기열에 그대로 있습니다.\n관리자에게 문의해 주세요.',
};

/** Map the server's classification to Host-facing wording; unknown/absent → the generic sentence. */
export function durationBlockCopy(reason: string | undefined | null): string {
  return (reason && DURATION_BLOCK_COPY[reason]) || DURATION_BLOCK_GENERIC;
}

/**
 * BUILD 26U-R1 (R1-G) — RETIRED SENTENCE, REPLACED IN PLACE.
 *
 * This used to read "남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요" — a pass remainder
 * priced against one video's length. Both halves of that meaning are gone: the gate that produced
 * it was removed from `karaoke_begin_song_v2` by E1 (20260817120000), and BTY no longer sells
 * permission to play a particular video at all.
 *
 * The CONSTANT survives because three routes still reference it on branches the server can no
 * longer reach; collapsing the VALUE removes the meaning from all of them at once, which is
 * safer than deleting the name and editing four files to match.
 */
export const PASS_INSUFFICIENT_COPY = PREMIUM_ROOM_EXPIRED_KO;

// ── BUILD 26U-R1 (R1-D / R1-G) — THE FREE VIDEO-SECOND METER IS RETIRED ──────────────────────
//
// BUILD 24-G1 lived here: `upgrade_required` was TWO facts ("you have none left" vs "you have
// some, but not enough for THIS song") and the copy said only one. It was a real defect and the
// fix was correct — for a product that metered YouTube by the second.
//
// Founder decision O-3 retired that meter, and E1 (20260817120000) had already removed its
// enforcement from the admission RPC. So there is no balance to quote, no required charge to
// lead with, and no upgrade to offer as a way to start a video. Both sentences, and the
// batchim-selected itemised variants they fed, are gone.
//
// What is left is the single true statement, and `upgradeRequiredCopy` keeps its signature so
// the three routes that call it need no change: it now ignores the detail entirely, which is
// precisely the guarantee — no number about a video can re-enter this copy.

/** The one neutral refusal. Named for continuity with the shipped constant. */
export const UPGRADE_REQUIRED_EXHAUSTED = PREMIUM_ROOM_EXPIRED_KO;

/**
 * Wording for a server entitlement refusal on a start path.
 *
 * Takes the admission detail so every existing call site compiles unchanged, and deliberately
 * consults NONE of it. A permanent test (UX-1) asserts the result contains no quantity.
 */
export function upgradeRequiredCopy(_d: {
  remainingSeconds?: number | null;
  requiredChargeSeconds?: number | null;
  durationSeconds?: number | null;
} | null | undefined): string {
  return PREMIUM_ROOM_EXPIRED_KO;
}

/**
 * The authoritative admission values a decision transaction computed. Structural on purpose —
 * `rooms.server.ts` owns the canonical `AdmissionDetail` interface, and this module must not
 * import upward to describe it.
 */
export interface PublishableAdmissionDetail {
  leaseEndsAt?: string | null;
  durationSeconds?: number | null;
  requiredChargeSeconds?: number | null;
  remainingSeconds?: number | null;
  passExpiresAt?: string | null;
  finalSongGraceApplied?: boolean;
  finalSongGraceSeconds?: number | null;
  finalSongChargedSeconds?: number | null;
  remainingBeforeSeconds?: number | null;
  /** BUILD 26M — count of passes the Host could switch to. Publishable: a bare count names no
   *  grant, no account and no pass identity, and it only chooses which sentence is shown. */
  switchCandidateCount?: number | null;
}

/**
 * BUILD 20M-GLOBAL-CUTOVER-R1's publication allowlist, moved here unchanged so every route that
 * reports an admission decision publishes the SAME approved subset.
 *
 * A field is emitted ONLY when the authority actually produced it. Nothing is defaulted to 0 or
 * to an empty string — a missing value must read as "unknown" so the client falls back to generic
 * copy instead of showing a fabricated number.
 *
 * Deliberately NOT publishable, and unreachable through this function by construction: account
 * id, pass grant id, usage-segment id, charged window, `passCovered`/`passActivated`, plan
 * snapshot, and every other billing or security internal. Adding a key to the output requires
 * editing this allowlist, which is what makes leakage a reviewable event rather than an accident.
 */
export function publishAdmissionFields(
  r: PublishableAdmissionDetail,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (typeof r.leaseEndsAt === 'string' && r.leaseEndsAt) out.leaseEndsAt = r.leaseEndsAt;
  if (typeof r.durationSeconds === 'number') out.durationSeconds = r.durationSeconds;
  if (typeof r.requiredChargeSeconds === 'number') out.requiredChargeSeconds = r.requiredChargeSeconds;
  if (typeof r.remainingSeconds === 'number') out.remainingSeconds = r.remainingSeconds;
  if (typeof r.passExpiresAt === 'string' && r.passExpiresAt) out.passExpiresAt = r.passExpiresAt;
  // BUILD 26M — emitted only when the authority actually counted (i.e. on a pass refusal). An
  // absent key means "unknown", and the client must then keep the existing shorter-song wording
  // rather than offering a switch it cannot know is possible.
  if (typeof r.switchCandidateCount === 'number') out.switchCandidateCount = r.switchCandidateCount;
  // R4 — grace is published ONLY when it actually applied. An ordinary start emits no grace key
  // at all, so older clients and the v1 path see the exact payload they saw before.
  if (r.finalSongGraceApplied === true) {
    out.finalSongGraceApplied = true;
    if (typeof r.finalSongGraceSeconds === 'number') out.finalSongGraceSeconds = r.finalSongGraceSeconds;
    if (typeof r.finalSongChargedSeconds === 'number') out.finalSongChargedSeconds = r.finalSongChargedSeconds;
    if (typeof r.remainingBeforeSeconds === 'number') out.remainingBeforeSeconds = r.remainingBeforeSeconds;
  }
  return out;
}
