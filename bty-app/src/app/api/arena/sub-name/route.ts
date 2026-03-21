/**
 * POST /api/arena/sub-name — Sub Name 변경 (코드당 1회, tier≥25·주간 상위 5%·CODELESS 제외).
 * Body: { subName: string } (≤7자, 문자·숫자·공백·-_); optional **scenarioOutcomes** — **`arenaScenarioOutcomesFromUnknown`** · **400** `scenario_outcomes_invalid`
 * (키 존재 시; 비객체·배열·바깥 `{}`·유효 키에 대한 빈 outcome 등 파싱 실패).
 * Response (200): { ok: true, subName }.
 * Errors: 401 UNAUTHENTICATED; 400 INVALID_JSON | INVALID_SUB_NAME (reason) | scenario_outcomes_invalid | CODELESS_ZONE_USE_FREE_SET;
 * 403 TIER_25_REQUIRED | ALREADY_RENAMED_IN_THIS_CODE | ELITE_TOP_5_PERCENT_REQUIRED; 404 NOT_FOUND; 500 { error: string }.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { weeklyRankFromCounts } from "@/domain/rules/leaderboard";
import { tierFromCoreXp, codeIndexFromTier } from "@/lib/bty/arena/codes";
import { arenaScenarioOutcomesFromUnknown, arenaSubNameFromUnknown } from "@/domain/arena/scenarios";

export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { subName?: unknown; scenarioOutcomes?: unknown };
  try {
    body = (await req.json()) as { subName?: unknown; scenarioOutcomes?: unknown };
  } catch {
    const out = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  if ("scenarioOutcomes" in body) {
    if (arenaScenarioOutcomesFromUnknown(body.scenarioOutcomes) === null) {
      const out = NextResponse.json({ error: "scenario_outcomes_invalid" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  const subNameInput = String(body?.subName ?? "");
  const validated = arenaSubNameFromUnknown(subNameInput);
  if (!validated.ok) {
    const out = NextResponse.json(
      { error: "INVALID_SUB_NAME", reason: validated.reason },
      { status: 400 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: prof, error: profErr } = await supabase
    .from("arena_profiles")
    .select("user_id, core_xp_total, code_index, sub_name_renamed_in_code, sub_name_renamed_at_code_index")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    const out = NextResponse.json({ error: profErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (!prof) {
    const out = NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const coreXp = Number((prof as { core_xp_total?: number }).core_xp_total ?? 0);
  const tier = tierFromCoreXp(coreXp);
  const codeIndex = Math.min(6, Math.max(0, Number((prof as { code_index?: number }).code_index ?? codeIndexFromTier(tier))));
  const lastRenamedAtCode = (prof as { sub_name_renamed_at_code_index?: number | null }).sub_name_renamed_at_code_index;
  const alreadyRenamedInCurrentCode =
    (typeof lastRenamedAtCode === "number" && codeIndex <= lastRenamedAtCode) ||
    Boolean((prof as { sub_name_renamed_in_code?: boolean }).sub_name_renamed_in_code && lastRenamedAtCode == null);

  if (tier < 25) {
    const out = NextResponse.json({ error: "TIER_25_REQUIRED" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (alreadyRenamedInCurrentCode) {
    const out = NextResponse.json({ error: "ALREADY_RENAMED_IN_THIS_CODE" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (codeIndex >= 6) {
    const out = NextResponse.json({ error: "CODELESS_ZONE_USE_FREE_SET" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: wRow } = await supabase.from("weekly_xp").select("xp_total").eq("user_id", user.id).is("league_id", null).maybeSingle();
  const myXp = typeof (wRow as { xp_total?: number } | null)?.xp_total === "number" ? (wRow as { xp_total: number }).xp_total : 0;
  const { count: totalCount } = await supabase.from("weekly_xp").select("user_id", { count: "exact", head: true }).is("league_id", null);
  const { count: rankAbove } = await supabase.from("weekly_xp").select("user_id", { count: "exact", head: true }).is("league_id", null).gt("xp_total", myXp);
  const total = totalCount ?? 0;
  const { isTop5Percent } = weeklyRankFromCounts(total, rankAbove ?? 0);
  if (!isTop5Percent) {
    const out = NextResponse.json({ error: "ELITE_TOP_5_PERCENT_REQUIRED" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { error: updErr } = await supabase
    .from("arena_profiles")
    .update({
      sub_name: validated.value,
      sub_name_renamed_in_code: true,
      sub_name_renamed_at_code_index: codeIndex,
    })
    .eq("user_id", user.id);

  if (updErr) {
    const out = NextResponse.json({ error: updErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const out = NextResponse.json({ ok: true, subName: validated.value });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
