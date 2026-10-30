import { getScenarioById as getLegacyScenarioById } from "@/lib/bty/scenario/engine";
import { evaluateChoice } from "@/lib/bty/arena/engine";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import {
  arenaRunIdFromUnknown,
  arenaScenarioDescriptionLinesFromUnknown,
  arenaScenarioIdFromUnknown,
} from "@/domain/arena/scenarios";
import { logActionContractActorTrace } from "@/lib/bty/action-contract/arenaRunActor.server";
import {
  accrueNoChangeRisk,
  normalizeScenarioDecisionEventUser,
} from "@/lib/bty/arena/noChangeRisk.server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getScenarioByDbId } from "@/data/scenario";

/**
 * POST /api/arena/event
 * - **400:** `runId_required` | `scenarioId_required` | `eventType_required` | `preview_description_lines_invalid` — domain **`arenaRunIdFromUnknown`** / **`arenaScenarioIdFromUnknown`** · optional **`previewDescriptionLines`** → **`arenaScenarioDescriptionLinesFromUnknown`** (배열 아님·`{}`·`null` 등) · `eventType` 비문자·trim 후 빈 문자열.
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if ("previewDescriptionLines" in body) {
    if (arenaScenarioDescriptionLinesFromUnknown(body.previewDescriptionLines) === null) {
      return NextResponse.json({ error: "preview_description_lines_invalid" }, { status: 400 });
    }
  }

  const runId = arenaRunIdFromUnknown(body?.runId);
  const scenarioId = arenaScenarioIdFromUnknown(body?.scenarioId);
  const step = Number(body?.step ?? 1);
  const eventTypeRaw = body?.eventType;
  const eventType = typeof eventTypeRaw === "string" ? eventTypeRaw.trim() : "";
  const choiceId = body?.choiceId ? String(body.choiceId) : null;
  const followUpIndex = typeof body?.followUpIndex === "number" ? body.followUpIndex : null;
  // Legacy event capture never accepts a client-authored reward. Canonical
  // primary choices use /arena/choice; the remaining legacy catalog is bundled.
  let xp = 0;
  let deltas: ReturnType<typeof evaluateChoice>["deltas"] | null = null;

  let meta = body?.meta ?? null;

  if (!runId) return NextResponse.json({ error: "runId_required" }, { status: 400 });
  if (!scenarioId) return NextResponse.json({ error: "scenarioId_required" }, { status: 400 });
  if (!eventType) return NextResponse.json({ error: "eventType_required" }, { status: 400 });

  if (eventType === "CHOICE_CONFIRMED") {
    const scenario = getLegacyScenarioById(scenarioId ?? "");
    const choice = scenario?.choices.find(item => item.choiceId === choiceId);
    if (!scenario || !choice) return NextResponse.json({ error: "INVALID_REWARD_CHOICE" }, { status: 400 });
    const reward = evaluateChoice({ scenarioId: scenario.scenarioId, choiceId: choice.choiceId,
      intent: choice.intent, xpBase: choice.xpBase, difficulty: choice.difficulty, hiddenDelta: choice.hiddenDelta });
    xp = reward.xp;
    deltas = reward.deltas;
  }

  let reExposureDueCandidate = false;
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    const sde = m["scenarioDecisionEvent"];
    const normalized = normalizeScenarioDecisionEventUser(sde, user.id);
    if (normalized) {
      const isActionCommitment = normalized.isActionCommitment === true;
      const nextMeta: Record<string, unknown> = {
        ...m,
        scenarioDecisionEvent: normalized,
        action_contract_candidate: isActionCommitment,
      };
      if (!isActionCommitment && eventType === "JSON_SCENARIO_DECISION_COMPLETED") {
        const mappedScenario = getScenarioByDbId(normalized.dbScenarioId ?? "", "en");
        if (!mappedScenario) {
          return NextResponse.json(
            { error: "action_decision_scenario_binding_unresolved" },
            { status: 422 },
          );
        }
        const eventForAccrual = {
          ...normalized,
          incidentId: mappedScenario.incidentId,
          axisGroup: mappedScenario.axisGroup,
          axisIndex: mappedScenario.axisIndex,
        };
        const risk = await accrueNoChangeRisk(supabase, eventForAccrual);
        reExposureDueCandidate = risk.reExposureDueCandidate;
        nextMeta.no_change_risk_accrued = true;
        nextMeta.no_change_risk_count = risk.riskCount;
        nextMeta.re_exposure_due_candidate = risk.reExposureDueCandidate;
        nextMeta.intervention_sensitivity_candidate = risk.interventionSensitivityCandidate;
      }
      meta = nextMeta;
    }
  }

  const { data: runActor, error: runActorErr } = await supabase
    .from("arena_runs")
    .select("user_id, scenario_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runActorErr || !runActor) {
    return NextResponse.json({ error: "run_not_found_or_forbidden" }, { status: 404 });
  }

  if (eventType === "CHOICE_CONFIRMED" && (runActor as { scenario_id?: string }).scenario_id !== scenarioId) {
    return NextResponse.json({ error: "RUN_SCENARIO_MISMATCH" }, { status: 409 });
  }
  const xpWriter = xp > 0 ? getSupabaseAdmin() : null;
  if (xp > 0 && !xpWriter) return NextResponse.json({ error: "XP_WRITER_UNAVAILABLE" }, { status: 503 });
  const runOwner = String((runActor as { user_id: string }).user_id);
  logActionContractActorTrace("arena_event_choice", {
    incoming_actor_user_id: user.id,
    source_run_id: runId,
    resolved_run_owner_user_id: runOwner,
    resolved_auth_user_id: user.id,
  });

  const { error } = await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step,
    event_type: eventType,
    scenario_id: scenarioId,
    choice_id: choiceId,
    follow_up_index: followUpIndex,
    xp,
    deltas,
    meta,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (step >= 2) {
    const nowIso = new Date().toISOString();
    const { data: runRow } = await supabase
      .from("arena_runs")
      .select("reached_step_2_at")
      .eq("run_id", runId)
      .eq("user_id", user.id)
      .maybeSingle();
    const reached = (runRow as { reached_step_2_at?: string | null } | null)?.reached_step_2_at;
    await supabase
      .from("arena_runs")
      .update({
        current_step: step,
        ...(reached == null || String(reached).trim() === ""
          ? { reached_step_2_at: nowIso }
          : {}),
      })
      .eq("run_id", runId)
      .eq("user_id", user.id);
  }

  if (xp > 0) {
    const { error: rewardError } = await xpWriter!.rpc("increment_arena_xp", {
      p_user_id: user.id,
      p_run_id: runId,
      p_xp: xp,
    });
    if (rewardError) return NextResponse.json({ error: "XP_AWARD_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reExposureDueCandidate });
}
