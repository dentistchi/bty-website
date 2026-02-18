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

function isoDateOnly(d = new Date()) {
  // UTC 기준 날짜만 필요할 때 사용(표준화 용도)
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return noStore(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));

  const admin = getSupabaseAdmin();
  if (!admin) return noStore(NextResponse.json({ ok: false, error: "server not configured" }, { status: 503 }));

  const { data, error } = await admin
    .from("train_progress")
    .select("start_date,last_completed_day,last_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return noStore(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
  }

  // 없으면 자동 생성(첫 시작일 = 오늘)
  if (!data) {
    const start = isoDateOnly(new Date());
    const { error: insErr } = await admin.from("train_progress").insert({
      user_id: user.id,
      start_date: start,
      last_completed_day: 0,
      last_completed_at: null,
    });
    if (insErr) return noStore(NextResponse.json({ ok: false, error: insErr.message }, { status: 500 }));

    return noStore(
      NextResponse.json({
        ok: true,
        startDateISO: start,
        lastCompletedDay: 0,
        lastCompletedAt: null,
      })
    );
  }

  return noStore(
    NextResponse.json({
      ok: true,
      startDateISO: data.start_date,
      lastCompletedDay: data.last_completed_day ?? 0,
      lastCompletedAt: data.last_completed_at ?? null,
    })
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return noStore(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));

  const admin = getSupabaseAdmin();
  if (!admin) return noStore(NextResponse.json({ ok: false, error: "server not configured" }, { status: 503 }));

  const body = (await req.json().catch(() => ({}))) as { day?: number };
  const day = Number(body.day);

  if (!Number.isFinite(day) || day < 1 || day > 28) {
    return noStore(NextResponse.json({ ok: false, error: "invalid day" }, { status: 400 }));
  }

  // 현재 progress 로드
  const { data: prog, error: progErr } = await admin
    .from("train_progress")
    .select("start_date,last_completed_day,last_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (progErr) return noStore(NextResponse.json({ ok: false, error: progErr.message }, { status: 500 }));
  if (!prog) {
    return noStore(NextResponse.json({ ok: false, error: "progress not initialized" }, { status: 400 }));
  }

  // "앞 day부터 순서대로만 완료" 강제
  const last = prog.last_completed_day ?? 0;
  if (day !== last + 1) {
    return noStore(
      NextResponse.json(
        { ok: false, error: `must complete day ${last + 1} next` },
        { status: 409 }
      )
    );
  }

  const now = new Date().toISOString();

  // completion 로그(중복 방지 pk)
  const { error: compErr } = await admin.from("train_day_completions").upsert({
    user_id: user.id,
    day,
    completed_at: now,
  });

  if (compErr) return noStore(NextResponse.json({ ok: false, error: compErr.message }, { status: 500 }));

  const { error: updErr } = await admin
    .from("train_progress")
    .update({ last_completed_day: day, last_completed_at: now })
    .eq("user_id", user.id);

  if (updErr) return noStore(NextResponse.json({ ok: false, error: updErr.message }, { status: 500 }));

  return noStore(NextResponse.json({ ok: true, day, completedAt: now }));
}
