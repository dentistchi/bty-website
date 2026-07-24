// Timed Access Pass Foundation V1 (BUILD 17) — the pure vocabulary + effective
// entitlement projection. No I/O, no DOM.
//
// A Timed Access Pass belongs to the canonical Host ACCOUNT. This module owns the closed
// sets (pass types, fixed durations, statuses) and the ONE rule that resolves the
// account's EFFECTIVE entitlement from its base plan + pass state. The DB is the server
// authority (karaoke_timed_pass_state_at computes the same effective label from server
// time); the app never re-derives these rules elsewhere, and the UI renders the resolved
// projection — never the raw thresholds.
//
// Core rule (§1.7): PRO base wins first (a PRO account never consumes a pass); otherwise a
// valid ACTIVE pass yields TIMED_ACCESS; otherwise FREE. A SELECTED pass grants NOTHING on
// its own — it is only the first-start activation candidate handled inside the server
// lifecycle transaction.

export const PASS_TYPES = ['ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS'] as const;
export type PassType = (typeof PASS_TYPES)[number];

/** Fixed durations — V1 forbids arbitrary time input. */
export const PASS_DURATION_SECONDS: Record<PassType, number> = {
  ONE_HOUR: 3600,
  FOUR_HOURS: 14400,
  TWENTY_FOUR_HOURS: 86400,
};

export const PASS_STATUSES = ['AVAILABLE', 'SELECTED', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

/** The account's resolved access level. TIMED_ACCESS is distinct from PRO (§1.7). */
export type EffectiveEntitlement = 'PRO' | 'TIMED_ACCESS' | 'FREE';

/** Base plan (from karaoke_host_plan_assignments). */
export type BasePlan = 'FREE' | 'PRO';

export function isPassType(v: unknown): v is PassType {
  return typeof v === 'string' && (PASS_TYPES as readonly string[]).includes(v);
}

export function durationForPassType(t: PassType): number {
  return PASS_DURATION_SECONDS[t];
}

/** A pass can be SELECTED only from AVAILABLE (re-selecting SELECTED is an idempotent no-op). */
export function isSelectable(status: PassStatus): boolean {
  return status === 'AVAILABLE';
}

/** Manager may revoke only an UNUSED pass — never an ACTIVE/EXPIRED/REVOKED one (§1.3). */
export function isRevocable(status: PassStatus): boolean {
  return status === 'AVAILABLE' || status === 'SELECTED';
}

/**
 * THE effective-entitlement rule (§1.7). A SELECTED pass is deliberately NOT an input:
 * selection alone never grants TIMED_ACCESS. `hasValidActivePass` means an ACTIVE pass
 * whose expires_at is still in the future at the server as-of instant.
 */
export function resolveEffectiveEntitlement(
  basePlan: BasePlan,
  hasValidActivePass: boolean,
): EffectiveEntitlement {
  if (basePlan === 'PRO') return 'PRO';
  if (hasValidActivePass) return 'TIMED_ACCESS';
  return 'FREE';
}

export interface ActivePassView {
  id: string;
  passType: PassType;
  durationSeconds: number;
  activatedAt: string;
  expiresAt: string;
  /** Server-truth remaining seconds, clamped >= 0. Never a client clock. */
  remainingSeconds: number;
}

export interface SelectedPassView {
  id: string;
  passType: PassType;
  durationSeconds: number;
  selectedAt: string;
}

/** The resolved, app-facing pass state — the ONE shape web + native render from. */
export interface TimedPassState {
  basePlan: BasePlan;
  effectiveEntitlement: EffectiveEntitlement;
  activePass: ActivePassView | null;
  selectedPass: SelectedPassView | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function passTypeOf(v: unknown): PassType | null {
  return isPassType(v) ? v : null;
}

function parseActive(raw: unknown): ActivePassView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const passType = passTypeOf(r.passType);
  const activatedAt = str(r.activatedAt);
  const expiresAt = str(r.expiresAt);
  if (!id || !passType || !activatedAt || !expiresAt) return null;
  const remaining = typeof r.remainingSeconds === 'number' ? Math.max(0, Math.floor(r.remainingSeconds)) : 0;
  return {
    id,
    passType,
    durationSeconds: typeof r.durationSeconds === 'number' ? r.durationSeconds : durationForPassType(passType),
    activatedAt,
    expiresAt,
    remainingSeconds: remaining,
  };
}

function parseSelected(raw: unknown): SelectedPassView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const passType = passTypeOf(r.passType);
  const selectedAt = str(r.selectedAt);
  if (!id || !passType || !selectedAt) return null;
  return {
    id,
    passType,
    durationSeconds: typeof r.durationSeconds === 'number' ? r.durationSeconds : durationForPassType(passType),
    selectedAt,
  };
}

/**
 * Coerce the karaoke_timed_pass_state_at jsonb into the typed projection. Returns null
 * when the shape is unusable (missing/failed outcome) so callers fail safe. The server
 * already resolved `effectiveEntitlement`; this preserves it rather than re-deriving, and
 * falls back to the pure rule only when the field is absent.
 */
export function parseTimedPassState(raw: unknown): TimedPassState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.outcome !== 'ok') return null;
  const basePlan: BasePlan = r.basePlan === 'PRO' ? 'PRO' : 'FREE';
  const activePass = parseActive(r.activePass);
  const selectedPass = parseSelected(r.selectedPass);
  const serverEffective = r.effectiveEntitlement;
  const effectiveEntitlement: EffectiveEntitlement =
    serverEffective === 'PRO' || serverEffective === 'TIMED_ACCESS' || serverEffective === 'FREE'
      ? serverEffective
      : resolveEffectiveEntitlement(basePlan, activePass !== null);
  return { basePlan, effectiveEntitlement, activePass, selectedPass };
}
