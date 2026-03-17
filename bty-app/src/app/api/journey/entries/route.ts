import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/journey/entries
 * Query: day (optional, 1–28) — single day entry. Omit for all entries (array).
 * Response 200: single object | null (when ?day=N), or array (when no day).
 * Errors: 401 { error: "Unauthorized" }, 400 { error: "Invalid day" }, 503 { error: "Database not configured" }, 500 { error: string }.
 */
export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
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
      .eq("user_id", user.id)
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
    .eq("user_id", user.id)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/**
 * POST /api/journey/entries
 * Body: { day?: number, completed?: boolean, mission_checks?: number[], reflection_text?: string }
 * Response (200): upserted row. Errors: 401, 503, 500.
 */
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
        user_id: user.id,
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
