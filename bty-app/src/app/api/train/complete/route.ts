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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeUnlockedMaxDay(args: {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAtISO: string | null;
  totalDays?: number;
}) {
  const totalDays = args.totalDays ?? 28;
  const today = todayISO();

  let dateBasedMax = 0;
  for (let day = 1; day <= totalDays; day++) {
    const dayDate = addDaysISO(args.startDateISO, day - 1);
    if (dayDate <= today) dateBasedMax = day;
    else break;
  }

  let completionBasedMax = Math.max(args.lastCompletedDay, 0);

  if (args.lastCompletedDay === 0) {
    completionBasedMax = 1;
  } else {
    const lastDoneDateISO = args.lastCompletedAtISO
      ? args.lastCompletedAtISO.slice(0, 10)
      : null;

    if (lastDoneDateISO) {
      const nextOpenDateISO = addDaysISO(lastDoneDateISO, 1);
      completionBasedMax = today >= nextOpenDateISO ? args.lastCompletedDay + 1 : args.lastCompletedDay;
    }
  }

  const unlockedMaxDay = Math.min(dateBasedMax, completionBasedMax, totalDays);
  return Math.max(unlockedMaxDay, 1);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return noStore(NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }));
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));
  }

  const body = (await req.json().catch(() => ({}))) as { day?: number };
  const day = Number(body.day);

  if (!Number.isFinite(day) || day < 1 || day > 28) {
    return noStore(NextResponse.json({ ok: false, error: "Invalid day" }, { status: 400 }));
  }

  const uid = user.id;

  // progress row 확보 (없으면 생성)
  const { data: existing, error: selErr } = await admin
    .from("train_progress")
    .select("user_id, start_date, last_completed_day, last_completed_at")
    .eq("user_id", uid)
    .maybeSingle();

  if (selErr) {
    return noStore(NextResponse.json({ ok: false, error: selErr.message }, { status: 500 }));
  }

  let startDateISO = existing?.start_date ?? todayISO();
  let lastCompletedDay = existing?.last_completed_day ?? 0;

  // ✅ "오늘 오픈된 day만 완료 허용" 같은 강제 룰도 여기서 가능하지만,
  // 지금은 단순: 더 큰 day로만 갱신(되돌리기 방지)
  const nextLast = Math.max(lastCompletedDay, day);

  const nowISO = new Date().toISOString();
  const { error: upErr } = await admin
    .from("train_progress")
    .upsert(
      {
        user_id: uid,
        start_date: startDateISO,
        last_completed_day: nextLast,
        last_completed_at: nowISO,
        updated_at: nowISO,
      },
      { onConflict: "user_id" }
    );

  if (upErr) {
    return noStore(NextResponse.json({ ok: false, error: upErr.message }, { status: 500 }));
  }

  // 최신값 재조회
  const { data: row, error: reErr } = await admin
    .from("train_progress")
    .select("start_date, last_completed_day, last_completed_at")
    .eq("user_id", uid)
    .single();

  if (reErr) {
    return noStore(NextResponse.json({ ok: false, error: reErr.message }, { status: 500 }));
  }

  const unlockedMaxDay = computeUnlockedMaxDay({
    startDateISO: row.start_date,
    lastCompletedDay: row.last_completed_day ?? 0,
    lastCompletedAtISO: row.last_completed_at ? String(row.last_completed_at) : null,
    totalDays: 28,
  });

  return noStore(
    NextResponse.json(
      {
        ok: true,
        day,
        progress: {
          startDateISO: row.start_date,
          lastCompletedDay: row.last_completed_day ?? 0,
          lastCompletedAt: row.last_completed_at ? String(row.last_completed_at) : null,
          unlockedMaxDay,
        },
      },
      { status: 200 }
    )
  );
}
