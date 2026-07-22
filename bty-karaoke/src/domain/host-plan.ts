// Host Plan + Entitlement Foundation V1 — the pure plan vocabulary. No I/O.
//
// A plan belongs to the canonical Host ACCOUNT (not a Room). This module owns the
// closed set of plan codes, sources, and the capability shape the app renders and
// enforces from. The DB stores raw rows; the service layer reads them; UI/API only
// ever consume the resolved HostEntitlements — never these rules re-implemented.
//
// V1 truth: FREE and PRO both grant EVERY current Host capability. No feature is
// gated yet, and PRO grants nothing beyond FREE — we never fabricate a PRO-only
// capability that has no implementation, and never silently promote anyone to PRO.

export const PLAN_CODES = ['FREE', 'PRO'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export const DEFAULT_PLAN_CODE: PlanCode = 'FREE';

/**
 * PRO Multi-Room V1 — how many Rooms a plan may OWN. FREE grants one Norebang; PRO
 * grants up to three. This is the DISPLAY mirror the Host Hub reads to decide whether
 * to show the "create another" action and which limit copy to render. It is NOT the
 * enforcement authority: create_additional_karaoke_room resolves the plan and derives
 * the same FREE=1 / PRO=3 limit INSIDE the locked transaction, so a bypassed UI/route
 * can never exceed it. The two intentionally encode the same numbers; the DB wins.
 */
export const ROOM_LIMITS: Record<PlanCode, number> = { FREE: 1, PRO: 3 };

/** Max Rooms this plan may own. */
export function maxRoomsForPlan(plan: PlanCode): number {
  return ROOM_LIMITS[plan];
}

/**
 * Pure capacity decision: may an account on `plan` that already owns `ownedCount`
 * Rooms create ANOTHER? Legacy over-cap Hosts (ownedCount already ≥ max, e.g. a FREE
 * Host with 2 legacy Rooms) simply return false — they keep every existing Room, only
 * new creation is blocked. Never throws; a negative/NaN count is treated as 0.
 */
export function canCreateAnotherRoom(plan: PlanCode, ownedCount: number): boolean {
  const owned = Number.isFinite(ownedCount) && ownedCount > 0 ? Math.floor(ownedCount) : 0;
  return owned < maxRoomsForPlan(plan);
}

/** How an assignment came to exist. Only SYSTEM_DEFAULT is used in this slice. */
export const PLAN_SOURCES = ['SYSTEM_DEFAULT', 'MANUAL', 'BILLING'] as const;
export type PlanSource = (typeof PLAN_SOURCES)[number];

/** DB-level lifecycle of an assignment row. */
export const PLAN_ASSIGNMENT_STATUSES = ['active', 'ended'] as const;
export type PlanAssignmentStatus = (typeof PLAN_ASSIGNMENT_STATUSES)[number];

/** The status the API/UI presents for the CURRENT plan. Always ACTIVE in V1. */
export type PlanStatus = 'ACTIVE';

/**
 * The capability surface. Every key maps to a Host feature that exists today. New
 * keys may be added as features gain plan gates; a key must never be invented for a
 * feature that isn't implemented.
 */
export const CAPABILITY_KEYS = [
  'canCreateRoom',
  'canEditRoomSettings',
  'canUsePresetBranding',
  'canStartEvent',
  'canManageQueue',
  'canUseGuestQR',
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];
export type Capabilities = Record<CapabilityKey, boolean>;

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === 'string' && (PLAN_CODES as readonly string[]).includes(v);
}

/** Coerce any input to a valid plan code, falling back to FREE. Never throws. */
export function normalizePlanCode(v: unknown): PlanCode {
  return isPlanCode(v) ? v : DEFAULT_PLAN_CODE;
}

export function isPlanSource(v: unknown): v is PlanSource {
  return typeof v === 'string' && (PLAN_SOURCES as readonly string[]).includes(v);
}

/**
 * The pure decision for a manual plan change: given the account's CURRENT plan (null
 * when it has no active assignment yet) and the REQUESTED plan, is this a real change
 * or an idempotent no-op? This is the same rule the atomic RPC enforces; keeping it
 * pure lets both the tests and any caller reason about it without a database. It is
 * NOT a re-derivation of entitlement rules — routes still forward to the RPC, which
 * is the single runtime authority — it only names the no-op condition.
 */
export function decidePlanChange(
  currentPlan: PlanCode | null,
  requestedPlan: PlanCode,
): { kind: 'noop'; plan: PlanCode } | { kind: 'change'; from: PlanCode | null; to: PlanCode } {
  if (currentPlan !== null && currentPlan === requestedPlan) {
    return { kind: 'noop', plan: requestedPlan };
  }
  return { kind: 'change', from: currentPlan, to: requestedPlan };
}

/**
 * The V1 capability map for a plan. Deliberately identical for FREE and PRO: no
 * feature is plan-gated yet, so every current capability is `true` for both. This
 * is what guarantees a FREE Host loses nothing when plans are introduced.
 */
export function capabilitiesForPlan(_code: PlanCode): Capabilities {
  return {
    canCreateRoom: true,
    canEditRoomSettings: true,
    canUsePresetBranding: true,
    canStartEvent: true,
    canManageQueue: true,
    canUseGuestQR: true,
  };
}

/** The resolved, app-facing entitlement view for one Host account. */
export interface HostEntitlements {
  planCode: PlanCode;
  planStatus: PlanStatus;
  source: PlanSource;
  capabilities: Capabilities;
  /**
   * True when NO active assignment existed and FREE was applied as a safe default.
   * Observability only — never surfaced to clients; a paid plan is never inferred.
   */
  fallback: boolean;
}
