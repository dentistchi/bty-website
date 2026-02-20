import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function expireCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAge: 0,
  });
}

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });

    const supabase = await getSupabaseServer();
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut 실패해도 쿠키 삭제는 계속 진행
    }

    // sb-* 쿠키 이름들 강제 만료 (프로젝트 ref 등 변형 포함)
    expireCookie(res, "sb-mveycersmqfiuddslnrj-auth-token");
    expireCookie(res, "sb-mveycersmqfiuddslnrj-refresh-token");
    expireCookie(res, "sb-access-token");
    expireCookie(res, "sb-refresh-token");

    res.headers.set("Cache-Control", "no-store");

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
