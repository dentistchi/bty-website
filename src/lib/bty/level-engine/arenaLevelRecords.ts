import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStoredDifficulty, type DifficultyKey } from "@/lib/bty/arena/arenaLabXp";

/** ENGINE §5 rule 8 — hours after any band change before next evaluation. */
export const LEVEL_BAND_COOLDOWN_MS = 72 * 60 * 60 * 1000;

/** ENGINE §5 rule 6 — consecutive complete_verified runs at band required before increase. */
export const LEVEL_INCREASE_CONSECUTIVE_THRESHOLD = 3;

/** `DIFFICULTY_LEVEL_MODEL_V1` §4 — last N scenario starts at band for 2-in-N abandon rule. */
export const LEVEL_DECREASE_ABANDON_WINDOW_STARTS = 5;

/** Level decrease when this many abandons appear in the window, or consecutive abandons reach this. */
export const LEVEL_DECREASE_ABANDON_THRESHOLD = 2;

const BAND_ORDER = ["easy", "mid", "hard", "extreme"] as const;

function prevBandDown(current: string): DifficultyKey {
  const i = BAND_ORDER.indexOf(current as (typeof BAND_ORDER)[number]);
  if (i <= 0) return BAND_ORDER[0]!;
  return BAND_ORDER[i - 1]!;
}

function bandForRunDifficulty(difficulty: unknown): DifficultyKey {
  return parseStoredDifficulty(difficulty) ?? "mid";
}

type ArenaRunRow = {
  run_id?: string;
  started_at?: string;
  status?: string;
  difficulty?: unknown;
  completion_state?: string | null;
};

function isTerminalRunRow(r: ArenaRunRow): boolean {
  if (r.completion_state === "locked_step7_abandoned") return true;
  if (r.status === "DONE" && r.completion_state === "complete_verified") return true;
  return false;
}

export async function ensureArenaLevelRecord(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: ex, error: selErr } = await admin
    .from("arena_level_records")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };
  if (ex) return { ok: true };
  const { error: insErr } = await admin.from("arena_level_records").insert({
    user_id: userId,
    updated_at: new Date().toISOString(),
  });
  if (insErr && !String(insErr.message).includes("duplicate")) {
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}

/**
 * After a run reaches `complete_verified` + contract `approved` with `verified_at` (caller must enforce).
 *
 * IDEMPOTENT PER RUN (Slice 3.1B-3N-5C, Option 2). The atomic sentinel claim
 * (`arena_events` RUN_LEVEL_VERIFIED_APPLIED, partial-unique on `(user_id, run_id)`)
 * and the `consecutive_verified_completions` increment + band evaluation run inside
 * ONE database transaction via `bty_apply_run_level_verified`. A second call for the
 * same `(user_id, run_id)` — from a QR vs Host-Approve race, or a retry — applies NO
 * increment. `runId` is REQUIRED: it is the per-run idempotency key. Callers: the QR
 * verify route, the legacy self-attest submit path, and the Host Approve route — each
 * only after they actually WON the contract `verified_at` transition.
 */
