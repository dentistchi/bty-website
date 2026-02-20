import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();

  const body = await req.json().catch(() => ({}));
  const password = body?.password;

  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // 세션 확인 (callback을 통해 세션이 생성되어 있어야 함)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json(
      { ok: false, error: "no session", detail: userErr?.message ?? null },
      { status: 401 }
    );
  }

  // 비밀번호 리셋
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      userId: data.user?.id ?? userData.user.id,
      email: data.user?.email ?? userData.user.email ?? null,
    },
    { status: 200 }
  );
}
