import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

async function getUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.sub ?? null;
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data: profile } = await db
    .from("bty_profiles")
    .select("bounce_back_count, current_day, season")
    .eq("user_id", userId)
    .single();

  const count = (profile?.bounce_back_count ?? 0) + 1;

  const { data, error } = await db
    .from("bty_profiles")
    .upsert(
      {
        user_id: userId,
        current_day: profile?.current_day ?? 1,
        season: profile?.season ?? 1,
        bounce_back_count: count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    )
    .select("bounce_back_count")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bounce_back_count: data?.bounce_back_count ?? count });
}
