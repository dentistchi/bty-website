/**
 * Center return → Arena re-entry gate.
 *
 * When Center has validated the user (all required diagnostics passed), this flow:
 * sets lockout {@link UserLockoutStatus} to **ACTIVE**, clears lockout window,
 * records a recovery timestamp, and emits {@link ARENA_ACCESS_RESTORED_EVENT}.
 *
 * Wires {@link LockoutService} for typing and handler factories; persistence and
 * event dispatch remain the caller’s responsibility (API / service layer).
 */

import {
  type LockoutState,
  LockoutService,
  createInitialLockoutState,
} from "./lockout.service";

/** Emitted when Arena access is restored after Center diagnostic completion. */
export const ARENA_ACCESS_RESTORED_EVENT = "arena_access_restored" as const;

export type ArenaAccessRestoredPayload = {
  type: typeof ARENA_ACCESS_RESTORED_EVENT;
  userId: string;
  /** Recovery / restore instant (ISO 8601). */
  at: string;
};

/**
 * Center-side completion signal (e.g. after POST /api/center/… validates diagnostics).
 * Caller must set `allRequiredDiagnosticsPassed` only when all required checks passed.
 */
export interface CenterDiagnosticsCompletedEvent {
  userId: string;
  allRequiredDiagnosticsPassed: boolean;
  /** Use as recovery timestamp and event `at`. */
  occurredAt: Date;
}

export interface CenterReturnFlowResult {
  /** False when the diagnostic gate is not satisfied — no state change, no emit. */
  applied: boolean;
  /** Next lockout snapshot to persist — **ACTIVE** with no active window when `applied`. */
  lockoutState: LockoutState;
  /** Logged recovery instant (ISO), or null when not applied. */
  recoveryLoggedAt: string | null;
  /** Dispatch to bus / analytics / Arena gate when `applied`. */
  arenaAccessRestored: ArenaAccessRestoredPayload | null;
}

/**
 * Runs the Arena re-entry gate after Center diagnostic completion.
 *
 * - If `allRequiredDiagnosticsPassed`: forces **ACTIVE**, clears `lockoutStart`,
 *   sets `recoveryLoggedAt`, returns {@link ARENA_ACCESS_RESTORED_EVENT} payload.
 * - Otherwise: returns previous lockout state unchanged.
 */
export function runCenterReturnFlow(
  event: CenterDiagnosticsCompletedEvent,
  previousLockout: LockoutState = createInitialLockoutState(),
  _lockoutService?: LockoutService
): CenterReturnFlowResult {
  if (!event.allRequiredDiagnosticsPassed) {
    return {
      applied: false,
      lockoutState: previousLockout,
      recoveryLoggedAt: null,
      arenaAccessRestored: null,
    };
  }

  const recoveryLoggedAt = event.occurredAt.toISOString();
  const lockoutState: LockoutState = { status: "ACTIVE", lockoutStart: null };

  return {
    applied: true,
    lockoutState,
    recoveryLoggedAt,
    arenaAccessRestored: {
      type: ARENA_ACCESS_RESTORED_EVENT,
      userId: event.userId,
      at: recoveryLoggedAt,
    },
  };
}

/**
 * Binds a {@link LockoutService} for callers that inject it once (orchestration / API).
 * Behavior matches {@link runCenterReturnFlow}; service is reserved for future AIR sync hooks.
 */
export function createCenterReturnRunner(lockoutService: LockoutService) {
  return (
    event: CenterDiagnosticsCompletedEvent,
    previousLockout?: LockoutState
  ): CenterReturnFlowResult =>
    runCenterReturnFlow(event, previousLockout ?? createInitialLockoutState(), lockoutService);
}
