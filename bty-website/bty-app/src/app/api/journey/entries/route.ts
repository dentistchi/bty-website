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

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dayParam = searchParams.get("day");

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  if (dayParam) {
    const day = parseInt(dayParam, 10);
    if (day < 1 || day > 28) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }
    const { data, error } = await db
      .from("bty_day_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("day", day)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || null);
  }

  const { data, error } = await db
    .from("bty_day_entries")
    .select("*")
    .eq("user_id", userId)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
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
  const day = Math.min(28, Math.max(1, Number(body.day) || 1));
  const completed = Boolean(body.completed);
  const missionChecks = Array.isArray(body.mission_checks)
    ? body.mission_checks.filter((n: unknown) => typeof n === "number")
    : [];
  const reflectionText =
    typeof body.reflection_text === "string"
      ? body.reflection_text.trim() || null
      : null;

  const { data, error } = await db
    .from("bty_day_entries")
    .upsert(
      {
        user_id: userId,
        day,
        completed,
        mission_checks: missionChecks,
        reflection_text: reflectionText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
