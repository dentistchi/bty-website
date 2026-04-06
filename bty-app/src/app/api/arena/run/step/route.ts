import { NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import type { EscalationBranch } from "@/domain/arena/scenarios/types";
import { getArenaScenarioForRunStep } from "@/lib/bty/arena/arenaScenarioForRunStep";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  recordExitSecondChoicePatternSignalV2,
  validateSecondChoicePatternSignalInputV2,
} from "@/lib/bty/pattern-engine/secondChoicePatternSignalV2";

function secondChoicesCostsValid(branch: EscalationBranch): boolean {
  return branch.second_choices.every(
    (c) => typeof c.cost === "string" && c.cost.trim() !== "",
  );
}

/**
 * POST /api/arena/run/step — advance run meta for **step 3** (escalation, no user choice) and **step 4** (second choice).
 *
 * - **Step 3:** Applies `escalationBranches[primaryChoiceId]` from the scenario; merges `escalation_text` / tier into `arena_runs.meta`.
 * - **Step 4:** Records `second_choice_id`; v2 pattern signal **only** from `second_choice.direction` / `pattern_family` (exit → tally; entry → no-op).
 *
 * @contract
 * - **401** `UNAUTHENTICATED`
 * - **400** `runId_required` | `step_invalid` | `primary_choice_required` | `escalation_not_configured` |
 *   `missing_escalation_branch` | `invalid_second_choice_cost` | `second_choice_required` | `second_choice_unknown` |
 *   `invalid_second_choice_direction` | `missing_pattern_family` | `invalid_pattern_family`
 * - **404** `RUN_NOT_FOUND`
 * - **200** `{ ok: true, meta: Record<string, unknown> }`
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const runId = arenaRunIdFromUnknown(body?.runId);
  const step = Number(body?.step ?? NaN);
  const primaryChoiceIdRaw = body?.primaryChoiceId ?? body?.primary_choice_id;
  const secondChoiceIdRaw = body?.secondChoiceId ?? body?.second_choice_id;

  if (!runId) return NextResponse.json({ error: "runId_required" }, { status: 400 });
  if (!Number.isFinite(step) || (step !== 3 && step !== 4)) {
    return NextResponse.json({ error: "step_invalid" }, { status: 400 });
  }

  const { data: runRow, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, locale, meta, user_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });
  if (!runRow) return NextResponse.json({ error: "RUN_NOT_FOUND" }, { status: 404 });

  const scenarioId = String((runRow as { scenario_id?: string }).scenario_id ?? "");
  const locale = (runRow as { locale?: string | null }).locale;
  const prevMeta =
    (runRow as { meta?: Record<string, unknown> | null }).meta != null &&
    typeof (runRow as { meta?: unknown }).meta === "object"
      ? ({ ...(runRow as { meta: Record<string, unknown> }).meta } as Record<string, unknown>)
      : {};

  const scenario = getArenaScenarioForRunStep(scenarioId, locale);
  const branches = scenario?.escalationBranches;

  async function resolvePrimaryChoiceId(): Promise<string | null> {
    if (typeof primaryChoiceIdRaw === "string" && primaryChoiceIdRaw.trim() !== "") {
      return primaryChoiceIdRaw.trim();
    }
    const fromMeta = prevMeta["primary_choice_id"];
    if (typeof fromMeta === "string" && fromMeta.trim() !== "") return fromMeta.trim();
    const { data: ev } = await supabase
      .from("arena_events")
      .select("choice_id")
      .eq("run_id", runId)
      .eq("step", 2)
      .not("choice_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cid = (ev as { choice_id?: string | null } | null)?.choice_id;
    return typeof cid === "string" && cid.trim() !== "" ? cid.trim() : null;
  }

  if (step === 3) {
    const primaryId = await resolvePrimaryChoiceId();
    if (!primaryId) return NextResponse.json({ error: "primary_choice_required" }, { status: 400 });
    if (!branches || Object.keys(branches).length === 0) {
      return NextResponse.json({ error: "escalation_not_configured" }, { status: 400 });
    }
    const branch = branches[primaryId] as EscalationBranch | undefined;
    if (!branch) {
      return NextResponse.json(
        { error: "missing_escalation_branch", primaryChoiceId: primaryId },
        { status: 400 },
      );
    }
    if (!Array.isArray(branch.second_choices) || branch.second_choices.length === 0) {
      return NextResponse.json(
        { error: "missing_escalation_branch", primaryChoiceId: primaryId },
        { status: 400 },
      );
    }
    if (!secondChoicesCostsValid(branch)) {
      return NextResponse.json(
        { error: "invalid_second_choice_cost", primaryChoiceId: primaryId },
        { status: 400 },
      );
    }

    console.debug("[arena][run/step]", {
      step: 3,
      scenarioId,
      primaryChoiceId: primaryId,
      escalationBranchKey: primaryId,
      secondChoicesCount: branch.second_choices.length,
    });

    const acknowledgedAt = new Date().toISOString();
    const dl = scenario?.difficulty_level;
    const nextMeta: Record<string, unknown> = {
      ...prevMeta,
      primary_choice_id: primaryId,
      escalation_branch_key: primaryId,
      difficulty_level: dl ?? prevMeta["difficulty_level"],
      escalation_text: branch.escalation_text,
      pressure_increase: branch.pressure_increase,
      escalation_acknowledged_at: acknowledgedAt,
    };

    const { error: upErr } = await supabase
      .from("arena_runs")
      .update({ meta: nextMeta, current_step: 3 })
      .eq("run_id", runId)
      .eq("user_id", user.id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    await supabase.from("arena_events").insert({
      run_id: runId,
      user_id: user.id,
      step: 3,
      event_type: "ESCALATION_APPLIED",
      scenario_id: scenarioId,
      choice_id: null,
      meta: {
        primary_choice_id: primaryId,
        escalation_text: branch.escalation_text,
        pressure_increase: branch.pressure_increase,
        escalation_acknowledged_at: acknowledgedAt,
      },
    });

    return NextResponse.json({ ok: true, meta: nextMeta });
  }

  // step === 4
  const secondId =
    typeof secondChoiceIdRaw === "string" && secondChoiceIdRaw.trim() !== ""
      ? secondChoiceIdRaw.trim()
      : null;
  if (!secondId) return NextResponse.json({ error: "second_choice_required" }, { status: 400 });

  const branchKeyRaw = prevMeta["escalation_branch_key"] ?? prevMeta["primary_choice_id"];
  const branchKey = typeof branchKeyRaw === "string" ? branchKeyRaw.trim() : "";
  if (!branchKey || !branches || Object.keys(branches).length === 0) {
    return NextResponse.json({ error: "escalation_not_configured" }, { status: 400 });
  }
  const branch = branches[branchKey] as EscalationBranch | undefined;
  if (!branch) {
    return NextResponse.json(
      { error: "missing_escalation_branch", escalationBranchKey: branchKey },
      { status: 400 },
    );
  }
  if (!Array.isArray(branch.second_choices) || branch.second_choices.length === 0) {
    return NextResponse.json(
      { error: "missing_escalation_branch", escalationBranchKey: branchKey },
      { status: 400 },
    );
  }
  if (!secondChoicesCostsValid(branch)) {
    return NextResponse.json(
      { error: "invalid_second_choice_cost", escalationBranchKey: branchKey },
      { status: 400 },
    );
  }

  const picked = branch.second_choices.find((c) => c.id === secondId);
  if (!picked) return NextResponse.json({ error: "second_choice_unknown" }, { status: 400 });
  if (typeof picked.cost !== "string" || picked.cost.trim() === "") {
    return NextResponse.json(
      { error: "invalid_second_choice_cost", secondChoiceId: secondId },
      { status: 400 },
    );
  }

  const patternV2Err = validateSecondChoicePatternSignalInputV2(picked);
  if (patternV2Err) {
    return NextResponse.json({ error: patternV2Err }, { status: 400 });
  }

  console.debug("[arena][run/step]", {
    step: 4,
    scenarioId,
    escalationBranchKey: branchKey,
    secondChoicesCount: branch.second_choices.length,
    secondChoiceId: secondId,
  });

  const dl = scenario?.difficulty_level;
  const nextMeta: Record<string, unknown> = {
    ...prevMeta,
    escalation_branch_key: branchKey,
    second_choice_id: secondId,
    difficulty_level: dl ?? prevMeta["difficulty_level"],
  };

  const { error: upErr } = await supabase
    .from("arena_runs")
    .update({ meta: nextMeta, current_step: 4 })
    .eq("run_id", runId)
    .eq("user_id", user.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step: 4,
    event_type: "SECOND_CHOICE_CONFIRMED",
    scenario_id: scenarioId,
    choice_id: secondId,
    meta: {
      second_choice_id: secondId,
      escalation_branch_key: branchKey,
      direction: picked.direction,
      ...(picked.pattern_family?.trim()
        ? { pattern_family: picked.pattern_family.trim() }
        : {}),
    },
  });

  if (picked.direction === "entry") {
    console.log("[pattern_signal v2 second_choice]", {
      second_choice_id: secondId,
      direction: "entry",
      action: "no_op",
    });
  } else {
    const rec = await recordExitSecondChoicePatternSignalV2(supabase, {
      runId,
      userId: user.id,
      second_choice_id: secondId,
      patternFamilyRaw: picked.pattern_family!.trim(),
    });
    if (!rec.ok) {
      return NextResponse.json({ error: rec.error }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, meta: nextMeta });
}
