import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const day = Number(body?.day);
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return NextResponse.json({ ok: false, error: "invalid day" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  await admin.from("train_day_completions").upsert({
    user_id: user.id,
    day,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
