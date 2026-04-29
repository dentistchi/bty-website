import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getIsEliteTop5 } from "@/lib/bty/arena/eliteStatus";
import { getEliteBadgeGrants } from "@/lib/bty/arena/eliteBadge";
import type { EliteBadgeGrant } from "@/lib/bty/arena/eliteBadge";

export const runtime = "nodejs";

/**
 * GET /api/me/elite — 주간 **Elite(상위 5%)**·배지·해금 플래그 (`eliteStatus`·`eliteBadge`).
 *
 * @contract
 * - **200 (`EliteGetResponse`):** `{ isElite: boolean, badges: EliteBadgeGrant[], eliteContentUnlocked: boolean }`.
 *   - `badges`: 비-Elite 시 빈 배열 가능; Elite 시 `{ id, label, … }[]`.
 *   - `eliteContentUnlocked` === `isElite` (elite_only 게이트).
 * - **401:** `{ error: "UNAUTHENTICATED" }`.
 * - **500:** Supabase/엘리트 조회 예외 시 Next 기본 HTML 또는 비JSON(명시 `{ error }` 미보장).
 * - **캐시:** `Cache-Control: private, max-age=60, stale-while-revalidate=120` — 주간 Elite 스냅샷·짧은 캐시 허용.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-11b
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
  const res = NextResponse.json({
    isElite,
    badges,
    /** Elite 전용(elite_only) 콘텐츠 접근 가능 여부. 진입 전 해금 조건 API용. */
    eliteContentUnlocked: isElite,
  } satisfies EliteGetResponse);
  res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
  return res;
}
