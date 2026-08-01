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
// The wording is BUILD 21's, moved VERBATIM. Two rules survive the move unchanged:
//   1. `too_long` may only ever be selected for a duration that was positively established as
//      finite and genuinely over the bound. A missing/malformed/zero/negative duration is not
//      length information and degrades to the generic retryable sentence — the classifier
//      (`classifyDurationSeconds`) already guarantees this, and nothing here may widen it.
//   2. An absent or unrecognized reason renders the exact sentence that shipped before BUILD 21,
//      so an older or unclassified payload is never worse off than it was.

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
 * The timed pass cannot cover the WHOLE next song. Deliberately distinct from every
 * "could not check the length" sentence: the operator's next action differs (buy/extend time vs.
 * pick a different song), and conflating them was the original BUILD 21 complaint one level up.
 */
export const PASS_INSUFFICIENT_COPY = '남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.';

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
