import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { getArenaTodayTotal, capArenaDailyDelta } from "@/lib/bty/arena/activityXp";
import {
  getDifficultyBase,
  computeArenaCoreXp,
  computeArenaWeeklyXp,
  streakFactorFromDays,
  inferDifficultyFromEventSum,
  parseStoredDifficulty,
  timeFactorFromRemaining,
} from "@/lib/bty/arena/arenaLabXp";

type ArenaRunForRewards = {
  run_id: string;
  scenario_id: string | null;
  difficulty?: unknown;
  meta?: { time_remaining?: number; time_limit?: number } | null;
};

type RewardApplyResult =
  | {
      ok: true;
      applied: boolean;
      coreXp: number;
      weeklyXp: number;
      deltaApplied: number;
    }
  | {
      ok: false;
      error: string;
    };

async function upsertWeeklyXp(
  supabase: SupabaseClient,
  userId: string,
  delta: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: rowErr } = await supabase
    .from("weekly_xp")
    .select("id, xp_total")
    .eq("user_id", userId)
    .is("league_id", null)
    .maybeSingle();
  if (rowErr) return { ok: false, error: rowErr.message };

  if (!row) {
    const { error: insErr } = await supabase
      .from("weekly_xp")
      .insert({ user_id: userId, league_id: null, xp_total: delta });
    if (insErr) return { ok: false, error: insErr.message };
    return { ok: true };
  }

  const nextTotal =
    (typeof (row as { xp_total?: number }).xp_total === "number"
      ? (row as { xp_total: number }).xp_total
      : 0) + delta;
  const { error: upErr } = await supabase
    .from("weekly_xp")
    .update({ xp_total: nextTotal })
    .eq("id", (row as { id: string }).id);
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}

export async function applyArenaRunRewardsOnVerifiedCompletion(params: {
  supabase: SupabaseClient;
  userId: string;
  run: ArenaRunForRewards;
}): Promise<RewardApplyResult> {
  const { supabase, userId, run } = params;

  const { data: applied, error: appliedErr } = await supabase
    .from("arena_events")
    .select("event_id")
    .eq("user_id", userId)
    .eq("run_id", run.run_id)
    .eq("event_type", "RUN_COMPLETED_APPLIED")
    .limit(1);
  if (appliedErr) return { ok: false, error: appliedErr.message };
  if ((applied ?? []).length > 0) {
    return { ok: true, applied: false, coreXp: 0, weeklyXp: 0, deltaApplied: 0 };
  }

  const { data: evs, error: evErr } = await supabase
    .from("arena_events")
    .select("xp")
    .eq("user_id", userId)
    .eq("run_id", run.run_id);
  if (evErr) return { ok: false, error: evErr.message };
  const eventSum = (evs ?? []).reduce(
    (sum, row) => sum + (typeof row.xp === "number" ? row.xp : 0),
    0,
  );

  const { data: profileRow, error: profileErr } = await supabase
    .from("arena_profiles")
    .select("streak")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) return { ok: false, error: profileErr.message };

  const streakDays = Math.max(
    0,
    Number((profileRow as { streak?: number } | null)?.streak ?? 0),
  );
  const difficulty =
    parseStoredDifficulty(run.difficulty) ?? inferDifficultyFromEventSum(eventSum);
  const xpBase = getDifficultyBase(difficulty);
  const timeRemaining = run.meta?.time_remaining;
  const timeLimit = run.meta?.time_limit;
  const timeFactor =
    typeof timeRemaining === "number" &&
    typeof timeLimit === "number" &&
    timeLimit > 0
      ? timeFactorFromRemaining(timeRemaining, timeLimit)
      : 0;

  const arenaInput = {
    difficulty,
    xpPrimary: xpBase,
    xpReinforce: 0,
    timeFactor: timeFactor > 0 ? timeFactor : undefined,
    streakFactor: streakFactorFromDays(streakDays),
  };
  const arenaCoreXp = computeArenaCoreXp(arenaInput);
  const arenaWeeklyXp = computeArenaWeeklyXp(arenaInput);

  const todayArenaTotal = await getArenaTodayTotal(supabase, userId);
  const deltaCapped = capArenaDailyDelta(arenaWeeklyXp, todayArenaTotal);

  // Insert sentinel BEFORE XP operations so a partial failure on retry cannot double-apply.
  const { error: markErr } = await supabase.from("arena_events").insert({
    user_id: userId,
    run_id: run.run_id,
    event_type: "RUN_COMPLETED_APPLIED",
    step: 7,
    scenario_id: run.scenario_id ?? "unknown",
    xp: 0,
  });
  if (markErr) return { ok: false, error: markErr.message };

  await supabase.rpc("ensure_arena_profile");
  const weekly = await upsertWeeklyXp(supabase, userId, deltaCapped);
  if (!weekly.ok) return weekly;

  const core = await applyDirectCoreXp(supabase, userId, arenaCoreXp);
  if ("error" in core) return { ok: false, error: core.error };

  return {
    ok: true,
    applied: true,
    coreXp: arenaCoreXp,
    weeklyXp: deltaCapped,
    deltaApplied: deltaCapped,
  };
}

