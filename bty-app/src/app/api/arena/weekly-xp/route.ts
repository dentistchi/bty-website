import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

function startOfWeek(d: Date) {
  // Monday-start week
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // move to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  const { data, error } = await supabase
    .from("arena_events")
    .select("xp, created_at, event_type")
    .eq("user_id", user.id)
    .gte("created_at", weekStart.toISOString())
    .lt("created_at", weekEnd.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const xpTotal = (data ?? []).reduce((sum, row) => sum + (typeof row.xp === "number" ? row.xp : 0), 0);

  return NextResponse.json({
    weekStartISO: weekStart.toISOString(),
    weekEndISO: weekEnd.toISOString(),
    xpTotal,
    count: (data ?? []).length,
  });
}
