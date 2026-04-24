import { NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import type { EscalationBranch, SecondChoice } from "@/domain/arena/scenarios/types";
import { getArenaScenarioForRunStep } from "@/lib/bty/arena/arenaScenarioForRunStep";
import { ELITE_RUNTIME_COMPAT_VERSION } from "@/lib/bty/arena/eliteRunResumeCompat";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  recordExitSecondChoicePatternSignalV2,
  validateSecondChoicePatternSignalInputV2,
} from "@/lib/bty/pattern-engine/secondChoicePatternSignalV2";

/** Allowed carry-forward from `arena_runs.meta` only — no unbounded JSON copy. */
const ARENA_RUN_META_PROGRESS_KEYS = [
  "elite_runtime_compat",
  "difficulty_level",
  "time_remaining",
  "acknowledged_at",
] as const;

function mergeAllowedArenaRunProgress(prev: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ARENA_RUN_META_PROGRESS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(prev, k) && prev[k] !== undefined) {
      out[k] = prev[k];
    }
  }
  return out;
}

function buildStep3ArenaRunMeta(params: {
  prev: Record<string, unknown>;
  primaryId: string;
  scenarioId: string;
  branch: EscalationBranch;
  acknowledgedAt: string;
  difficultyLevel: number | undefined;
}): Record<string, unknown> {
  const { prev, primaryId, scenarioId, branch, acknowledgedAt, difficultyLevel } = params;
  const m = mergeAllowedArenaRunProgress(prev);
  m.primary_choice_id = primaryId;
  m.escalation_branch_key = primaryId;
  m.escalation_resolved_for_scenario_id = scenarioId;
  m.difficulty_level = difficultyLevel !== undefined ? difficultyLevel : prev["difficulty_level"];
  m.escalation_text = branch.escalation_text;
  m.pressure_increase = branch.pressure_increase;
  m.escalation_acknowledged_at = acknowledgedAt;
  m.elite_runtime_compat = ELITE_RUNTIME_COMPAT_VERSION;
  return m;
}

function buildStep4ArenaRunMeta(params: {
  prev: Record<string, unknown>;
  scenarioId: string;
  branch: EscalationBranch;
  branchKey: string;
  secondId: string;
  difficultyLevel: number | undefined;
}): Record<string, unknown> {
  const { prev, scenarioId, branch, branchKey, secondId, difficultyLevel } = params;
  const m = mergeAllowedArenaRunProgress(prev);
  const primaryFromPrev = prev["primary_choice_id"];
  m.primary_choice_id =
    typeof primaryFromPrev === "string" && primaryFromPrev.trim() !== ""
      ? primaryFromPrev.trim()
      : branchKey;
  m.escalation_branch_key = branchKey;
  m.escalation_resolved_for_scenario_id = scenarioId;
  m.escalation_text = branch.escalation_text;
  m.pressure_increase = branch.pressure_increase;
  m.escalation_acknowledged_at = prev["escalation_acknowledged_at"];
  m.second_choice_id = secondId;
  m.difficulty_level = difficultyLevel !== undefined ? difficultyLevel : prev["difficulty_level"];
  m.elite_runtime_compat = ELITE_RUNTIME_COMPAT_VERSION;
  return m;
}

function secondChoiceToApiPayload(c: SecondChoice): {
  id: string;
  label: string;
  cost: string;
  direction: string;
  pattern_family?: string;
} {
  const row: {
    id: string;
    label: string;
    cost: string;
    direction: string;
    pattern_family?: string;
  } = {
    id: c.id,
    label: c.label,
    cost: c.cost,
    direction: c.direction,
  };
  if (typeof c.pattern_family === "string" && c.pattern_family.trim() !== "") {
    row.pattern_family = c.pattern_family.trim();
  }
  return row;
}

function secondChoicesCostsValid(branch: EscalationBranch): boolean {
  return branch.second_choices.every(
    (c) => typeof c.cost === "string" && c.cost.trim() !== "",
  );
}

