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

function nextBandUp(current: string): string {
  const i = BAND_ORDER.indexOf(current as (typeof BAND_ORDER)[number]);
  if (i < 0) return "mid";
  if (i >= BAND_ORDER.length - 1) return BAND_ORDER[BAND_ORDER.length - 1]!;
  return BAND_ORDER[i + 1]!;
}

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
 * Increments consecutive_verified_completions; may bump band if threshold met and cooldown elapsed.
 */
export async function onArenaRunCompleteVerified(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string; bandChanged?: boolean }> {
  await ensureArenaLevelRecord(admin, userId);

  const { data: row, error: selErr } = await admin
    .from("arena_level_records")
    .select(
      "consecutive_verified_completions, current_band, cooldown_until, last_band_change_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };
  const rec = row as {
    consecutive_verified_completions?: number;
    current_band?: string;
    cooldown_until?: string | null;
    last_band_change_at?: string | null;
  } | null;

  const now = Date.now();
  const cooldownUntilMs = rec?.cooldown_until ? Date.parse(rec.cooldown_until) : NaN;
  const inCooldown = Number.isFinite(cooldownUntilMs) && now < cooldownUntilMs;

  /** During cooldown, do not increment consecutive (no band evaluation per ENGINE §5 rule 8). */
  if (inCooldown) {
    await admin
      .from("arena_level_records")
      .update({
        last_evaluation_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return { ok: true, bandChanged: false };
  }

  let nextConsecutive = Math.min(
    32767,
    Math.max(0, Number(rec?.consecutive_verified_completions ?? 0) + 1),
  );
  let currentBand = typeof rec?.current_band === "string" && rec.current_band ? rec.current_band : "mid";

  if (nextConsecutive >= LEVEL_INCREASE_CONSECUTIVE_THRESHOLD) {
    currentBand = nextBandUp(currentBand);
    nextConsecutive = 0;
    const cooldownIso = new Date(now + LEVEL_BAND_COOLDOWN_MS).toISOString();
    const { error: upErr } = await admin
      .from("arena_level_records")
      .update({
        consecutive_verified_completions: nextConsecutive,
        current_band: currentBand,
        last_band_change_at: new Date().toISOString(),
        cooldown_until: cooldownIso,
        last_evaluation_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true, bandChanged: true };
  }

  const { error: upErr } = await admin
    .from("arena_level_records")
    .update({
      consecutive_verified_completions: nextConsecutive,
      last_evaluation_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, bandChanged: false };
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
