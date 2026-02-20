import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function expire(res: NextResponse, name: string, path: "/" | "/api") {
  res.cookies.set(name, "", {
    path,
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Clear-Site-Data", '"cookies"');

    const supabase = await getSupabaseServer();
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut 실패해도 쿠키 삭제는 계속
    }

    const base = "sb-mveycersmqfiuddslnrj-auth-token";
    const names = [base, `${base}.0`, `${base}.1`, `${base}.2`, `${base}.3`];

    for (const n of names) {
      expire(res, n, "/");
      expire(res, n, "/api");
    }

    res.headers.set("x-auth-logout-cookie-names", names.join(","));

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
