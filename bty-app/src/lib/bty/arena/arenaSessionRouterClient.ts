import type { Scenario } from "@/lib/bty/scenario/types";
import type { ArenaRecallPrompt } from "@/lib/bty/arena/memoryRecallPrompt.types";
import { getArenaSessionRouterPath, type ArenaPipelineDefault } from "@/lib/bty/arena/arenaPipelineConfig";
import {
  ARENA_SESSION_MODE,
  isArenaServerEntryShellRuntimeState,
  type ArenaRuntimeStateId,
  type ArenaSessionRouterSnapshot,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

/** Client: align local session state to `ARENA_SCENARIO_READY` after re-exposure load (server truth on next GET). */
export function arenaSessionRouterSnapshotScenarioReady(): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: "ARENA_SCENARIO_READY",
    state_priority: 10,
    gates: { next_allowed: true, choice_allowed: true, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

/**
 * Contract payload from GET session router 409 `{ error: "action_contract_pending", contract: {...} }`
 * (`arenaSessionNextCore` — same for legacy `session/next` and Pipeline N `n/session`).
 */
export type ArenaPendingContractPayload = {
  id: string;
  action_text: string;
  deadline_at: string;
  verification_type: string;
  created_at: string;
};

export type ArenaSessionRouterPack =
  | {
      outcome: "scenario";
      scenario: Scenario;
      recallPrompt: ArenaRecallPrompt | null;
      snapshot: ArenaSessionRouterSnapshot;
    }
  | {
      outcome: "reexposure";
      snapshot: ArenaSessionRouterSnapshot;
      delayedOutcomePending: boolean;
    }
  /** 200 + `scenario: null` + gate `runtime_state` — never `empty` / never catalog bootstrap. */
  | { outcome: "session_shell"; snapshot: ArenaSessionRouterSnapshot }
  | { outcome: "blocked"; contract: ArenaPendingContractPayload; snapshot: ArenaSessionRouterSnapshot }
  | { outcome: "empty" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object";
}

function parsePendingContract(body: Record<string, unknown>): ArenaPendingContractPayload | null {
  const c = body.contract;
  if (!isRecord(c)) return null;
  const id = typeof c.id === "string" ? c.id : "";
  const action_text = typeof c.action_text === "string" ? c.action_text : "";
  const deadline_at = typeof c.deadline_at === "string" ? c.deadline_at : "";
  const verification_type = typeof c.verification_type === "string" ? c.verification_type : "";
  const created_at = typeof c.created_at === "string" ? c.created_at : "";
  if (!id || !action_text) return null;
  return { id, action_text, deadline_at, verification_type, created_at };
}

const RUNTIME_STATES: readonly ArenaRuntimeStateId[] = [
  "ACTION_REQUIRED",
  "ACTION_SUBMITTED",
  "ACTION_AWAITING_VERIFICATION",
  "ARENA_SCENARIO_READY",
  "TRADEOFF_ACTIVE",
  "ACTION_DECISION_ACTIVE",
  "NEXT_SCENARIO_READY",
  "FORCED_RESET_PENDING",
  "REEXPOSURE_DUE",
] as const;

function isRuntimeState(s: string): s is ArenaRuntimeStateId {
  return (RUNTIME_STATES as readonly string[]).includes(s);
}

/** Parse flat session-router snapshot fields from any JSON object (GET 200/409, POST run/complete, …). */
export function parseArenaSessionRouterSnapshotFromJson(
  body: Record<string, unknown>,
): ArenaSessionRouterSnapshot | null {
  if (body.mode !== ARENA_SESSION_MODE) return null;
  const rs = body.runtime_state;
  if (typeof rs !== "string" || !isRuntimeState(rs)) return null;
  const sp = body.state_priority;
  if (typeof sp !== "number" || !Number.isFinite(sp)) return null;
  const gates = body.gates;
  if (!isRecord(gates)) return null;
  const na = gates.next_allowed;
  const ca = gates.choice_allowed;
  const qa = gates.qr_allowed;
  if (typeof na !== "boolean" || typeof ca !== "boolean" || typeof qa !== "boolean") return null;
  const ac = body.action_contract;
  if (!isRecord(ac)) return null;
  const exists = ac.exists;
  if (typeof exists !== "boolean") return null;
  const id = ac.id;
  const status = ac.status;
  const verification_type = ac.verification_type;
  const deadline_at = ac.deadline_at;
  if (id != null && typeof id !== "string") return null;
  if (status != null && typeof status !== "string") return null;
  if (verification_type != null && typeof verification_type !== "string") return null;
  if (deadline_at != null && typeof deadline_at !== "string") return null;
  const base: ArenaSessionRouterSnapshot = {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: sp,
    gates: { next_allowed: na, choice_allowed: ca, qr_allowed: qa },
    action_contract: {
      exists,
      id: id ?? null,
      status: status ?? null,
      verification_type: verification_type ?? null,
      deadline_at: deadline_at ?? null,
    },
  };
  const reRaw = body.re_exposure;
  if (reRaw != null && typeof reRaw === "object" && !Array.isArray(reRaw)) {
    const r = reRaw as Record<string, unknown>;
    if (typeof r.due === "boolean") {
      const scenario_id =
        typeof r.scenario_id === "string"
          ? r.scenario_id
          : r.scenario_id === null
            ? null
            : typeof r.scenarioId === "string"
              ? r.scenarioId
              : r.scenarioId === null
                ? null
                : null;
      const pending_outcome_id =
        typeof r.pending_outcome_id === "string"
          ? r.pending_outcome_id
          : typeof r.pendingOutcomeId === "string"
            ? r.pendingOutcomeId
            : undefined;
      return {
        ...base,
        re_exposure: {
          due: r.due,
          scenario_id,
          ...(pending_outcome_id ? { pending_outcome_id } : {}),
        },
      };
    }
  }
  return base;
}

/**
 * When GET body is server-authoritative re-exposure, build a routable snapshot (parse if possible, else minimal).
 * Used only after raw-body classification — never fall through to `empty` / `scenario` for the same response.
 */
export function minimalReexposureSnapshotFromBody(body: Record<string, unknown>): ArenaSessionRouterSnapshot {
  const parsed = parseArenaSessionRouterSnapshotFromJson(body);
  if (parsed?.runtime_state === "REEXPOSURE_DUE") return parsed;
  const reRaw = body.re_exposure;
  let re: NonNullable<ArenaSessionRouterSnapshot["re_exposure"]> | undefined;
  if (reRaw != null && typeof reRaw === "object" && !Array.isArray(reRaw)) {
    const r = reRaw as Record<string, unknown>;
    if (typeof r.due === "boolean") {
      const scenario_id =
        typeof r.scenario_id === "string"
          ? r.scenario_id
          : r.scenario_id === null
            ? null
            : typeof r.scenarioId === "string"
              ? r.scenarioId
              : r.scenarioId === null
                ? null
                : null;
      const pending_outcome_id =
        typeof r.pending_outcome_id === "string"
          ? r.pending_outcome_id
          : typeof r.pendingOutcomeId === "string"
            ? r.pendingOutcomeId
            : undefined;
      re = {
        due: r.due,
        scenario_id,
        ...(pending_outcome_id ? { pending_outcome_id } : {}),
      };
    }
  }
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: "REEXPOSURE_DUE",
    state_priority: 55,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
    ...(re ? { re_exposure: re } : {}),
  };
}

function fallbackSnapshotScenarioReady(): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: "ARENA_SCENARIO_READY",
    state_priority: 10,
    gates: { next_allowed: true, choice_allowed: true, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

/**
 * True when this pack must show the re-exposure shell — never catalog bootstrap / applyCanonicalLobby.
 */
export function sessionPackRequiresReexposureGate(pack: ArenaSessionRouterPack): boolean {
  return reexposureSnapshotFromSessionPack(pack) != null;
}

/** Snapshot to store for re-exposure gate + `beginReexposurePlay`, or null if normal play is allowed. */
export function reexposureSnapshotFromSessionPack(pack: ArenaSessionRouterPack): ArenaSessionRouterSnapshot | null {
  if (pack.outcome === "reexposure") return pack.snapshot;
  if (pack.outcome === "session_shell" && pack.snapshot.runtime_state === "REEXPOSURE_DUE") return pack.snapshot;
  if (pack.outcome === "scenario" && pack.snapshot.runtime_state === "REEXPOSURE_DUE") return pack.snapshot;
  return null;
}

function fallbackSnapshotBlocked(): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: "ACTION_REQUIRED",
    state_priority: 90,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
    action_contract: {
      exists: true,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

function minimalForcedResetShellSnapshot(): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: "FORCED_RESET_PENDING",
    state_priority: 60,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

function minimalNextScenarioReadyShellSnapshot(): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: "NEXT_SCENARIO_READY",
    state_priority: 20,
    gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

/**
 * GET session router with full response handling — does not throw on 409.
 * Use this instead of {@link arenaFetch} so `action_contract_pending` body is not lost.
 */
export async function fetchArenaSessionRouterPack(
  locale: "ko" | "en",
  pipelineDefault: ArenaPipelineDefault,
): Promise<ArenaSessionRouterPack> {
  const path = `${getArenaSessionRouterPath(pipelineDefault)}?locale=${locale}`;
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (res.status === 409 && isRecord(data) && data.error === "action_contract_pending") {
    const contract = parsePendingContract(data);
    if (contract) {
      const snap = parseArenaSessionRouterSnapshotFromJson(data) ?? fallbackSnapshotBlocked();
      console.info("[arena][session-router-409-contract]", {
        path,
        contractId: contract.id,
        runtime_state: snap.runtime_state,
      });
      return { outcome: "blocked", contract, snapshot: snap };
    }
  }

  if (!res.ok) {
    return { outcome: "empty" };
  }

  if (!isRecord(data) || data.ok !== true) {
    return { outcome: "empty" };
  }

  /** Raw-body classification BEFORE parse/fallback — avoids `empty` → retry → `scenario` (catalog) overriding REEXPOSURE_DUE. */
  const rsRaw = data.runtime_state;
  const reSlice = data.re_exposure;
  const reDue =
    isRecord(reSlice) && typeof (reSlice as Record<string, unknown>).due === "boolean"
      ? (reSlice as Record<string, unknown>).due === true
      : false;
  const isReexposureBody =
    rsRaw === "REEXPOSURE_DUE" ||
    (data.delayedOutcomePending === true && data.scenario == null) ||
    (reDue && data.scenario == null);
  if (isReexposureBody) {
    return {
      outcome: "reexposure",
      snapshot: minimalReexposureSnapshotFromBody(data),
      delayedOutcomePending: data.delayedOutcomePending === true,
    };
  }

  const snap = parseArenaSessionRouterSnapshotFromJson(data) ?? fallbackSnapshotScenarioReady();

  if (data.scenario == null) {
    const rsBody = typeof data.runtime_state === "string" ? data.runtime_state : null;
    const rs = rsBody ?? snap.runtime_state;
    if (isArenaServerEntryShellRuntimeState(rs)) {
      const parsedAgain = parseArenaSessionRouterSnapshotFromJson(data);
      const shellSnap =
        parsedAgain ??
        (rs === "REEXPOSURE_DUE"
          ? minimalReexposureSnapshotFromBody(data)
          : rs === "FORCED_RESET_PENDING"
            ? minimalForcedResetShellSnapshot()
            : rs === "NEXT_SCENARIO_READY"
              ? minimalNextScenarioReadyShellSnapshot()
              : fallbackSnapshotBlocked());
      return { outcome: "session_shell", snapshot: shellSnap };
    }
    return { outcome: "empty" };
  }

  return {
    outcome: "scenario",
    scenario: data.scenario as Scenario,
    recallPrompt: (data.recallPrompt as ArenaRecallPrompt | undefined) ?? null,
    snapshot: snap,
  };
}

export type ArenaSessionRouterPackFetcher = (
  locale: "ko" | "en",
  pipelineDefault: ArenaPipelineDefault,
) => Promise<ArenaSessionRouterPack>;

/**
 * Session fetch with bounded retries on transient `empty` responses.
 * **Must** return immediately on `session_shell` (e.g. `ACTION_REQUIRED` + `scenario: null`) — retrying would
 * replace the gate with a catalog `scenario` and create duplicate `IN_PROGRESS` runs.
 *
 * @param fetchPack injectable for tests (same-module `fetchArenaSessionRouterPack` closure cannot be vi-mocked).
 */
export async function fetchArenaSessionRouterPackWithRetryImpl(
  fetchPack: ArenaSessionRouterPackFetcher,
  locale: "ko" | "en",
  pipelineDefault: ArenaPipelineDefault,
  attempts = 3,
): Promise<ArenaSessionRouterPack> {
  let last: ArenaSessionRouterPack = { outcome: "empty" };
  for (let i = 0; i < attempts; i++) {
    last = await fetchPack(locale, pipelineDefault);
    if (last.outcome === "blocked") return last;
    if (last.outcome === "reexposure") return last;
    if (last.outcome === "session_shell") return last;
    if (last.outcome === "scenario") return last;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return last;
}

export function fetchArenaSessionRouterPackWithRetry(
  locale: "ko" | "en",
  pipelineDefault: ArenaPipelineDefault,
  attempts?: number,
): Promise<ArenaSessionRouterPack> {
  return fetchArenaSessionRouterPackWithRetryImpl(fetchArenaSessionRouterPack, locale, pipelineDefault, attempts);
}
