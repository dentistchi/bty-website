/**
 * GET /api/center/resilience — Center 일별/기간별 회복 탄력성 트렉.
 * Query: period (optional, parsed via parsePeriodDays). Response 200: { entries: ResilienceDayEntry[] }.
 * Errors: 401 { error: "Unauthorized" }; 500 { error: string | "Something went wrong" } (service or catch).
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

    const periodDays = parsePeriodDays(req.nextUrl.searchParams.get("period"));
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
