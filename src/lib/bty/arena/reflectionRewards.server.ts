import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatternShiftBand, ValidationResultOrigin } from "@/domain/leadership-engine/patternShift";
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
  // Atomic weekly_xp increment (UPSERT) — prevents read-modify-write lost writes.
  // This path is always the global pool (league_id IS NULL). Shared by
  // applyArenaRunRewardsOnVerifiedCompletion (main QR-verified completion) and
  // applyReexposureOutcomeReflection.
  const { error } = await supabase.rpc("increment_weekly_xp", {
    p_user_id: userId,
    p_league_id: null,
    p_delta: delta,
  });
  if (error) return { ok: false, error: error.message };
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

  // STAB-02-P1: Arena run reward → core_xp_ledger audit row.
  // applyDirectCoreXp updates arena_profiles.core_xp_total but does not
  // write core_xp_ledger. The Arena-side ledger row is inserted here at
  // the caller so applyDirectCoreXp stays untouched (Lab path also calls
  // applyDirectCoreXp via awardLabXP and already writes its own ledger
  // row at lab-xp.service.ts:77; confining the insert here avoids any
  // double-insert across the two callers). Idempotency is enforced by
  // the partial unique index core_xp_ledger_user_source_uq
  // (user_id, source_type, source_id) — retries surface Postgres
  // error code 23505 which is treated as benign (ON CONFLICT DO NOTHING
  // semantics). arena_profiles.core_xp_total remains the authoritative
  // lifetime total; the ledger is audit-only, so a non-23505 failure
  // is logged but not thrown — the user's XP state is already correct.
  if (arenaCoreXp > 0) {
    const { error: ledgerErr } = await supabase.from("core_xp_ledger").insert({
      user_id: userId,
      delta_xp: arenaCoreXp,
      source_type: "ARENA",
      source_id: run.run_id,
    });
    if (ledgerErr && ledgerErr.code !== "23505") {
      console.warn("[reflectionRewards] core_xp_ledger insert non-fatal failure", {
        userId,
        runId: run.run_id,
        code: ledgerErr.code,
        message: ledgerErr.message,
      });
    }
  }

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
  validationResult: PatternShiftBand;
  /** Provenance of `validationResult` — see {@link ValidationResultOrigin}. */
  resultOrigin: ValidationResultOrigin;
}): Promise<RewardApplyResult> {
  const { supabase, userId, runId, scenarioId, validationResult, resultOrigin } = params;

  const profileByOutcome: Record<
    PatternShiftBand,
    { coreXp: number; weeklyXp: number; verified: boolean }
  > = {
    changed: { coreXp: 12, weeklyXp: 8, verified: true },
    unstable: { coreXp: 5, weeklyXp: 3, verified: true },
    no_change: { coreXp: 0, weeklyXp: 1, verified: false },
  };
  // Insufficient-signal (fallback) results are not measured behaviour evidence:
  // no validation XP, not a verified outcome. The validation event is still logged
  // (le_activation_log / le_verification_log / arena_events) for traceability, but
  // with verified=false and xp=0. Computed bands keep their reward profile.
  const outcome =
    resultOrigin === "insufficient_signal"
      ? { coreXp: 0, weeklyXp: 0, verified: false }
      : profileByOutcome[validationResult];

  if (outcome.weeklyXp > 0) {
    const weekly = await upsertWeeklyXp(supabase, userId, outcome.weeklyXp);
    if (!weekly.ok) return weekly;
  }
  if (outcome.coreXp > 0) {
    const core = await applyDirectCoreXp(supabase, userId, outcome.coreXp);
    if ("error" in core) return { ok: false, error: core.error };
  }

  const nowIso = new Date().toISOString();
  // §5.3: tag the activation with result_origin at insert time so a fallback
  // (insufficient_signal) is distinguishable from a genuine computed micro_win.
  const { data: activation, error: actErr } = await supabase
    .from("le_activation_log")
    .insert({
      user_id: userId,
      session_id: runId,
      type: "micro_win",
      result_origin: resultOrigin,
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
  /**
   * Contract this verification reflects. When present, the final `le_verification_log`
   * row is written with the canonical method-INDEPENDENT identity
   * (`event_kind='ACTION_CONTRACT_VERIFIED'`, partial-unique on `contract_id`) so QR
   * verification and Host-Approve verification collapse into ONE AIR evidence row per
   * contract. A duplicate (either method, or a retry) hits 23505 and is a benign no-op.
   */
  contractId?: string | null;
  /** Verify method stored as METADATA only — never the idempotency identity. */
  method?: string | null;
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
    contractId,
    method,
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

  const trimmedContractId =
    typeof contractId === "string" && contractId.trim() !== "" ? contractId.trim() : null;
  const verificationRow: Record<string, unknown> = {
    activation_id: activationId,
    user_id: userId,
    verifier_role: "system",
    verified: true,
    method:
      typeof method === "string" && method.trim() !== ""
        ? method.trim()
        : "qr_contract_verification",
    verified_at: verifiedAtIso,
  };
  if (trimmedContractId) {
    // Canonical method-independent AIR identity — one final verification evidence row
    // per contract regardless of verify method. QR and Host Approve collapse here.
    verificationRow.contract_id = trimmedContractId;
    verificationRow.event_kind = "ACTION_CONTRACT_VERIFIED";
  }

  const { error: verErr } = await supabase
    .from("le_verification_log")
    .insert(verificationRow);
  if (verErr) {
    // Already reflected (QR/Approve race or retry): benign, do not double-count AIR.
    if ((verErr as { code?: string }).code === "23505") return { ok: true };
    return { ok: false, error: verErr.message };
  }
  return { ok: true };
}
