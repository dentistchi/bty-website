import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGE_4 } from "@/domain/leadership-engine/stages";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { ScenarioSelectionError, type ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { fetchBlockingArenaContractForSession } from "@/lib/bty/arena/blockingArenaActionContract";
import { fetchRecentServedScenarioIds } from "@/lib/bty/arena/fetchRecentServedScenarioIds";
import {
  scenarioWithJsonSource,
  snapshotForBlockedContract,
  snapshotForForcedResetPending,
  snapshotForReexposureDue,
  snapshotForScenarioReady,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.server";
import { getLeadershipEngineState } from "@/lib/bty/leadership-engine/state-service";
import { fetchFirstDueNoChangeReexposureMeta } from "@/engine/scenario/delayed-outcome-trigger.service";
import { consumeDueDelayedOutcomeTriggersForUser } from "@/engine/memory/delayed-outcome-consumer.service";

export type ArenaSessionNextCoreResult =
  | { status: 200; body: Record<string, unknown> }
  | { status: 403; body: Record<string, unknown> }
  | { status: 404; body: Record<string, unknown> }
  | { status: 409; body: Record<string, unknown> }
  | { status: 500; body: Record<string, unknown> }
  | { status: 503; body: Record<string, unknown> };

/**
 * Shared scenario-router body for Pipeline L (`/api/arena/session/next`) and Pipeline N (`/api/arena/n/session`).
 */
export async function runArenaSessionNextCore(params: {
  userId: string;
  locale: ScenarioLocalePreference;
  supabase: SupabaseClient;
  runIdParam: string | null;
  logHandlerLabel: "GET /api/arena/session/next" | "GET /api/arena/n/session";
}): Promise<ArenaSessionNextCoreResult> {
  const { userId, locale, supabase, runIdParam, logHandlerLabel } = params;

  try {
    const blocking = await fetchBlockingArenaContractForSession(supabase, userId);

    console.log("[arena] entrypoint resolution", {
      handler: logHandlerLabel,
      pipeline: blocking ? "blocked_by_open_contract" : "scenario_select",
      userId,
      runId: runIdParam,
    });

    const blockingStatus = typeof blocking?.status === "string" ? blocking.status.trim().toLowerCase() : null;
    // MVP-FIX-ACTION-DEMO-01 (B-2): the blocking-fetch (B-1) now returns any
    // unresolved Action status. Gate 409 on all of them so submitted /
    // rejected / escalated also block next-scenario progression, not only
    // pending. The mapper (runtimeStateFromBlockingContract) maps these to
    // ACTION_REQUIRED / ACTION_SUBMITTED, which the resolve surface and
    // middleware Pipeline-N gate already handle.
    const BLOCKING_STATUSES = ["pending", "submitted", "rejected", "escalated"] as const;
    if (blocking && blockingStatus != null && BLOCKING_STATUSES.includes(blockingStatus as typeof BLOCKING_STATUSES[number])) {
      const snap = snapshotForBlockedContract(blocking);
      return {
        status: 409,
        body: {
          error: "action_contract_pending",
          contract: {
            id: blocking.id,
            action_text: blocking.contract_description,
            deadline_at: blocking.deadline_at,
            // STAB-03-A-P1: sourced from canonical verification_type column.
            // Legacy verification_mode column held 'hybrid' for CHECK workaround
            // (admits qr/link/hybrid only); verification_type column holds the
            // demo-fix value 'self_attest' (admits qr/link/hybrid/self_attest/...).
            // Per MVP-FIX-ACTION-DEMO-03 (A') commits 86ba195d / b2c0ca5a / c727284a.
            verification_type: blocking.verification_type,
            created_at: blocking.created_at,
            verified_at: blocking.verified_at ?? null,
          },
          ...snap,
          scenario: null,
        },
      };
    }
    if (blocking && (blockingStatus == null || !BLOCKING_STATUSES.includes(blockingStatus as typeof BLOCKING_STATUSES[number]))) {
      console.warn("[arena] ignoring non-blocking row returned by blocking-fetch", {
        userId,
        status: blocking.status,
        contractId: blocking.id,
      });
    }

    void supabase
      .from("bty_action_contracts")
      .update({ status: "missed" })
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("deadline_at", new Date().toISOString());

    /** Detectable from `leadership_engine_state` — Arena play deferred until Center integrity reset completes. */
    try {
      const le = await getLeadershipEngineState(supabase, userId);
      if (le.currentStage === STAGE_4 && le.forcedResetTriggeredAt != null) {
        const frSnap = snapshotForForcedResetPending();
        return {
          status: 200,
          body: {
            ok: true,
            ...frSnap,
            scenario: null,
            scenarioRoute: null,
          },
        };
      }
    } catch (e) {
      console.warn("[arena] session-router leadership_engine_state read failed", {
        userId,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    const servedIds = await fetchRecentServedScenarioIds(supabase, userId);

    /**
     * NEXT_SCENARIO_READY (GET) — not emitted here.
     *
     * POST /api/arena/run/complete returns {@link snapshotForNextScenarioReady} for transient UI until the client
     * refetches session. This GET handler always runs {@link getNextScenarioForSession} synchronously; on success it
     * materializes the next scenario and returns {@link snapshotForScenarioReady} (ARENA_SCENARIO_READY) or
     * {@link snapshotForReexposureDue}. There is no persisted “completed run, next GET not yet consumed” row — so a
     * distinct NEXT_SCENARIO_READY on GET would require new persisted source of truth (e.g. explicit pending-next flag
     * with defined consumption semantics). Do not infer it from DONE runs alone (would duplicate ARENA_SCENARIO_READY).
     */
    const routed = await getNextScenarioForSession(userId, locale, {
      servedArenaScenarioIds: servedIds,
    });
    if (routed === null) {
      return {
        status: 403,
        body: {
          ok: false,
          error: "Arena access suspended until Center requirements are met.",
          code: "user_ejected_from_arena" as const,
        },
      };
    }
    const consumedDelayedOutcomeTriggers = await consumeDueDelayedOutcomeTriggersForUser({
      userId,
      supabase,
    });
    const noChangeReexposureMeta = await fetchFirstDueNoChangeReexposureMeta(supabase, userId);
    const reexposureShellActive =
      noChangeReexposureMeta?.pendingOutcomeId != null &&
      String(noChangeReexposureMeta.pendingOutcomeId).trim() !== "";
    const firstConsumedTrigger = consumedDelayedOutcomeTriggers.triggers[0] ?? null;

    const reExposureMeta = reexposureShellActive ? noChangeReexposureMeta : null;
    const readySnap = reexposureShellActive ? snapshotForReexposureDue() : snapshotForScenarioReady();
    /**
     * While `REEXPOSURE_DUE` is active, do not attach a normal “next catalog” scenario — avoids mixed semantics
     * (snapshot blocks play but body still carried a playable next scenario). Re-exposure play uses
     * `GET /api/arena/re-exposure/[scenarioId]` after {@link fetchFirstDueNoChangeReexposureMeta} identifies the source row.
     */
    const isDevOrStaging =
      process.env.NODE_ENV !== "production" || process.env.BTY_ENV?.trim().toLowerCase() === "staging";

    return {
      status: 200,
      body: {
        ok: true,
        ...readySnap,
        ...(reexposureShellActive
          ? {
              re_exposure: {
                due: true,
                scenario_id: reExposureMeta?.scenarioId ?? null,
                pending_outcome_id: reExposureMeta?.pendingOutcomeId ?? null,
                ...(firstConsumedTrigger
                  ? {
                      trigger_id: firstConsumedTrigger.triggerId,
                      trigger_payload: firstConsumedTrigger.payload,
                    }
                  : {}),
              },
              scenario: null,
              scenarioRoute: null,
            }
          : {
              scenario: scenarioWithJsonSource(routed.scenario),
              scenarioRoute: routed.route,
              ...(routed.recallPrompt ? { recallPrompt: routed.recallPrompt } : {}),
              ...(routed.route === "mirror" && routed.mirrors ? { mirrors: routed.mirrors } : {}),
              ...(isDevOrStaging && routed._selectorDebug
                ? {
                    _selectorDebug: {
                      scenarioRoute: routed.route,
                      selectedScenarioId: routed._selectorDebug.selectedScenarioId ?? null,
                      reason: routed._selectorDebug.reason ?? null,
                      skippedPlayedIds: routed._selectorDebug.skippedPlayedIds ?? [],
                      playedCount: routed._selectorDebug.playedCount ?? 0,
                      servedCount: routed._selectorDebug.servedCount ?? 0,
                      candidatePoolSize: routed._selectorDebug.candidatePoolSize ?? null,
                    },
                  }
                : {}),
            }),
        delayedOutcomePending: reexposureShellActive,
      },
    };
  } catch (e) {
    if (e instanceof ScenarioSelectionError && e.code === "user_ejected_from_arena") {
      return { status: 403, body: { ok: false, error: e.message, code: e.code } };
    }
    if (e instanceof ScenarioSelectionError && e.code === "no_scenario_available") {
      return {
        status: 404,
        body: { ok: false, reason: "no_scenario_available", error: e.message, code: e.code },
      };
    }
    if (e instanceof ScenarioSelectionError && e.code === "catalog_unavailable") {
      console.error("[arena] session router catalog_unavailable", e.message);
      return {
        status: 503,
        body: { ok: false, error: e.message, code: e.code, reason: "catalog_unavailable" },
      };
    }
    if (e instanceof ScenarioSelectionError && e.code === "scenario_payload_missing") {
      console.error("[arena] session router scenario_payload_missing", e.message);
      return {
        status: 503,
        body: { ok: false, error: e.message, code: e.code, reason: "scenario_payload_missing" },
      };
    }
    const msg = e instanceof Error ? e.message : "selection_failed";
    return { status: 500, body: { ok: false, error: msg } };
  }
}
