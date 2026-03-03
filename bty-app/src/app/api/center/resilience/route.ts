/**
 * GET /api/center/resilience — Center 일별 회복 탄력성 트렉 (§4 CENTER_PAGE_IMPROVEMENT_SPEC).
 * center_letters를 날짜별로 집계해, energy(1–5) 또는 mood로 high/mid/low 수준을 반환.
 * ResilienceGraph에서 5문항 자존감 기록과 병합해 일별 궤적을 그린다.
 */
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type ResilienceDailyLevel = "high" | "mid" | "low";

export type ResilienceDayEntry = {
  date: string; // YYYY-MM-DD
  level: ResilienceDailyLevel;
  source: "letter";
};

/** energy 1–5 → low / mid / high. 없으면 mid. */
function energyToLevel(energy: number | null): ResilienceDailyLevel {
  if (energy == null) return "mid";
  if (energy <= 2) return "low";
  if (energy >= 4) return "high";
  return "mid";
}

export async function GET() {
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

    const byDate = new Map<string, { energy: number | null }>();
    for (const r of rows) {
      const date = (r.created_at as string).slice(0, 10);
      const existing = byDate.get(date);
      const energy = r.energy != null ? Number(r.energy) : null;
      if (!existing) {
        byDate.set(date, { energy });
      } else {
        byDate.set(date, { energy: existing.energy ?? energy });
      }
    }

    const entries: ResilienceDayEntry[] = Array.from(byDate.entries())
      .map(([date, { energy }]) => ({
        date,
        level: energyToLevel(energy),
        source: "letter" as const,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[center/resilience]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
