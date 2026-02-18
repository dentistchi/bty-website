import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.append("Vary", "Cookie");
  return res;
}

// YYYY-MM-DD (서버 기준)
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// unlockedMaxDay 계산 (1~28)
function computeUnlockedMaxDay(args: {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAtISO: string | null;
  totalDays?: number;
}) {
  const totalDays = args.totalDays ?? 28;

  const today = todayISO();

  // 시간 조건으로 "오늘 기준 몇일까지 날짜가 도달했나"
  // start_date가 오늘이면 day1만 날짜상 도달
  let dateBasedMax = 0;
  for (let day = 1; day <= totalDays; day++) {
    const dayDate = addDaysISO(args.startDateISO, day - 1);
    if (dayDate <= today) dateBasedMax = day;
    else break;
  }

  // 완료 조건으로 "다음날 열림" 규칙 적용
  // 기본적으로 lastCompletedDay까지는 항상 열림
  let completionBasedMax = Math.max(args.lastCompletedDay, 0);

  // 다음 날(= lastCompletedDay + 1)을 열 수 있는지
  // 조건: 오늘 날짜가 lastCompletedAt의 '날짜' + 1 이상이어야 함
  // lastCompletedAt이 없으면 (완료한 적 없음) day1만 completion gate 가능
  if (args.lastCompletedDay === 0) {
    // 시작 day는 completion gate가 아니라 "처음 진입"용으로 열어두기 위해
    completionBasedMax = 1; // day1 접근은 허용
  } else {
    const lastDoneDateISO = args.lastCompletedAtISO
      ? args.lastCompletedAtISO.slice(0, 10)
      : null;

    if (lastDoneDateISO) {
      const nextOpenDateISO = addDaysISO(lastDoneDateISO, 1);
      if (today >= nextOpenDateISO) {
        completionBasedMax = args.lastCompletedDay + 1;
      } else {
        completionBasedMax = args.lastCompletedDay; // 오늘 완료했으면 내일 전까지 잠금
      }
    }
  }

  const unlockedMaxDay = Math.min(dateBasedMax, completionBasedMax, totalDays);
  return Math.max(unlockedMaxDay, 1);
}

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return noStore(NextResponse.json({ ok: true, hasSession: false }, { status: 200 }));
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));
  }

  // ✅ 없으면 생성(upsert)
  const uid = user.id;
  const { data: existing, error: selErr } = await admin
    .from("train_progress")
    .select("user_id, start_date, last_completed_day, last_completed_at")
    .eq("user_id", uid)
    .maybeSingle();

  if (selErr) {
    return noStore(NextResponse.json({ ok: false, error: selErr.message }, { status: 500 }));
  }

  let row = existing;

  // start_date를 "오늘"로 강제(네 요구: Day1 = 오늘 시작)
  // 이미 데이터가 있으면 유지할지/오늘로 리셋할지 정책이 필요하지만
  // 지금은 "오늘이 1일"이 목표니까: 데이터가 없으면 오늘 생성
  if (!row) {
    const startDateISO = todayISO();
    const { data: up, error: upErr } = await admin
      .from("train_progress")
      .upsert(
        {
          user_id: uid,
          start_date: startDateISO,
          last_completed_day: 0,
          last_completed_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("user_id, start_date, last_completed_day, last_completed_at")
      .single();

    if (upErr) {
      return noStore(NextResponse.json({ ok: false, error: upErr.message }, { status: 500 }));
    }
    row = up;
  }

  const startDateISO = row.start_date; // date
  const lastCompletedDay = row.last_completed_day ?? 0;
  const lastCompletedAtISO = row.last_completed_at ? String(row.last_completed_at) : null;

  const unlockedMaxDay = computeUnlockedMaxDay({
    startDateISO,
    lastCompletedDay,
    lastCompletedAtISO,
    totalDays: 28,
  });

  return noStore(
    NextResponse.json(
      {
        ok: true,
        hasSession: true,
        startDateISO,
        lastCompletedDay,
        lastCompletedAt: lastCompletedAtISO,
        unlockedMaxDay,
      },
      { status: 200 }
    )
  );
}