/**
 * POST /api/arena/run/step — advance run meta for **step 3** (escalation, no user choice) and **step 4** (second choice).
 *
 * - **Step 3:** Applies `escalationBranches[primaryChoiceId]` from the scenario; writes explicit escalation fields into `arena_runs.meta` (no blind `prevMeta` merge).
 * - **Step 4:** Records `second_choice_id`; response body includes canonical `second_choices` from the scenario branch; v2 pattern signal **only** from `second_choice.direction` / `pattern_family`.
 *
 * @contract
 * - **401** `UNAUTHENTICATED`
 * - **400** `runId_required` | `step_invalid` | `primary_choice_required` | `escalation_not_configured` |
 *   `missing_escalation_branch` | `invalid_second_choice_cost` | `second_choice_required` | `second_choice_unknown` |
 *   `invalid_second_choice_direction` | `missing_pattern_family` | `invalid_pattern_family`
 * - **404** `RUN_NOT_FOUND`
 * - **409** `escalation_meta_scenario_mismatch` — step 4 only; `meta.escalation_resolved_for_scenario_id` ≠ run `scenario_id`
 * - **200 step 3:** `{ ok: true, meta: Record<string, unknown> }`
 * - **200 step 4:** `{ ok: true, step: 4, scenario_id, escalation_branch_key, second_choices, meta: { second_choice_id, difficulty_level, elite_runtime_compat } }`
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
  const rawMeta = (runRow as { meta?: unknown }).meta;
  const prevMeta: Record<string, unknown> =
    rawMeta != null && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? (rawMeta as Record<string, unknown>)
      : {};

  const scenario = getArenaScenarioForRunStep(scenarioId, locale);
  const branches = scenario?.escalationBranches;

  async function resolvePrimaryChoiceId(): Promise<string | null> {
    if (typeof primaryChoiceIdRaw === "string" && primaryChoiceIdRaw.trim() !== "") {
      return primaryChoiceIdRaw.trim();
    }
    const { data: evRows } = await supabase
      .from("arena_events")
      .select("choice_id, scenario_id")
      .eq("run_id", runId)
      .eq("step", 2)
      .eq("event_type", "CHOICE_CONFIRMED")
      .not("choice_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);
    const rows = (evRows ?? []) as Array<{ choice_id?: string | null; scenario_id?: string | null }>;
    const aligned = rows.find((r) => (r.scenario_id ?? "") === scenarioId);
    const pick = aligned ?? rows[0];
    const cid = pick?.choice_id;
    if (typeof cid === "string" && cid.trim() !== "") return cid.trim();

    const fromMeta = prevMeta["primary_choice_id"];
    if (typeof fromMeta === "string" && fromMeta.trim() !== "") return fromMeta.trim();
    return null;
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
    const nextMeta = buildStep3ArenaRunMeta({
      prev: prevMeta,
      primaryId,
      scenarioId,
      branch,
      acknowledgedAt,
      difficultyLevel: dl,
    });

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

  const secondId =
    typeof secondChoiceIdRaw === "string" && secondChoiceIdRaw.trim() !== ""
      ? secondChoiceIdRaw.trim()
      : null;
  if (!secondId) return NextResponse.json({ error: "second_choice_required" }, { status: 400 });

  const resolvedSnap = prevMeta["escalation_resolved_for_scenario_id"];
  if (
    typeof resolvedSnap === "string" &&
    resolvedSnap.trim() !== "" &&
    resolvedSnap !== scenarioId
  ) {
    return NextResponse.json(
      {
        error: "escalation_meta_scenario_mismatch",
        expectedScenarioId: scenarioId,
        metaScenarioId: resolvedSnap,
      },
      { status: 409 },
    );
  }

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
  const nextMeta = buildStep4ArenaRunMeta({
    prev: prevMeta,
    scenarioId,
    branch,
    branchKey,
    secondId,
    difficultyLevel: dl,
  });

  const { error: upErr } = await supabase
    .from("arena_runs")
    .update({ meta: nextMeta, current_step: 4 })
    .eq("run_id", runId)
    .eq("user_id", user.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const eventMeta: Record<string, unknown> = {
    second_choice_id: secondId,
    escalation_branch_key: branchKey,
    direction: picked.direction,
  };
  if (typeof picked.pattern_family === "string" && picked.pattern_family.trim() !== "") {
    eventMeta.pattern_family = picked.pattern_family.trim();
  }

  /**
   * **`SECOND_CHOICE_CONFIRMED`** (here) vs **`BINDING_V1_SECOND`** (`POST /api/arena/choice` with `binding_phase: second`):
   * - **BINDING_V1_SECOND** — JSON↔DB id binding + behavioral snapshot authority; inserted **before** this handler when the client uses the binding layer.
   * - **SECOND_CHOICE_CONFIRMED** — run/step orchestration: `arena_runs.meta`, pattern exit signal, canonical `second_choices` response. **Not** a duplicate binding record; both may exist for the same user action (binding first, then this step).
   */
  await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step: 4,
    event_type: "SECOND_CHOICE_CONFIRMED",
    scenario_id: scenarioId,
    choice_id: secondId,
    meta: eventMeta,
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

  const second_choices = branch.second_choices.map(secondChoiceToApiPayload);

  return NextResponse.json({
    ok: true,
    step: 4,
    scenario_id: scenarioId,
    escalation_branch_key: branchKey,
    second_choices,
    meta: {
      second_choice_id: secondId,
      difficulty_level: dl ?? null,
      elite_runtime_compat: ELITE_RUNTIME_COMPAT_VERSION,
    },
  });
}
