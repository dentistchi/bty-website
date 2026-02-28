import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { tierFromCoreXp, codeIndexFromTier } from "@/lib/bty/arena/codes";

const MAX_SUB_NAME_LENGTH = 7;

function validateSubName(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const v = raw.trim();
  if (v.length === 0) return { ok: false, reason: "EMPTY" };
  if (v.length > MAX_SUB_NAME_LENGTH) return { ok: false, reason: "MAX_7_CHARS" };
  if (!/^[\p{L}\p{N}\s\-_]+$/u.test(v)) return { ok: false, reason: "INVALID_CHARS" };
  return { ok: true, value: v };
}

/** 코드네임(서브네임) 변경: 코드가 바뀌고 해당 코드에서 tier 25 이상이면 그 코드에서 1회만 가능. 요청 쿠키 기반 인증(profile/core-xp와 동일). */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { subName?: unknown };
  try {
    body = (await req.json().catch(() => ({}))) as { subName?: unknown };
  } catch {
    const out = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const subNameInput = String(body?.subName ?? "");
  const validated = validateSubName(subNameInput);
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
  const rank = total > 0 ? (rankAbove ?? 0) + 1 : 0;
  const isTop5Percent = total > 0 && rank > 0 && rank <= Math.ceil(0.05 * total);
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
