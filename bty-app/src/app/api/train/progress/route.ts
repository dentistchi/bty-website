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

function isoTodayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function addDaysISO(startISO: string, days: number) {
  const d = new Date(startISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "그 날짜의 05:00" (UTC 기준 임시)
function unlockTimeUTC(dayISO: string) {
  return new Date(dayISO + "T05:00:00Z").getTime();
}

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req as unknown as Request);
  if (!user) {
    return noStore(NextResponse.json({ ok: true, hasSession: false }, { status: 200 }));
  }

  const admin = getSupabaseAdmin();
  const today = isoTodayUTC();

  // 1) row 조회
  const { data: row, error: selErr } = await admin
    .from("train_progress")
    .select("user_id,start_date,last_completed_day,last_completed_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    return noStore(NextResponse.json({ ok: false, error: selErr.message }, { status: 200 }));
  }

  // 2) 없으면 생성 (Day1=오늘)
  if (!row) {
    const { data: ins, error: insErr } = await admin
      .from("train_progress")
      .insert({
        user_id: user.id,
        start_date: today,
        last_completed_day: 0,
      })
      .select("user_id,start_date,last_completed_day,last_completed_at,updated_at")
      .single();

    if (insErr) {
      return noStore(NextResponse.json({ ok: false, error: insErr.message }, { status: 200 }));
    }

    return noStore(
      NextResponse.json(
        {
          ok: true,
          hasSession: true,
          startDateISO: ins.start_date,
          lastCompletedDay: ins.last_completed_day,
          lastCompletedAt: ins.last_completed_at,
        },
        { status: 200 }
      )
    );
  }

  return noStore(
    NextResponse.json(
      {
        ok: true,
        hasSession: true,
        startDateISO: row.start_date,
        lastCompletedDay: row.last_completed_day ?? 0,
        lastCompletedAt: row.last_completed_at ?? null,
      },
      { status: 200 }
    )
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req as unknown as Request);
  if (!user) return noStore(NextResponse.json({ ok: false, error: "Auth required" }, { status: 200 }));

  const body = (await req.json().catch(() => ({}))) as { day?: number };
  const day = Number(body.day);
  if (!Number.isFinite(day) || day < 1 || day > 28) {
    return noStore(NextResponse.json({ ok: false, error: "invalid day" }, { status: 200 }));
  }

  const admin = getSupabaseAdmin();

  const { data: row, error: selErr } = await admin
    .from("train_progress")
    .select("user_id,start_date,last_completed_day,last_completed_at")
    .eq("user_id", user.id)
    .single();

  if (selErr || !row?.start_date) {
    return noStore(NextResponse.json({ ok: false, error: selErr?.message ?? "progress missing" }, { status: 200 }));
  }

  const startISO = row.start_date as string;
  const lastCompletedDay = Number(row.last_completed_day ?? 0);

  // 오늘(요청 day)의 날짜
  const dayISO = addDaysISO(startISO, day - 1);

  // 규칙: day=1이면 날짜 조건만, day>=2면 (이전 day 완료) AND (해당 day 05:00 이후)
  const now = Date.now();
  const dateOk = now >= unlockTimeUTC(dayISO);
  const prevOk = day === 1 ? true : lastCompletedDay >= day - 1;

  if (!dateOk) {
    return noStore(NextResponse.json({ ok: false, error: "locked_until_morning" }, { status: 200 }));
  }
  if (!prevOk) {
    return noStore(NextResponse.json({ ok: false, error: "previous_day_not_completed" }, { status: 200 }));
  }

  // 이미 완료한 날이면 그대로 반환
  if (day <= lastCompletedDay) {
    return noStore(NextResponse.json({ ok: true, already: true, lastCompletedDay }, { status: 200 }));
  }

  const { error: updErr } = await admin
    .from("train_progress")
    .update({ last_completed_day: day, last_completed_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (updErr) {
    return noStore(NextResponse.json({ ok: false, error: updErr.message }, { status: 200 }));
  }

  return noStore(NextResponse.json({ ok: true, lastCompletedDay: day }, { status: 200 }));
}
