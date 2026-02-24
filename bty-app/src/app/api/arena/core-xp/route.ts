import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  CODE_NAMES,
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  type CodeIndex,
} from "@/lib/bty/arena/codes";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { data: row, error } = await supabase
    .from("arena_profiles")
    .select("user_id, core_xp_total, code_index, sub_name, sub_name_renamed_in_code, code_hidden")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    const out = NextResponse.json({ error: "DB_ERROR", detail: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const coreXpTotal =
    row && typeof (row as { core_xp_total?: number }).core_xp_total === "number"
      ? (row as { core_xp_total: number }).core_xp_total
      : 0;
  const tier = tierFromCoreXp(coreXpTotal);
  const codeIndex = (row && typeof (row as { code_index?: number }).code_index === "number"
    ? (row as { code_index: number }).code_index
    : codeIndexFromTier(tier)) as CodeIndex;
  const subTierGroup = subTierGroupFromTier(tier);
  const customSubName = row ? (row as { sub_name?: string | null }).sub_name ?? null : null;
  const codeName = CODE_NAMES[Math.min(6, Math.max(0, codeIndex))];
  const subName = resolveSubName(codeIndex, subTierGroup, customSubName);
  const subNameRenameAvailable =
    row &&
    tier >= 25 &&
    !(row as { sub_name_renamed_in_code?: boolean }).sub_name_renamed_in_code &&
    codeIndex < 6;

  let seasonalXpTotal = 0;
  const { data: wRow } = await supabase
    .from("weekly_xp")
    .select("xp_total")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();
  if (wRow && typeof (wRow as { xp_total?: number }).xp_total === "number") {
    seasonalXpTotal = (wRow as { xp_total: number }).xp_total;
  }

  if (!row) {
    const out = NextResponse.json({
      coreXpTotal: 0,
      codeName: CODE_NAMES[0],
      subName: "Spark",
      seasonalXpTotal: 0,
      codeHidden: false,
      subNameRenameAvailable: false,
    });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({
    coreXpTotal,
    codeName,
    subName,
    seasonalXpTotal,
    codeHidden: coreXpTotal >= 700,
    subNameRenameAvailable: Boolean(subNameRenameAvailable),
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
