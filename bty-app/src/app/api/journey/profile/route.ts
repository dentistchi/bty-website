import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";

async function getUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.sub ?? null;
}

export async function GET(request: Request) {
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

  const { data, error } = await db
    .from("bty_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      current_day: 1,
      started_at: new Date().toISOString(),
      is_new: true,
    });
  }

  return NextResponse.json({
    current_day: data.current_day,
    started_at: data.started_at,
    updated_at: data.updated_at,
  });
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

  const body = await request.json().catch(() => ({}));
  const currentDay = Math.min(28, Math.max(1, Number(body.current_day) || 1));

  const { data, error } = await db
    .from("bty_profiles")
    .upsert(
      {
        user_id: userId,
        current_day: currentDay,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
