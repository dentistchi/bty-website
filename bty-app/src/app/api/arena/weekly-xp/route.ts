import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // Spec: weekly_xp is competition XP (MVP: league_id NULL = current window)
  const { data: row, error } = await supabase
    .from("weekly_xp")
    .select("xp_total, updated_at")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const xpTotal = row?.xp_total ?? 0;

  // MVP window placeholder: last 30 days (real league window comes later)
  const weekStartISO = daysAgoISO(30);
  const weekEndISO = new Date().toISOString();

  return NextResponse.json({
    weekStartISO,
    weekEndISO,
    xpTotal,
    count: 0,
    updatedAt: row?.updated_at ?? null,
  });
}
