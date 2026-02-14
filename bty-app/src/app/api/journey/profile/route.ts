import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await db
    .from("bty_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      current_day: 1,
      started_at: new Date().toISOString(),
      season: 1,
      bounce_back_count: 0,
      last_completed_at: null,
      is_new: true,
    });
  }

  return NextResponse.json({
    current_day: data.current_day,
    started_at: data.started_at,
    updated_at: data.updated_at,
    season: data.season ?? 1,
    bounce_back_count: data.bounce_back_count ?? 0,
    last_completed_at: data.last_completed_at ?? null,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const currentDay = Math.min(28, Math.max(1, Number(body.current_day) || 1));
  const season = Math.max(1, Number(body.season) || 1);
  const lastCompletedAt =
    body.last_completed_at === null
      ? null
      : typeof body.last_completed_at === "string"
        ? body.last_completed_at
        : undefined;

  const row: Record<string, unknown> = {
    user_id: user.id,
    current_day: currentDay,
    season,
    updated_at: new Date().toISOString(),
  };
  if (lastCompletedAt !== undefined) row.last_completed_at = lastCompletedAt;

  const { data, error } = await db
    .from("bty_profiles")
    .upsert(row, { onConflict: "user_id", ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
