// BUILD 26U-R1 — BTY Premium Room: the pure vocabulary. No I/O, no DOM, no clock.
//
// WHAT THE PRODUCT IS. A BTY Premium Room is a time-limited hosted karaoke-room SESSION
// run by BTY's own coordination service: guest QR/code participation, a shared multi-user
// request queue, host ordering and turn-taking, participant state, and synchronized stage
// state. It is measured in wall-clock seconds of session time.
//
// WHAT THE PRODUCT IS NOT. It is not YouTube access, YouTube playback, playback time, a
// number of videos, or permission to watch any particular video. Nothing in this module —
// and nothing downstream of it — may take a media duration as an input. Searching YouTube
// and opening a chosen video on YouTube are FREE, always, and are deliberately not
// expressible as capabilities here: a capability key is something that CAN be withheld, and
// those two never can be.
//
// WHY THE ENUM HAS FOUR ARMS. `SELECTED_PASS` is not entitlement and must never be treated
// as such — an armed pass grants nothing until the session that starts its clock actually
// opens. Collapsing it into `entitled` was the exact mistake BUILD 17 §1.7 warned about, so
// it is a distinct arm carrying `armable: true` instead.

/** Why an account may (or may not) run a hosted room right now. Server-decided. */
export const PREMIUM_ROOM_SOURCES = ['PRO', 'ACTIVE_PASS', 'SELECTED_PASS', 'NONE'] as const;
export type PremiumRoomSource = (typeof PREMIUM_ROOM_SOURCES)[number];

/**
 * The resolved, app-facing premium-room state — the ONE shape web and native render from.
 *
 * `entitled` is the only field that decides anything. `armable` says a session COULD be
 * started (which would consume the armed pass); it is an offer, never an authorization.
 */
export interface PremiumRoomEntitlement {
  entitled: boolean;
  source: PremiumRoomSource;
  basePlan: 'FREE' | 'PRO';
  /** The grant backing this answer, if any. Never rendered — used for evidence only. */
  passGrantId: string | null;
  /** When the running session time runs out. Null for PRO (no expiry) and when not entitled. */
  expiresAt: string | null;
  /** Server-truth wall-clock seconds left in the session. Null for PRO / not entitled. */
  remainingSeconds: number | null;
  /** True when an armed (SELECTED) pass exists and would start on the next session open. */
  armable: boolean;
  /** What an armable pass is worth the moment it starts: duration + carried residual. */
  effectiveWindowSeconds: number | null;
}

/** The capabilities a hosted BTY room session provides. Every one is BTY-owned coordination. */
export const PREMIUM_ROOM_CAPABILITY_KEYS = [
  'canStartHostedSession',
  'canInviteGuestsByQr',
  'canUseSharedQueue',
  'canOrderQueue',
  'canManageParticipants',
  'canUseSynchronizedStage',
  'canPassTurn',
] as const;
export type PremiumRoomCapabilityKey = (typeof PREMIUM_ROOM_CAPABILITY_KEYS)[number];
export type PremiumRoomCapabilities = Record<PremiumRoomCapabilityKey, boolean>;

/**
 * THE capability rule. Every premium capability rises and falls together with the ONE
 * entitlement fact, deliberately: a partially-premium room is a product nobody asked for,
 * and per-capability gating is how payment checks end up scattered through the UI.
 */
export function premiumRoomCapabilities(entitled: boolean): PremiumRoomCapabilities {
  return {
    canStartHostedSession: entitled,
    canInviteGuestsByQr: entitled,
    canUseSharedQueue: entitled,
    canOrderQueue: entitled,
    canManageParticipants: entitled,
    canUseSynchronizedStage: entitled,
    canPassTurn: entitled,
  };
}

/**
 * The FREE capabilities. These are TRUE unconditionally and take no argument at all — the
 * signature is the guarantee. A future edit that wanted to gate one of these would have to
 * change this function's shape, which is a reviewable event rather than a silent flag flip.
 *
 * `canOpenOnYouTube` is listed here so the free path is a named, testable product fact
 * rather than merely the absence of a check somewhere.
 */
export function freeCapabilities(): {
  canSearchYouTube: true;
  canSeeSearchResults: true;
  canOpenOnYouTube: true;
  canUseSavedSongs: true;
  canCreateRoom: true;
  canEditRoomSettings: true;
  canUsePresetBranding: true;
} {
  return {
    canSearchYouTube: true,
    canSeeSearchResults: true,
    canOpenOnYouTube: true,
    canUseSavedSongs: true,
    canCreateRoom: true,
    canEditRoomSettings: true,
    canUsePresetBranding: true,
  };
}

/** Outcomes of the atomic session-start authority. Mirrors the RPC's `outcome` values. */
export type StartPremiumRoomOutcome =
  | 'ok'
  | 'already_live'
  | 'premium_room_required'
  | 'ownership_state_invalid'
  | 'room_retired'
  | 'room_not_found'
  | 'code_conflict';

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function isSource(v: unknown): v is PremiumRoomSource {
  return typeof v === 'string' && (PREMIUM_ROOM_SOURCES as readonly string[]).includes(v);
}

/**
 * Coerce the `karaoke_premium_room_entitlement_at` jsonb into the typed projection.
 *
 * Returns a NOT-ENTITLED value for any unusable shape rather than null. A caller that
 * cannot tell "no answer" from "no entitlement" would have to invent a default, and the
 * only safe default is the one this returns — so it is returned here, once, instead of at
 * every call site.
 */
export function parsePremiumRoomEntitlement(raw: unknown): PremiumRoomEntitlement {
  const denied: PremiumRoomEntitlement = {
    entitled: false,
    source: 'NONE',
    basePlan: 'FREE',
    passGrantId: null,
    expiresAt: null,
    remainingSeconds: null,
    armable: false,
    effectiveWindowSeconds: null,
  };
  if (typeof raw !== 'object' || raw === null) return denied;
  const r = raw as Record<string, unknown>;
  if (r.outcome !== 'ok') return denied;
  return {
    entitled: r.entitled === true,
    source: isSource(r.source) ? r.source : 'NONE',
    basePlan: r.basePlan === 'PRO' ? 'PRO' : 'FREE',
    passGrantId: str(r.passGrantId),
    expiresAt: str(r.expiresAt),
    remainingSeconds: num(r.remainingSeconds),
    armable: r.armable === true,
    effectiveWindowSeconds: num(r.effectiveWindowSeconds),
  };
}
