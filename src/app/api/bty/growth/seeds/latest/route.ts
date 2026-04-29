import { NextResponse } from "next/server";
import { seedRowToClientSeed, type BtyReflectionSeedRow } from "@/lib/bty/identity";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/bty/growth/seeds/latest — latest reflection seed (Arena-sourced).
 */
export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bty_reflection_seeds")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seed = data ? seedRowToClientSeed(data as BtyReflectionSeedRow) : null;

  return NextResponse.json({ seed });
}
