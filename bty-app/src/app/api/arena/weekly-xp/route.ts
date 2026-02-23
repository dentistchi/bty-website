import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * Source of truth for dashboard Level/Tier/Progress (SPEC 9-3).
 * Returns weekly_xp as xpTotal.
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  await supabase.rpc("ensure_arena_profile");

  const { data, error } = await supabase
    .from("arena_profiles")
    .select("weekly_xp")
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const xpTotal = typeof data?.weekly_xp === "number" ? data.weekly_xp : 0;
  return NextResponse.json({ xpTotal });
}
