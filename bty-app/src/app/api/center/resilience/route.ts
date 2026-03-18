/**
 * GET /api/center/resilience — Center 일별/기간별 회복 탄력성 트렉.
 *
 * @contract
 * - **Query `period`:** 생략·빈 문자열 → 전체(또는 서비스 기본). **비어 있지 않은 값**은 정수 **1–365**만 허용; 그 외 → **400** `{ error: "INVALID_PERIOD" }`.
 * - **200:** `{ entries: ResilienceDayEntry[] }`.
 * - **401:** `{ error: "Unauthorized" }`.
 * - **500:** `{ error: string }` 또는 catch 시 `{ error: "Something went wrong" }`.
 * - **250:** 플랜 문구 POST는 오타; 본 라우트는 **GET**만.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getResilienceEntries, parsePeriodDays } from "@/lib/bty/center";

export type { ResilienceDailyLevel, ResilienceDayEntry } from "@/domain/center/resilience";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodRaw = req.nextUrl.searchParams.get("period");
    let periodDays: number | undefined;
    if (periodRaw == null || periodRaw.trim() === "") {
      periodDays = undefined;
    } else {
      periodDays = parsePeriodDays(periodRaw);
      if (periodDays === undefined) {
        return NextResponse.json({ error: "INVALID_PERIOD" }, { status: 400 });
      }
    }
    const result = await getResilienceEntries(supabase, user.id, periodDays);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ entries: result.entries });
  } catch (e) {
    console.error("[center/resilience]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
