// BUILD 26U-R1 (R1-G) — the ONE place BTY Premium Room's Host-facing wording is decided.
//
// PURE — no DB, no network, no clock, no framework.
//
// THE RULE EVERY SENTENCE HERE OBEYS: it describes BTY's own hosted-room coordination
// service, and it never describes YouTube. It never says a video may not be watched, never
// prices playback, never mentions a song's length, and never asks anyone to buy anything in
// order to see a video. When BTY Room time ends, the sentence says what ended (the room) and
// what did not (search, and opening a song on YouTube) — because that is the true and
// useful thing to say, and because leaving it unsaid is what made the old copy read as a
// playback paywall.
//
// WHAT THIS REPLACES, and why each had to go:
//   * PASS_INSUFFICIENT_COPY — "남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요"
//     priced a specific video by its length. Retired with the gate that produced it.
//   * UPGRADE_REQUIRED_EXHAUSTED / _TOO_LONG — "PRO로 업그레이드하면 다음 곡을 지금 시작할 수
//     있어요" / "더 짧은 곡을 선택하거나" sold an upgrade as the way to play a video, and told
//     a Host to pick a shorter song. Both meanings are now unreachable.
// Neither is deleted from history; both are simply no longer produced by any served path.

/** The product family name. One string, so a rename can never land half-applied. */
export const PREMIUM_ROOM_NAME_KO = 'BTY 프리미엄 룸';
export const PREMIUM_ROOM_NAME_EN = 'BTY Premium Room';

/**
 * A hosted session was requested with no BTY Room time. States the product, then states —
 * unprompted — that the free path is untouched, so nobody reads this as "pay to watch".
 */
export const PREMIUM_ROOM_REQUIRED_KO =
  'BTY 룸 이용 시간이 필요해요. 노래 검색과 YouTube에서 열기는 계속 무료로 사용할 수 있어요.';

/**
 * The running session ran out of time. This is the sentence the Founder approved in R1-F.
 * It names the ending and the survival in that order, and mentions YouTube exactly once —
 * as something that still works.
 */
export const PREMIUM_ROOM_EXPIRED_KO =
  'BTY 룸 이용 시간이 종료되었어요. 노래 검색과 YouTube에서 열기는 계속 사용할 수 있어요.';

/** The room has no unambiguous active owner — an operational fault, never a sales moment. */
export const PREMIUM_ROOM_OWNERSHIP_KO = '이 노래방의 소유 계정을 확인할 수 없어 세션을 시작할 수 없어요.';

/** The room was retired. Terminal and factual. */
export const PREMIUM_ROOM_RETIRED_KO = '종료된 노래방이에요.';

/** A transient failure to open a session. Retryable, and says so. */
export const PREMIUM_ROOM_START_FAILED_KO = '세션을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';

/** The machine-readable refusal codes a premium route may return. */
export type PremiumRoomRefusalCode =
  | 'PREMIUM_ROOM_REQUIRED'
  | 'PREMIUM_ROOM_EXPIRED'
  | 'OWNERSHIP_STATE_INVALID'
  | 'ROOM_RETIRED'
  | 'ROOM_NOT_FOUND'
  | 'START_FAILED';

const COPY: Readonly<Record<PremiumRoomRefusalCode, string>> = {
  PREMIUM_ROOM_REQUIRED: PREMIUM_ROOM_REQUIRED_KO,
  PREMIUM_ROOM_EXPIRED: PREMIUM_ROOM_EXPIRED_KO,
  OWNERSHIP_STATE_INVALID: PREMIUM_ROOM_OWNERSHIP_KO,
  ROOM_RETIRED: PREMIUM_ROOM_RETIRED_KO,
  ROOM_NOT_FOUND: PREMIUM_ROOM_RETIRED_KO,
  START_FAILED: PREMIUM_ROOM_START_FAILED_KO,
};

/** Host-facing wording for a refusal code. Unknown codes degrade to the retryable sentence. */
export function premiumRoomRefusalCopy(code: string | null | undefined): string {
  return (code && COPY[code as PremiumRoomRefusalCode]) || PREMIUM_ROOM_START_FAILED_KO;
}

/**
 * The HTTP status a refusal deserves.
 *
 * 402 is used for the two entitlement refusals because that is what the shipped clients
 * already treat as "the server declined for a commercial reason, nothing was mutated" — the
 * meaning is unchanged even though the subject is now a room session rather than a song.
 * Everything else is a plain conflict or a server fault and must not be confused with one.
 */
export function premiumRoomRefusalStatus(code: PremiumRoomRefusalCode): 402 | 409 | 404 | 500 {
  switch (code) {
    case 'PREMIUM_ROOM_REQUIRED':
    case 'PREMIUM_ROOM_EXPIRED':
      return 402;
    case 'OWNERSHIP_STATE_INVALID':
    case 'ROOM_RETIRED':
      return 409;
    case 'ROOM_NOT_FOUND':
      return 404;
    case 'START_FAILED':
      return 500;
  }
}
