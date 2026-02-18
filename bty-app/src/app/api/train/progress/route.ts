import { NextResponse } from "next/server";
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

function todayISO_UTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return noStore(NextResponse.json({ ok: true, hasSession: false }, { status: 200 }));

  const admin = getSupabaseAdmin();
  if (!admin) return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));

  // 1) start_date 가져오기 (없으면 생성)
  const { data: p0, error: pErr0 } = await admin
    .from("train_progress")
    .select("start_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr0) return noStore(NextResponse.json({ ok: false, error: pErr0.message }, { status: 500 }));

  let startDateISO = p0?.start_date ?? null;

  if (!startDateISO) {
    const start = todayISO_UTC();
    const { error: insErr } = await admin
      .from("train_progress")
      .insert({ user_id: user.id, start_date: start });

    if (insErr) {
      // 동시에 생성하는 경쟁 상황이면 다시 읽기
      const { data: p1, error: pErr1 } = await admin
        .from("train_progress")
        .select("start_date")
        .eq("user_id", user.id)
        .maybeSingle();
      if (pErr1 || !p1?.start_date) {
        return noStore(NextResponse.json({ ok: false, error: insErr.message }, { status: 500 }));
      }
      startDateISO = p1.start_date;
    } else {
      startDateISO = start;
    }
  }

  // 2) completions 가져오기
  const { data: rows, error: cErr } = await admin
    .from("train_completions")
    .select("day, completed_at")
    .eq("user_id", user.id);

  if (cErr) return noStore(NextResponse.json({ ok: false, error: cErr.message }, { status: 500 }));

  const completionsByDay: Record<string, string> = {};
  for (const r of rows ?? []) {
    completionsByDay[String(r.day)] = r.completed_at;
  }

  return noStore(
    NextResponse.json(
      {
        ok: true,
        hasSession: true,
        startDateISO,
        completionsByDay,
      },
      { status: 200 }
    )
  );
}
