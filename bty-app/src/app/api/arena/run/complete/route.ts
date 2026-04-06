import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
import { ensureActionContractForArenaRun } from "@/lib/bty/action-contract/ensureActionContractForArenaRun";
import { resolvePatternFamilyForContractTrigger } from "@/lib/bty/pattern-engine/resolvePatternFamilyForContractTrigger";
import { syncPatternStatesForUser } from "@/lib/bty/pattern-engine/syncPatternStates";

/**
 * POST /api/arena/run/complete — 런 종료 + **주간/코어 XP 1회 지급** (멱등).
 *
 * @contract
 * - **Auth:** 401 `{ error: "UNAUTHENTICATED" }`.
 * - **Body:** `{ runId: string }` 필수. 선택 `time_remaining` (number): 미전달 시 `arena_runs.meta.time_remaining` 사용.
 * - **400:** `{ error: "INVALID_JSON" }` | `{ error: "MISSING_RUN_ID" }` — **클라이언트 흔함:** 빈 body·깨진 JSON→INVALID_JSON; `runId` 없음·빈 문자열·비문자열→MISSING_RUN_ID.
 * - **404:** `{ error: "NOT_FOUND" }` (다른 사용자 런 또는 없음).
 * - **410:** 미사용. **이미 해당 runId로 XP 지급 완료** → **200 `{ idempotent: true }`** (410 Gone 아님).
 * - **200 (첫 완료):** `{ ok: true, runId, status: "DONE", deltaApplied, coreXp, weeklyXp, actionContractCreated, myPageRefetchRequired, contractId? }`
 *   — `actionContractCreated` is true only when a **new** contract row was inserted; false if ensure failed after XP (still 200) or row already existed.
 *   — `weeklyXp`/`deltaApplied`는 일일 캡 적용 후 주간 누적에 반영된 값; `coreXp`는 이번 런 코어 가산(영구).
 *   — Action Contract: `ensureActionContractForArenaRun` → `public.bty_action_contracts` (idempotent per `user_id`+`session_id`).
 * - **200 (멱등·이중 제출):** `{ ok: true, runId, status: "DONE", idempotent: true, actionContractCreated, contractId, myPageRefetchRequired }` — **`deltaApplied`·`coreXp`·`weeklyXp` 없음**; 항상 `ensureActionContractForArenaRun`로 계약 행 보장(복구).
 * - **500:** `{ error: string }` (DB/XP 적용 실패).
 * - **계약:** `SUPABASE_SERVICE_ROLE_KEY` 누락 시 **멱등/첫 완료 모두** `ensureActionContractForArenaRun`이 `ok:false`로 로그만 남기고 **200** 유지(XP는 이미 적용된 경우).
 * - **409:** `{ error: "RUN_ABORTED" }` — `meta.aborted_at` 설정된 런은 완료 처리·XP 지급 불가.
 * - **멱등:** 이미 XP 지급된 동일 `runId` 재요청 → **200** `{ idempotent: true }` (409 아님).
 * - **429:** 미사용. DB 경합·일시 오류는 **500** — 클라이언트 백오프 재시도.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-1 (Weekly XP 경쟁 / Core XP 영구 분리)
 */
export async function POST(req: Request) {
  console.log("[getSupabaseAdmin] FINAL CHECK", {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing",
    SUPABASE_URL:
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "present"
        : "missing",
    NODE_ENV: process.env.NODE_ENV,
  });

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
  const runMeta = (
    existing as {
      meta?: {
        time_remaining?: number;
        time_limit?: number;
        aborted_at?: string | null;
      } | null;
    }
  ).meta;
  if (runMeta?.aborted_at != null && String(runMeta.aborted_at).trim() !== "") {
    return NextResponse.json({ error: "RUN_ABORTED" }, { status: 409 });
  }

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
    console.log("[arena] before ensureActionContractForArenaRun", {
      runId,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    await syncPatternStatesForUser(supabase, user.id);
    const patternFamily = await resolvePatternFamilyForContractTrigger(supabase, user.id);

    const ensured = await ensureActionContractForArenaRun({
      userId: user.id,
      runId,
      scenarioId: scenarioId || "unknown",
      nbaLogId: null,
      patternFamily,
    });
    return NextResponse.json({
      ok: true,
      runId,
      status: "DONE",
      idempotent: true,
      actionContractCreated: ensured.ok && ensured.created,
      contractId: ensured.contractId,
      myPageRefetchRequired: true,
    });
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

  const adminForContract = getSupabaseAdmin();
  if (!adminForContract) {
    console.error(
      "[run/complete] admin null after RUN_COMPLETED_APPLIED insert — contract will not be created. Check SUPABASE_SERVICE_ROLE_KEY.",
      { userId: user.id, runId },
    );
  }

  console.log("[arena] before ensureActionContractForArenaRun", {
    runId,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  await syncPatternStatesForUser(supabase, user.id);
  const patternFamily = await resolvePatternFamilyForContractTrigger(supabase, user.id);

  const ensured = await ensureActionContractForArenaRun({
    userId: user.id,
    runId,
    scenarioId: scenarioId || "unknown",
    nbaLogId: null,
    patternFamily,
  });

  if (!ensured.ok) {
    // Intentional: no XP / weekly_xp / RUN_COMPLETED_APPLIED rollback here — core + weekly already committed.
    // Repair: POST /api/admin/recover-contract or retry complete; see ensureActionContract reconcile + logs.
    console.error("[run/complete] ensureActionContract failed after XP applied", {
      userId: user.id,
      runId,
      scenarioId,
    });
  }

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
    actionContractCreated: ensured.ok && ensured.created,
    contractId: ensured.contractId,
    myPageRefetchRequired: true,
  });
}
