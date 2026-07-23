// Daily FREE Karaoke Minutes — B2 usage PROJECTION (pure). No I/O, no DOM.
//
// The SINGLE place the raw entitlement snapshot (from the karaoke_free_minutes RPC)
// is turned into the client-facing decision: which banner state to render and whether
// a NEW metered start is currently blocked. Both the web Admin and the native SwiftUI
// Admin consume the RESOLVED `bannerKind` + fields — neither re-derives the 300s/120s
// thresholds or the zero-while-playing split. This keeps the "UI never re-computes
// business rules" invariant: warning/block logic lives here (and in the SQL RPC),
// never twice in two clients.
//
// Server truth only: `remainingSeconds` is already clamped to >= 0 and `warnLevel`
// already computed by the RPC (enforcement-aware). This module adds the one thing the
// RPC cannot know from a single row set: whether a song is currently playing, which
// splits the zero state into "current may finish" vs "idle, blocked".

export type PlanKind = 'FREE' | 'PRO';

/** RPC-computed warning level (enforcement-aware; 'none' whenever enforcement is off). */
export type WarnLevel = 'none' | 'five_min' | 'two_min' | 'zero';

/**
 * The resolved banner state a client renders. Exactly one applies at a time — the
 * five-minute and two-minute states are mutually exclusive (strongest wins).
 */
export type UsageBannerKind =
  | 'pro' //          PRO — unlimited, never a FREE countdown or warning
  | 'disabled' //     enforcement off — usage may be observed but is NOT active enforcement
  | 'normal' //       FREE, remaining > 300s — compact remaining, no warning
  | 'five_min' //     120s < remaining <= 300s
  | 'two_min' //      0s < remaining <= 120s
  | 'zero_playing' // remaining <= 0 AND a song is playing — current may finish, next blocked
  | 'zero_idle'; //   remaining <= 0 AND nothing playing — new start blocked (upgrade)

/** The typed raw entitlement snapshot returned by the RPC. */
export interface UsageEntitlement {
  plan: PlanKind;
  unlimited: boolean;
  enforcementEnabled: boolean;
  limitSeconds: number | null;
  usedSeconds: number;
  remainingSeconds: number | null;
  activePlaybackCount: number;
  nextResetAt: string | null;
  windowStart: string | null;
  timezone: string | null;
  warnLevel: WarnLevel;
}

/** The client-facing projection — the ONE shape web + native render from. */
export interface UsageProjection {
  plan: PlanKind;
  enforcementEnabled: boolean;
  unlimited: boolean;
  limitSeconds: number | null;
  /** Never negative — server-truth remaining, clamped for display. null for PRO. */
  remainingSeconds: number | null;
  usedSeconds: number;
  nextResetAt: string | null;
  timezone: string | null;
  /** Whether a song is currently on stage for this account. */
  isPlaying: boolean;
  bannerKind: UsageBannerKind;
  /**
   * True when a NEW metered start would be blocked RIGHT NOW (FREE + enforcement on +
   * remaining <= 0). The server is always the authority; clients use this only to
   * intercept/label — never as the sole enforcement (§11).
   */
  startBlocked: boolean;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Coerce the raw RPC jsonb into a typed entitlement. Returns null when the shape is
 * unusable (missing plan) so callers fail safe rather than render garbage. Unknown
 * warn levels collapse to 'none'; PRO's null limits/remaining are preserved.
 */
export function parseEntitlement(raw: unknown): UsageEntitlement | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const plan: PlanKind = r.plan === 'PRO' ? 'PRO' : 'FREE';
  const warnRaw = r.warnLevel;
  const warnLevel: WarnLevel =
    warnRaw === 'five_min' || warnRaw === 'two_min' || warnRaw === 'zero' ? warnRaw : 'none';
  const limit = r.limitSeconds;
  const remaining = r.remainingSeconds;
  return {
    plan,
    unlimited: r.unlimited === true,
    enforcementEnabled: r.enforcementEnabled === true,
    limitSeconds: typeof limit === 'number' ? limit : null,
    usedSeconds: num(r.usedSeconds, 0),
    remainingSeconds: typeof remaining === 'number' ? remaining : null,
    activePlaybackCount: num(r.activePlaybackCount, 0),
    nextResetAt: str(r.nextResetAt),
    windowStart: str(r.windowStart),
    timezone: str(r.timezone),
    warnLevel,
  };
}

/**
 * The pure decision. Resolve the banner state and whether a new start is blocked from
 * an entitlement snapshot. Threshold order (strongest applicable wins) mirrors §10:
 *
 *   PRO                                  → 'pro'          (never blocked, never warned)
 *   enforcement OFF                      → 'disabled'     (never blocked, never warned)
 *   FREE + on, remaining  > 300          → 'normal'
 *   FREE + on, 120 < remaining <= 300    → 'five_min'
 *   FREE + on,   0 < remaining <= 120    → 'two_min'
 *   FREE + on, remaining <= 0, playing   → 'zero_playing' (current may finish)
 *   FREE + on, remaining <= 0, idle      → 'zero_idle'    (new start blocked)
 */
export function projectUsage(e: UsageEntitlement): UsageProjection {
  const isPlaying = e.activePlaybackCount > 0;
  // Display remaining is always clamped >= 0 (§6 — never show a negative).
  const remainingDisplay = e.remainingSeconds === null ? null : Math.max(0, e.remainingSeconds);

  let bannerKind: UsageBannerKind;
  let startBlocked = false;

  if (e.plan === 'PRO' || e.unlimited) {
    bannerKind = 'pro';
  } else if (!e.enforcementEnabled) {
    bannerKind = 'disabled';
  } else {
    const remaining = remainingDisplay ?? 0;
    if (remaining <= 0) {
      startBlocked = true;
      bannerKind = isPlaying ? 'zero_playing' : 'zero_idle';
    } else if (remaining <= 120) {
      bannerKind = 'two_min';
    } else if (remaining <= 300) {
      bannerKind = 'five_min';
    } else {
      bannerKind = 'normal';
    }
  }

  return {
    plan: e.plan,
    enforcementEnabled: e.enforcementEnabled,
    unlimited: e.unlimited,
    limitSeconds: e.limitSeconds,
    remainingSeconds: remainingDisplay,
    usedSeconds: e.usedSeconds,
    nextResetAt: e.nextResetAt,
    timezone: e.timezone,
    isPlaying,
    bannerKind,
    startBlocked,
  };
}

/** Convenience: raw RPC jsonb → projection, or null when unparseable. */
export function projectEntitlement(raw: unknown): UsageProjection | null {
  const e = parseEntitlement(raw);
  return e ? projectUsage(e) : null;
}
