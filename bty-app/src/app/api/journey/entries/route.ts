import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/journey/entries — BTY 일차 엔트리 조회 (`bty_day_entries`).
 *
 * @contract
 * - **Auth:** 401 `{ error: "Unauthorized" }`.
 * - **Query:** `day` 생략 → 200 전체 배열(오름차순). `day=1..28` → 200 단일 행 또는 `null`(없음).
 * - **400:** `day`가 범위 밖 → `{ error: "Invalid day" }`.
 * - **503:** `{ error: "Database not configured" }` (admin 클라이언트 없음).
 * - **500:** `{ error: string }` (Supabase 조회 실패; PGRST116 단건 미존재는 200 null).
 * - **확장 필드:** `select("*")` — `bty_day_entries` 스키마 추가 시 응답 키 확장; 클라는 미지 키 무시.
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
 * POST /api/journey/entries — 일차 upsert (`user_id`+`day` 고유).
 *
 * @contract
 * - **Auth:** 401 `{ error: "Unauthorized" }`.
 * - **Body (JSON):** `day` 1–28(미지정·비숫자 시 1로 클램프). `completed` boolean, `mission_checks` number[],
 *   `reflection_text` string(빈 문자열→null). 잘못된 JSON → `{}` 처리.
 * - **200:** upsert된 행 전체(테이블 스키마).
 * - **503:** `{ error: "Database not configured" }`.
 * - **500:** `{ error: string }` (upsert 실패).
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
