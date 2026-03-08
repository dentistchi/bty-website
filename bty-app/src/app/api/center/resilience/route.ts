/**
 * GET /api/center/resilience — Center 일별/기간별 회복 탄력성 트렉 (§4 CENTER_PAGE_IMPROVEMENT_SPEC).
 * 도메인(aggregateLetterRowsToDailyEntries)만 호출. 쿠키/리다이렉트 변경 없음.
 * Query: period=7|30 (optional) — 최근 N일만 반환.
 *
 * 응답 계약: 200 → { entries: ResilienceDayEntry[] } (각 항목: date YYYY-MM-DD, level "high"|"mid"|"low", source "letter"). 401/500 → { error: string }.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  aggregateLetterRowsToDailyEntries,
  type LetterRow,
  type ResilienceDayEntry,
} from "@/domain/center/resilience";

export type { ResilienceDailyLevel, ResilienceDayEntry } from "@/domain/center/resilience";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows } = await supabase
      .from("center_letters")
      .select("energy, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!rows?.length) {
      return NextResponse.json({ entries: [] });
    }

    const periodParam = req.nextUrl.searchParams.get("period");
    const raw = periodParam != null ? parseInt(periodParam, 10) : NaN;
    const periodDays = Number.isFinite(raw) && raw >= 1 ? Math.min(365, raw) : undefined;

    const entries: ResilienceDayEntry[] = aggregateLetterRowsToDailyEntries(rows as LetterRow[], {
      periodDays,
    });

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[center/resilience]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
