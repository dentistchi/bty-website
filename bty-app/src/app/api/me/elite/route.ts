import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getIsEliteTop5 } from "@/lib/bty/arena/eliteStatus";
import { getEliteBadgeGrants } from "@/lib/bty/arena/eliteBadge";
import type { EliteBadgeGrant } from "@/lib/bty/arena/eliteBadge";

export const runtime = "nodejs";

/**
 * GET /api/me/elite
 * @contract Auth: required (session). Query: none.
 * Response (200): EliteGetResponse { isElite, badges, eliteContentUnlocked }.
 * Errors: 401 { error: "UNAUTHENTICATED" } (no session); 500 if Supabase/auth/elite lookup throws (unhandled).
 */
export type EliteGetResponse = {
  isElite: boolean;
  badges: EliteBadgeGrant[];
  eliteContentUnlocked: boolean;
};

export type EliteErrorResponse = { error: "UNAUTHENTICATED" };

/** GET: 현재 사용자 상위 5% Elite 여부 + 엘리트 배지 증정 + Elite 전용 콘텐츠 해금 (PHASE_4_ELITE_5_PERCENT_SPEC §10, ELITE_4TH_SPECIAL_OR_UNLOCK_1PAGE §3) */
export async function GET(): Promise<
  NextResponse<EliteGetResponse | EliteErrorResponse>
> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" } satisfies EliteErrorResponse, { status: 401 });

  const isElite = await getIsEliteTop5(supabase, user.id);
  const badges = getEliteBadgeGrants(isElite);
  return NextResponse.json({
    isElite,
    badges,
    /** Elite 전용(elite_only) 콘텐츠 접근 가능 여부. 진입 전 해금 조건 API용. */
    eliteContentUnlocked: isElite,
  } satisfies EliteGetResponse);
}
