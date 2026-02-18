import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOTAL_DAYS = 28;
const OPEN_HOUR_UTC = 5; // 서버 기준(UTC) 5시. 나중에 사용자 timezone으로 확장 가능

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.append("Vary", "Cookie");
  return res;
}

function dateAtOpenHourUTC(startDateISO: string) {
  // YYYY-MM-DDT05:00:00Z
  return new Date(`${startDateISO}T${String(OPEN_HOUR_UTC).padStart(2, "0")}:00:00.000Z`);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return noStore(NextResponse.json({ ok: false, error: "Auth session missing!" }, { status: 401 }));

  const admin = getSupabaseAdmin();
  if (!admin) return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));

  const body = (await request.json().catch(() => ({}))) as { day?: number };
  const day = Number(body.day);

  if (!Number.isFinite(day) || day < 1 || day > TOTAL_DAYS) {
    return noStore(NextResponse.json({ ok: false, error: "invalid day" }, { status: 400 }));
  }

  // 1) start_date
  const { data: p, error: pErr } = await admin
    .from("train_progress")
    .select("start_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr) return noStore(NextResponse.json({ ok: false, error: pErr.message }, { status: 500 }));
  if (!p?.start_date) {
    return noStore(NextResponse.json({ ok: false, error: "progress missing (start_date)" }, { status: 400 }));
  }

  const startOpen = dateAtOpenHourUTC(p.start_date);
  const now = new Date();

  // 2) completions
  const { data: rows, error: cErr } = await admin
    .from("train_completions")
    .select("day, completed_at")
    .eq("user_id", user.id);

  if (cErr) return noStore(NextResponse.json({ ok: false, error: cErr.message }, { status: 500 }));

  const completionsByDay: Record<number, string> = {};
  for (const r of rows ?? []) completionsByDay[r.day] = r.completed_at;

  // 이미 완료면 OK 반환 (idempotent)
  if (completionsByDay[day]) {
    return noStore(NextResponse.json({ ok: true, day, alreadyCompleted: true }, { status: 200 }));
  }

  // 3) 서버가 "지금 완료 가능한 day"를 계산하고, 요청 day가 그 day인지 검증
  // 기본: calendar gate (start_date 기준 day-1일 지난 뒤 open hour 이후)
  const calendarUnlockAt = addDays(startOpen, day - 1);

  // prev gate: 전날 완료 + 다음날 OPEN_HOUR 이후
  let prevUnlockAt = calendarUnlockAt;
  if (day > 1) {
    const prevCompletedAtISO = completionsByDay[day - 1];
    if (!prevCompletedAtISO) {
      return noStore(
        NextResponse.json({ ok: false, error: "prev day not completed" }, { status: 409 })
      );
    }
    const prevCompletedAt = new Date(prevCompletedAtISO);
    // "완료 다음날 05:00Z"
    const prevNextMorning = new Date(prevCompletedAt);
    prevNextMorning.setUTCDate(prevNextMorning.getUTCDate() + 1);
    prevNextMorning.setUTCHours(OPEN_HOUR_UTC, 0, 0, 0);
    prevUnlockAt = prevNextMorning;
  }

  const unlockAt = maxDate(calendarUnlockAt, prevUnlockAt);

  if (now < unlockAt) {
    return noStore(
      NextResponse.json(
        {
          ok: false,
          error: "locked",
          unlockAtISO: unlockAt.toISOString(),
        },
        { status: 423 }
      )
    );
  }

  // 4) 완료 저장
  const { error: insErr } = await admin
    .from("train_completions")
    .insert({ user_id: user.id, day, completed_at: now.toISOString() });

  if (insErr) return noStore(NextResponse.json({ ok: false, error: insErr.message }, { status: 500 }));

  return noStore(NextResponse.json({ ok: true, day, completedAt: now.toISOString() }, { status: 200 }));
}
