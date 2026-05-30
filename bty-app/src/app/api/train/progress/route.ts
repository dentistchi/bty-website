import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.append("Vary", "Cookie");
  return res;
}

/**
 * GET /api/train/progress
 * Returns progress pack: startDateISO, lastCompletedDay, completedDays, todayUnlockedDay, unlockedMaxDay.
 * Response (200): { ok, hasSession, startDateISO, lastCompletedDay, completedDays, todayUnlockedDay, unlockedMaxDay }.
 */
export async function GET(request: Request) {
  // ✅ 임시: startDateISO를 "오늘"로 (Day 1이 오늘이 되게)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const startDateISO = `${yyyy}-${mm}-${dd}`;

  // ✅ 규칙 반영(임시): 오늘은 Day1만 오픈 (보존 — unlock 계산 연결은 범위 밖)
  const todayUnlockedDay = 1;

  // 로그아웃 상태: 401 아님 — hasSession:false + 빈 진행상황 (클라이언트가 hasSession 체크)
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return noStore(
      NextResponse.json(
        {
          ok: true,
          hasSession: false,
          startDateISO,
          lastCompletedDay: 0,
          completedDays: [],
          todayUnlockedDay,
          unlockedMaxDay: todayUnlockedDay,
        },
        { status: 200 }
      )
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return noStore(
      NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 })
    );
  }

  // admin client는 RLS 우회 → user_id 명시 필터 필수
  const { data, error } = await admin
    .from("train_day_completions")
    .select("day")
    .eq("user_id", user.id)
    .order("day", { ascending: true });

  if (error) {
    console.error("[train/progress] select failed", error);
    return noStore(
      NextResponse.json({ ok: false, error: "progress read failed" }, { status: 500 })
    );
  }

  const completedDays: number[] = (data ?? [])
    .map((r) => Number((r as { day: number }).day))
    .sort((a, b) => a - b);
  const lastCompletedDay = completedDays.length ? Math.max(...completedDays) : 0;

  return noStore(
    NextResponse.json(
      {
        ok: true,
        hasSession: true,
        startDateISO,
        lastCompletedDay,
        completedDays,
        todayUnlockedDay,
        unlockedMaxDay: todayUnlockedDay, // TrainShell 매핑 호환
      },
      { status: 200 }
    )
  );
}
