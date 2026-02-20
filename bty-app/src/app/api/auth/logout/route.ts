import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut 실패해도 아래에서 sb-* 쿠키 제거하면 로그아웃으로 동작
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });

    // 쿠키 누적 방지: 요청에 실린 sb-* 쿠키 전부 만료 처리
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookieNames = cookieHeader
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split("=")[0])
      .filter((name): name is string => !!name && name.startsWith("sb-"));

    const uniq = Array.from(new Set(cookieNames));
    for (const name of uniq) {
      res.cookies.set(name, "", {
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
        maxAge: 0,
      });
    }

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