export async function onArenaRunCompleteVerified(
  admin: SupabaseClient,
  userId: string,
  runId: string,
): Promise<{ ok: boolean; error?: string; bandChanged?: boolean; applied?: boolean }> {
  const trimmedRun = typeof runId === "string" ? runId.trim() : "";
  if (!trimmedRun) {
    return { ok: false, error: "run_level_run_missing" };
  }

  const { data, error } = await admin.rpc("bty_apply_run_level_verified", {
    p_user_id: userId,
    p_run_id: trimmedRun,
  });
  if (error) return { ok: false, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { applied?: boolean; band_changed?: boolean }
    | null;
  return {
    ok: true,
    applied: Boolean(row?.applied),
    bandChanged: Boolean(row?.band_changed),
  };
}

/**
 * ENGINE §5 rule 6 — break consecutive count (e.g. locked_step7_abandoned or abandoned in_progress policy).
 */
export async function resetConsecutiveVerifiedCompletions(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin
    .from("arena_level_records")
    .update({
      consecutive_verified_completions: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * After `arena_runs` is updated to `locked_step7_abandoned` for the run:
 * resets consecutive verified streak; updates abandon counters; may apply level decrease (ENGINE §5 rules 6–8).
 */
export async function applyStep7AbandonLevelEffects(
  admin: SupabaseClient,
  userId: string,
  abandonedRunId: string,
): Promise<{ ok: boolean; bandDecreased?: boolean; error?: string }> {
  const resetStreak = await resetConsecutiveVerifiedCompletions(admin, userId);
  if (!resetStreak.ok) return resetStreak;

  await ensureArenaLevelRecord(admin, userId);

  const { data: runRow, error: runErr } = await admin
    .from("arena_runs")
    .select("run_id, started_at, difficulty, status, completion_state")
    .eq("run_id", abandonedRunId)
    .eq("user_id", userId)
    .maybeSingle();

  if (runErr) return { ok: false, error: runErr.message };
  const run = runRow as ArenaRunRow | null;
  if (!run?.started_at) return { ok: true, bandDecreased: false };

  const { data: levelRow, error: levErr } = await admin
    .from("arena_level_records")
    .select(
      "current_band, consecutive_abandons, abandon_count_window, cooldown_until, last_band_change_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (levErr) return { ok: false, error: levErr.message };
  const rec = levelRow as {
    current_band?: string;
    consecutive_abandons?: number;
    abandon_count_window?: number;
    cooldown_until?: string | null;
  } | null;

  const currentBand = typeof rec?.current_band === "string" && rec.current_band ? rec.current_band : "mid";
  const runBand = bandForRunDifficulty(run.difficulty);

  const now = Date.now();
  const cooldownUntilMs = rec?.cooldown_until ? Date.parse(rec.cooldown_until) : NaN;
  const inCooldown = Number.isFinite(cooldownUntilMs) && now < cooldownUntilMs;

  if (runBand !== currentBand) {
    const { error: touchErr } = await admin
      .from("arena_level_records")
      .update({
        last_evaluation_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (touchErr) return { ok: false, error: touchErr.message };
    return { ok: true, bandDecreased: false };
  }

  const { data: recentRuns, error: recentErr } = await admin
    .from("arena_runs")
    .select("run_id, started_at, status, difficulty, completion_state")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(80);

  if (recentErr) return { ok: false, error: recentErr.message };

  const ordered = (recentRuns ?? []) as ArenaRunRow[];
  const atBand = ordered.filter((r) => bandForRunDifficulty(r.difficulty) === currentBand);
  const lastWindow = atBand.slice(0, LEVEL_DECREASE_ABANDON_WINDOW_STARTS);
  const abandonCountInWindow = lastWindow.filter((r) => r.completion_state === "locked_step7_abandoned").length;

  const startedAt = String(run.started_at);
  const priorTerminal = atBand
    .filter((r) => String(r.started_at ?? "") < startedAt && isTerminalRunRow(r))
    .sort((a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")))[0];

  const prevConsecutive = Math.max(0, Math.min(32767, Number(rec?.consecutive_abandons ?? 0)));
  const newConsecutive =
    priorTerminal?.completion_state === "locked_step7_abandoned"
      ? Math.min(32767, prevConsecutive + 1)
      : 1;

  const decreaseEligible =
    !inCooldown &&
    (abandonCountInWindow >= LEVEL_DECREASE_ABANDON_THRESHOLD ||
      newConsecutive >= LEVEL_DECREASE_ABANDON_THRESHOLD);

  if (decreaseEligible) {
    const nextBand = prevBandDown(currentBand);
    const cooldownIso = new Date(now + LEVEL_BAND_COOLDOWN_MS).toISOString();
    const { error: decErr } = await admin
      .from("arena_level_records")
      .update({
        current_band: nextBand,
        consecutive_verified_completions: 0,
        consecutive_abandons: 0,
        abandon_count_window: 0,
        last_band_change_at: new Date().toISOString(),
        cooldown_until: cooldownIso,
        last_evaluation_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (decErr) return { ok: false, error: decErr.message };
    return { ok: true, bandDecreased: true };
  }

  const { error: upErr } = await admin
    .from("arena_level_records")
    .update({
      consecutive_abandons: newConsecutive,
      abandon_count_window: Math.min(32767, abandonCountInWindow),
      last_evaluation_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, bandDecreased: false };
}