export async function applyReexposureOutcomeReflection(params: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  scenarioId: string;
  validationResult: "changed" | "unstable" | "no_change";
}): Promise<RewardApplyResult> {
  const { supabase, userId, runId, scenarioId, validationResult } = params;

  const profileByOutcome: Record<
    "changed" | "unstable" | "no_change",
    { coreXp: number; weeklyXp: number; verified: boolean }
  > = {
    changed: { coreXp: 12, weeklyXp: 8, verified: true },
    unstable: { coreXp: 5, weeklyXp: 3, verified: true },
    no_change: { coreXp: 0, weeklyXp: 1, verified: false },
  };
  const outcome = profileByOutcome[validationResult];

  if (outcome.weeklyXp > 0) {
    const weekly = await upsertWeeklyXp(supabase, userId, outcome.weeklyXp);
    if (!weekly.ok) return weekly;
  }
  if (outcome.coreXp > 0) {
    const core = await applyDirectCoreXp(supabase, userId, outcome.coreXp);
    if ("error" in core) return { ok: false, error: core.error };
  }

  const nowIso = new Date().toISOString();
  const { data: activation, error: actErr } = await supabase
    .from("le_activation_log")
    .insert({
      user_id: userId,
      session_id: runId,
      type: "micro_win",
      weight: 1.0,
      chosen_at: nowIso,
      due_at: nowIso,
      completed_at: nowIso,
    })
    .select("activation_id")
    .single();
  if (actErr) return { ok: false, error: actErr.message };

  const activationId =
    (activation as { activation_id?: string } | null)?.activation_id ?? null;
  if (!activationId) return { ok: false, error: "activation_id_missing" };

  const { error: verErr } = await supabase.from("le_verification_log").insert({
    activation_id: activationId,
    user_id: userId,
    verifier_role: "system",
    verified: outcome.verified,
    method: "re_exposure_validation",
  });
  if (verErr) return { ok: false, error: verErr.message };

  const { error: evErr } = await supabase.from("arena_events").insert({
    user_id: userId,
    run_id: runId,
    event_type: "REEXPOSURE_VALIDATION_APPLIED",
    step: 7,
    scenario_id: scenarioId,
    xp: outcome.weeklyXp,
  });
  if (evErr) return { ok: false, error: evErr.message };

  return {
    ok: true,
    applied: true,
    coreXp: outcome.coreXp,
    weeklyXp: outcome.weeklyXp,
    deltaApplied: outcome.weeklyXp,
  };
}

export async function reflectContractVerificationToAir(params: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  verifiedAtIso: string;
  activationType?: string | null;
  weight?: number | null;
  chosenAtIso?: string | null;
  dueAtIso?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    supabase,
    userId,
    runId,
    verifiedAtIso,
    activationType,
    weight,
    chosenAtIso,
    dueAtIso,
  } = params;

  const { data: existing, error: existingErr } = await supabase
    .from("le_activation_log")
    .select("activation_id")
    .eq("user_id", userId)
    .eq("session_id", runId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) return { ok: false, error: existingErr.message };

  let activationId =
    (existing as { activation_id?: string } | null)?.activation_id ?? null;
  if (!activationId) {
    const { data: inserted, error: insErr } = await supabase
      .from("le_activation_log")
      .insert({
        user_id: userId,
        session_id: runId,
        type: activationType === "reset" ? "reset" : "micro_win",
        weight: typeof weight === "number" && Number.isFinite(weight) ? weight : 1.0,
        chosen_at: chosenAtIso ?? verifiedAtIso,
        due_at: dueAtIso ?? verifiedAtIso,
        completed_at: verifiedAtIso,
      })
      .select("activation_id")
      .single();
    if (insErr) return { ok: false, error: insErr.message };
    activationId =
      (inserted as { activation_id?: string } | null)?.activation_id ?? null;
  } else {
    await supabase
      .from("le_activation_log")
      .update({ completed_at: verifiedAtIso })
      .eq("activation_id", activationId)
      .eq("user_id", userId);
  }

  if (!activationId) return { ok: false, error: "activation_id_missing" };

  const { error: verErr } = await supabase.from("le_verification_log").insert({
    activation_id: activationId,
    user_id: userId,
    verifier_role: "system",
    verified: true,
    method: "qr_contract_verification",
    verified_at: verifiedAtIso,
  });
  if (verErr) return { ok: false, error: verErr.message };
  return { ok: true };
}
