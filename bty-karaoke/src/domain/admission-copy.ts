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

// ── BUILD 24-G1 — `upgrade_required` is TWO different facts, and it said only one ────────────
//
// FOUNDER-OBSERVED FAILURE. With 1:50 of FREE time left and a 4:41 next song, Host Web showed
// BOTH of these on one screen:
//
//     "무료 이용 시간이 1:50 남았어요"          (the banner, correct)
//     "오늘의 무료 이용 시간을 모두 사용했어요"   (the block, FALSE)
//
// The server was right to refuse — the shortfall was 2:51, far past the 90s Final Song Grace
// bound — but the balance was NOT exhausted. Three call sites hard-coded "all time used" as the
// wording for `upgrade_required`, when the RPC raises that outcome for the whole predicate
// `v_charge > v_remaining`. "Exhausted" is only the special case where `v_remaining` is 0.
//
// The two facts need different sentences because the operator's next action differs: at zero the
// only options are wait for the reset or upgrade; with time left, picking a shorter song works
// right now. Telling a Host with 1:50 left that they have nothing left sends them to the wrong
// remedy, and is simply untrue.
//
// PRESENTATION ONLY. This decides no admission — the server already refused. It selects wording
// from values the authority published, and computes no eligibility of its own.

/** A: the FREE allowance really is used up. Reachable only when remaining is 0. */
export const UPGRADE_REQUIRED_EXHAUSTED =
  '오늘의 무료 이용 시간을 모두 사용했어요. PRO로 업그레이드하면 다음 곡을 지금 시작할 수 있어요.';

/** B: time remains, but not enough for THIS song. The remedy is a shorter song, not an upgrade. */
export const UPGRADE_REQUIRED_TOO_LONG =
  '남은 무료 이용 시간보다 이 곡이 길어서 시작할 수 없어요.\n더 짧은 곡을 선택하거나, PRO로 업그레이드해 주세요.';

/** mm:ss for a non-negative second count. Local so this module stays dependency-free. */
function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Wording for a server `upgrade_required` refusal.
 *
 * `remainingSeconds` is the ONLY discriminator, and it comes from the authority — either the
 * published admission detail or the usage projection returned with the refusal. When it is
 * absent the exhausted sentence is used, which is the wording that shipped before BUILD 24 and
 * is the safe fallback: it never claims the Host has time they do not have.
 *
 * The concrete second line is added only when the authority supplied BOTH numbers. It leads with
 * the REQUIRED time (the union charge actually compared), not the raw song length, because an
 * active lease can make them differ — quoting the song length as "needed" would overstate it.
 */
export function upgradeRequiredCopy(d: {
  remainingSeconds?: number | null;
  requiredChargeSeconds?: number | null;
  durationSeconds?: number | null;
} | null | undefined): string {
  const remaining = typeof d?.remainingSeconds === 'number' ? d.remainingSeconds : null;
  if (remaining === null || remaining <= 0) return UPGRADE_REQUIRED_EXHAUSTED;

  const charge = typeof d?.requiredChargeSeconds === 'number' ? d.requiredChargeSeconds : null;
  if (charge === null) return UPGRADE_REQUIRED_TOO_LONG;

  const duration = typeof d?.durationSeconds === 'number' ? d.durationSeconds : null;
  // The song length is named only when it genuinely differs from the required time.
  const lengthNote = duration !== null && duration !== charge ? ` (곡 길이 ${clock(duration)})` : '';
  return (
    `${UPGRADE_REQUIRED_TOO_LONG}\n` +
    `이번 재생에 필요한 시간은 ${clock(charge)}인데, 남은 무료 시간은 ${clock(remaining)}이에요.${lengthNote}`
  );
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
