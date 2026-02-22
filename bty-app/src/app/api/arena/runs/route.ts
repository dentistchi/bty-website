import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(50, Math.max(1, Number(limitRaw ?? 10) || 10));

  const { data, error } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, locale, started_at, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}
