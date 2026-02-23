import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Source of truth for dashboard Level/Tier/Progress (SPEC 9-3).
 * Returns xpTotal (weekly_xp view if present, else arena_profiles.weekly_xp).
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("weekly_xp")
    .select("xp_total, updated_at")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();

  if (!error && row != null) {
    const xpTotal = (row as { xp_total?: number }).xp_total ?? 0;
    return NextResponse.json({
      weekStartISO: daysAgoISO(30),
      weekEndISO: new Date().toISOString(),
      xpTotal,
      count: (row as { count?: number }).count ?? 0,
      updatedAt: (row as { updated_at?: string }).updated_at ?? null,
    });
  }

  await supabase.rpc("ensure_arena_profile");
  const { data: profile } = await supabase
    .from("arena_profiles")
    .select("weekly_xp")
    .eq("user_id", user.id)
    .single();

  const xpTotal =
    typeof (profile as { weekly_xp?: number } | null)?.weekly_xp === "number"
      ? (profile as { weekly_xp: number }).weekly_xp
      : 0;

  return NextResponse.json({
    weekStartISO: daysAgoISO(30),
    weekEndISO: new Date().toISOString(),
    xpTotal,
    count: 0,
    updatedAt: null,
  });
}
