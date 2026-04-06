import type { SupabaseClient } from "@supabase/supabase-js";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { ScenarioSelectionError, type ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { fetchBlockingArenaContractForSession } from "@/lib/bty/arena/blockingArenaActionContract";

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

    if (blocking) {
      return {
        status: 409,
        body: {
          error: "action_contract_pending",
          contract: {
            id: blocking.id,
            action_text: blocking.contract_description,
            deadline_at: blocking.deadline_at,
            verification_type: blocking.verification_mode,
            created_at: blocking.created_at,
          },
        },
      };
    }

    void supabase
      .from("bty_action_contracts")
      .update({ status: "missed" })
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("deadline_at", new Date().toISOString());

    const servedIds = await supabase
      .from("arena_runs")
      .select("scenario_id")
      .eq("user_id", userId)
      .eq("status", "DONE")
      .then((r) => r.data?.map((x) => x.scenario_id).filter((id): id is string => typeof id === "string") ?? []);

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
    return {
      status: 200,
      body: {
        ok: true,
        scenario: routed.scenario,
        scenarioRoute: routed.route,
        delayedOutcomePending: routed.delayedOutcomePending,
        ...(routed.recallPrompt ? { recallPrompt: routed.recallPrompt } : {}),
        ...(routed.route === "mirror" && routed.mirrors ? { mirrors: routed.mirrors } : {}),
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
