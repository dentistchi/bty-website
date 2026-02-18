import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.append("Vary", "Cookie");
  return res;
}

export async function GET() {
  // ✅ 임시: startDateISO를 "오늘"로 (Day 1이 오늘이 되게)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const startDateISO = `${yyyy}-${mm}-${dd}`;

  // ✅ 임시 진행상황
  const lastCompletedDay = 0;
  const completedDays: number[] = [];

  // ✅ 규칙 반영(임시): 오늘은 Day1만 오픈
  const todayUnlockedDay = 1;

  return noStore(
    NextResponse.json(
      {
        ok: true,
        hasSession: true, // 임시: DB 없이도 화면 표시용 (클라이언트가 hasSession 체크)
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
