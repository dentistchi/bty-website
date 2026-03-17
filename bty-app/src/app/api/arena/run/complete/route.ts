import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { applyDirectCoreXp, applySeasonalXpToCore } from "@/lib/bty/arena/applyCoreXp";
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
import {
  getWeekStartUTC,
  REFLECTION_QUEST_TARGET,
  REFLECTION_QUEST_BONUS_XP,
} from "@/lib/bty/arena/weeklyQuest";

/**
 * POST /api/arena/run/complete
 * Body: { runId: string, time_remaining?: number }. Marks run DONE and applies XP (once per run).
 * Response 200: { ok, runId, status: "DONE", deltaApplied?, coreXp?, weeklyXp? } or { ok, runId, status, idempotent: true }.
 * Errors: 401 { error: "UNAUTHENTICATED" }, 400 { error: "MISSING_RUN_ID" | "INVALID_JSON" }, 404 { error: "NOT_FOUND" }, 500 { error: string }.
 * Idempotent: repeat POST after XP applied returns 200 with idempotent: true (no double weekly/core grant).
 * Gate 3: Daily cap in lib (activityXp); route uses getArenaTodayTotal + capArenaDailyDelta only.
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const runId = (body as { runId?: string })?.runId;
  const bodyTimeRemaining = (body as { time_remaining?: unknown }).time_remaining;
  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ error: "MISSING_RUN_ID" }, { status: 400 });
  }

  const { data: existing, error: selErr } = await supabase
    .from("arena_runs")
    .select("run_id, status, scenario_id, difficulty, meta")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const scenarioId = (existing as { scenario_id?: string }).scenario_id ?? "";
  const runDifficulty = parseStoredDifficulty((existing as { difficulty?: unknown }).difficulty);
  const runMeta = (existing as { meta?: { time_remaining?: number; time_limit?: number } | null }).meta;

  if (existing.status !== "DONE") {
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("arena_runs")
      .update({ status: "DONE", completed_at: nowIso })
      .eq("run_id", runId)
      .eq("user_id", user.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Spec 9-1 B: Apply XP to weekly_xp ONCE per run (idempotent via RUN_COMPLETED_APPLIED)
  const { data: applied, error: appliedErr } = await supabase
    .from("arena_events")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("run_id", runId)
    .eq("event_type", "RUN_COMPLETED_APPLIED")
    .limit(1);

  if (appliedErr) return NextResponse.json({ error: appliedErr.message }, { status: 500 });

  if ((applied ?? []).length > 0) {
    return NextResponse.json({ ok: true, runId, status: "DONE", idempotent: true });
  }

  const { data: evs, error: evErr } = await supabase
    .from("arena_events")
    .select("xp, event_type")
    .eq("user_id", user.id)
    .eq("run_id", runId);

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  const eventSum = (evs ?? []).reduce((sum, row) => sum + (typeof row.xp === "number" ? row.xp : 0), 0);

  const { data: profileRow } = await supabase
    .from("arena_profiles")
    .select("streak")
    .eq("user_id", user.id)
    .maybeSingle();
  const streakDays = Math.max(0, Number((profileRow as { streak?: number } | null)?.streak ?? 0));

  const difficulty = runDifficulty ?? inferDifficultyFromEventSum(eventSum);
  const xpBase = getDifficultyBase(difficulty);
  const timeLimit = runMeta?.time_limit;
  const timeRemaining =
    typeof bodyTimeRemaining === "number" && Number.isFinite(bodyTimeRemaining)
      ? bodyTimeRemaining
      : runMeta?.time_remaining;
  const timeFactor =
    typeof timeRemaining === "number" && typeof timeLimit === "number" && timeLimit > 0
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

  const todayArenaTotal = await getArenaTodayTotal(supabase, user.id);
  const deltaCapped = capArenaDailyDelta(arenaWeeklyXp, todayArenaTotal);

  const { data: row, error: rowErr } = await supabase
    .from("weekly_xp")
    .select("id, xp_total")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();

  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });

  await supabase.rpc("ensure_arena_profile");

  if (!row) {
    const { error: insErr } = await supabase
      .from("weekly_xp")
      .insert({ user_id: user.id, league_id: null, xp_total: deltaCapped });

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  } else {
    const nextTotal = (typeof row.xp_total === "number" ? row.xp_total : 0) + deltaCapped;
    const { error: uErr } = await supabase
      .from("weekly_xp")
      .update({ xp_total: nextTotal })
      .eq("id", row.id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  // Arena: Core from new formula (direct); Weekly already applied above as deltaCapped.
  const coreResult = await applyDirectCoreXp(supabase, user.id, arenaCoreXp);
  if ("error" in coreResult) return NextResponse.json({ error: coreResult.error }, { status: 500 });

  const { error: markErr } = await supabase.from("arena_events").insert({
    user_id: user.id,
    run_id: runId,
    event_type: "RUN_COMPLETED_APPLIED",
    step: 7,
    scenario_id: scenarioId || "unknown",
    xp: 0,
  });

  if (markErr) return NextResponse.json({ error: markErr.message }, { status: 500 });

  // Weekly reflection quest: 3 reflections in a week (Monday UTC) grant +15 Seasonal XP once.
  const weekStart = getWeekStartUTC();
  const weekStartISO = `${weekStart}T00:00:00.000Z`;
  const { count: reflectionCount, error: countErr } = await supabase
    .from("arena_events")
    .select("event_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("event_type", ["REFLECTION_SELECTED", "BEGINNER_REFLECTION"])
    .gte("created_at", weekStartISO);
  if (!countErr && (reflectionCount ?? 0) >= REFLECTION_QUEST_TARGET) {
    const { data: existingClaim } = await supabase
      .from("arena_weekly_quest_claims")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .eq("quest_type", "reflection")
      .maybeSingle();
    if (!existingClaim) {
      const { data: wxRow } = await supabase
        .from("weekly_xp")
        .select("id, xp_total")
        .eq("user_id", user.id)
        .is("league_id", null)
        .maybeSingle();
      if (wxRow) {
        const newTotal = (typeof (wxRow as { xp_total?: number }).xp_total === "number" ? (wxRow as { xp_total: number }).xp_total : 0) + REFLECTION_QUEST_BONUS_XP;
        await supabase.from("weekly_xp").update({ xp_total: newTotal }).eq("id", (wxRow as { id: string }).id);
        await applySeasonalXpToCore(supabase, user.id, REFLECTION_QUEST_BONUS_XP);
      }
      await supabase.from("arena_weekly_quest_claims").insert({
        user_id: user.id,
        week_start: weekStart,
        quest_type: "reflection",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    runId,
    status: "DONE",
    deltaApplied: deltaCapped,
    coreXp: arenaCoreXp,
    weeklyXp: deltaCapped,
  });
}
