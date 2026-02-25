import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { tierFromCoreXp } from "@/lib/bty/arena/codes";

const MAX_SUB_NAME_LENGTH = 7;

function validateSubName(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const v = raw.trim();
  if (v.length === 0) return { ok: false, reason: "EMPTY" };
  if (v.length > MAX_SUB_NAME_LENGTH) return { ok: false, reason: "MAX_7_CHARS" };
  if (!/^[\p{L}\p{N}\s\-_]+$/u.test(v)) return { ok: false, reason: "INVALID_CHARS" };
  return { ok: true, value: v };
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { subName?: unknown };
  const subNameInput = String(body?.subName ?? "");
  const validated = validateSubName(subNameInput);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "INVALID_SUB_NAME", reason: validated.reason },
      { status: 400 }
    );
  }

  const { data: prof, error: profErr } = await supabase
    .from("arena_profiles")
    .select("user_id, core_xp_total, code_index, sub_name_renamed_in_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  if (!prof) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const coreXp = Number((prof as { core_xp_total?: number }).core_xp_total ?? 0);
  const tier = tierFromCoreXp(coreXp);
  const codeIndex = Number((prof as { code_index?: number }).code_index ?? 0);
  const alreadyRenamed = Boolean((prof as { sub_name_renamed_in_code?: boolean }).sub_name_renamed_in_code);

  if (tier < 25) return NextResponse.json({ error: "TIER_25_REQUIRED" }, { status: 403 });
  if (alreadyRenamed) return NextResponse.json({ error: "ALREADY_RENAMED_IN_CODE" }, { status: 403 });
  if (codeIndex >= 6) return NextResponse.json({ error: "CODELESS_ZONE_USE_FREE_SET" }, { status: 400 });

  const { data: wRow } = await supabase.from("weekly_xp").select("xp_total").eq("user_id", user.id).is("league_id", null).maybeSingle();
  const myXp = typeof (wRow as { xp_total?: number } | null)?.xp_total === "number" ? (wRow as { xp_total: number }).xp_total : 0;
  const { count: totalCount } = await supabase.from("weekly_xp").select("user_id", { count: "exact", head: true }).is("league_id", null);
  const { count: rankAbove } = await supabase.from("weekly_xp").select("user_id", { count: "exact", head: true }).is("league_id", null).gt("xp_total", myXp);
  const total = totalCount ?? 0;
  const rank = total > 0 ? (rankAbove ?? 0) + 1 : 0;
  const isTop5Percent = total > 0 && rank > 0 && rank <= Math.ceil(0.05 * total);
  if (!isTop5Percent) return NextResponse.json({ error: "ELITE_TOP_5_PERCENT_REQUIRED" }, { status: 403 });

  const { error: updErr } = await supabase
    .from("arena_profiles")
    .update({ sub_name: validated.value, sub_name_renamed_in_code: true })
    .eq("user_id", user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, subName: validated.value });
}
