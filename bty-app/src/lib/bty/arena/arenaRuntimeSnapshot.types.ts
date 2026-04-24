/**
 * Phase-1 Arena session router snapshot — server authority for runtime UI gating.
 * @see arenaSessionNextCore.ts
 */

export const ARENA_SESSION_MODE = "arena" as const;

/** Canonical runtime labels for GET /api/arena/n/session (and shared legacy session/next core). */
export type ArenaRuntimeStateId =
  | "ACTION_REQUIRED"
  | "ACTION_SUBMITTED"
  | "ACTION_AWAITING_VERIFICATION"
  | "ARENA_SCENARIO_READY"
  /** Elite: after primary binding — forced tradeoff tier is active (not Action Decision yet). */
  | "TRADEOFF_ACTIVE"
  /** Elite: after tradeoff binding — user must complete Action Decision before contract / run end. */
  | "ACTION_DECISION_ACTIVE"
  /** Post-scenario: run finished; client may fetch the next session (e.g. after POST run/complete). */
  | "NEXT_SCENARIO_READY"
  /** Server may emit when forced-reset pipeline is active. */
  | "FORCED_RESET_PENDING"
  /** Re-exposure / recall due (emit only when detectable). */
  | "REEXPOSURE_DUE";

export type ArenaSessionGates = {
  next_allowed: boolean;
  choice_allowed: boolean;
  qr_allowed: boolean;
};

export type ArenaSessionActionContractSnapshot = {
  exists: boolean;
  id: string | null;
  status: string | null;
  verification_type: string | null;
  deadline_at: string | null;
};

/** Session-router `re_exposure` slice (GET `/api/arena/n/session` when delayed outcomes are due). */
export type ArenaSessionReExposureSlice = {
  due: boolean;
  scenario_id: string | null;
  pending_outcome_id?: string | null;
};

/** Fields attached to 200 / 409 session-router JSON responses. */
export type ArenaSessionRouterSnapshot = {
  mode: typeof ARENA_SESSION_MODE;
  runtime_state: ArenaRuntimeStateId;
  state_priority: number;
  gates: ArenaSessionGates;
  action_contract: ArenaSessionActionContractSnapshot;
  /** Present when server emits re-exposure metadata (not necessarily identical to binding POST shape). */
  re_exposure?: ArenaSessionReExposureSlice | null;
};

/** Binding layer / POST `/api/arena/choice` — extends session snapshot with run + scenario slice (behavioral engine v1). */
export type ArenaBindingScenarioSlice = {
  source: "json";
  json_scenario_id: string | null;
  db_scenario_id: string | null;
  title: string | null;
};

export type ArenaBindingTriggerSlice = {
  type: string;
  axis: string;
};

export type ArenaBindingPatternSlice = {
  axis: string;
  pattern_family: string;
  direction: "entry" | "exit";
};

export type ArenaBindingReExposureSlice = {
  due: boolean;
  scenario_id: string | null;
};

/** Canonical snapshot returned by POST `/api/arena/choice` (superset of GET session-router fields). */
export type ArenaBindingRuntimeSnapshot = ArenaSessionRouterSnapshot & {
  run_id?: string | null;
  scenario?: ArenaBindingScenarioSlice | null;
  trigger?: ArenaBindingTriggerSlice | null;
  pattern?: ArenaBindingPatternSlice | null;
  re_exposure?: ArenaBindingReExposureSlice | null;
};

export const ARENA_ACTION_BLOCKING_RUNTIME_STATES: readonly ArenaRuntimeStateId[] = [
  "ACTION_REQUIRED",
  "ACTION_SUBMITTED",
  "ACTION_AWAITING_VERIFICATION",
] as const;

export function isArenaActionBlockingRuntimeState(
  s: string | null | undefined,
): s is "ACTION_REQUIRED" | "ACTION_SUBMITTED" | "ACTION_AWAITING_VERIFICATION" {
  return (
    s === "ACTION_REQUIRED" || s === "ACTION_SUBMITTED" || s === "ACTION_AWAITING_VERIFICATION"
  );
}

/**
 * GET `/api/arena/n/session` may return `ok: true` and `scenario: null` while `runtime_state` is a **gate shell**
 * (contract, re-exposure, forced reset, next-ready). Clients must not treat this as catalog miss or apply lobby bootstrap.
 */
export function isArenaServerEntryShellRuntimeState(s: string | null | undefined): boolean {
  if (s == null || s === "") return false;
  return (
    isArenaActionBlockingRuntimeState(s) ||
    s === "FORCED_RESET_PENDING" ||
    s === "REEXPOSURE_DUE" ||
    s === "NEXT_SCENARIO_READY"
  );
}

/**
 * Gate shells that must **fully suspend** normal catalog bootstrap / resume / new-run creation for this tick.
 * (Distinct from {@link isArenaServerEntryShellRuntimeState} which also includes `NEXT_SCENARIO_READY` for merge priority.)
 */
export function isArenaExclusiveGateRuntimeState(s: string | null | undefined): boolean {
  if (s == null || s === "") return false;
  return (
    isArenaActionBlockingRuntimeState(s) ||
    s === "FORCED_RESET_PENDING" ||
    s === "REEXPOSURE_DUE"
  );
}

/**
 * True when the main Arena **in-scenario progression** surface (choices / mid-run post-choice) may render.
 * Only `ARENA_SCENARIO_READY` authorizes that surface. Post-run “next scenario” uses `NEXT_SCENARIO_READY`.
 * When `snapshot` is null (legacy JSON without snapshot), allow if not action-blocking.
 */
export function snapshotAllowsArenaScenarioPlaySurface(
  snapshot: ArenaSessionRouterSnapshot | null | undefined,
  actionBlocking: boolean,
): boolean {
  if (actionBlocking) return false;
  if (snapshot == null) return true;
  const rs = snapshot.runtime_state;
  if (
    rs === "FORCED_RESET_PENDING" ||
    rs === "REEXPOSURE_DUE" ||
    rs === "NEXT_SCENARIO_READY"
  ) {
    return false;
  }
  if (rs === "TRADEOFF_ACTIVE") return true;
  if (rs === "ACTION_DECISION_ACTIVE") return true;
  return rs === "ARENA_SCENARIO_READY";
}
