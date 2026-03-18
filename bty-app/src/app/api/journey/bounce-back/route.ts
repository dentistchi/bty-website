import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/journey/bounce-back — 복귀(comeback) 시 `bounce_back_count` +1 (XP·랭킹·시즌 무관).
 *
 * @contract
 * - **인증:** `Authorization: Bearer …` **또는** 세션 쿠키(`getAuthUserFromRequest`) — 둘 중 하나면 200 경로 가능.
 * - **200:** `{ bounce_back_count: number }`
 * - **401:** `{ error: "Unauthorized" }`
 * - **503:** `{ error: "Database not configured" }`
 * - **500:** `{ error: string }`
 *
 * @see docs/JOURNEY_BOUNCEBACK_IA.md · docs/spec/ARENA_DOMAIN_SPEC.md §4-11b
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

  const { data: profile } = await db
    .from("bty_profiles")
    .select("bounce_back_count, current_day, season")
    .eq("user_id", user.id)
    .single();

  const count = (profile?.bounce_back_count ?? 0) + 1;

  const { data, error } = await db
    .from("bty_profiles")
    .upsert(
      {
        user_id: user.id,
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
