import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";

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

  const league = await getActiveLeague(supabase, getSupabaseAdmin());
  let q = supabase
    .from("weekly_xp")
    .select("xp_total, updated_at")
    .eq("user_id", user.id);
  if (league) q = q.eq("league_id", league.league_id);
  else q = q.is("league_id", null);
  const { data: row, error } = await q.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const xpTotal = row?.xp_total ?? 0;
  const weekStartISO = league?.start_at ?? daysAgoISO(30);
  const weekEndISO = league?.end_at ?? new Date().toISOString();

  return NextResponse.json({
    weekStartISO,
    weekEndISO,
    xpTotal,
    count: 0,
    updatedAt: row?.updated_at ?? null,
    season: league ? { league_id: league.league_id, name: league.name ?? null } : null,
  });
}
