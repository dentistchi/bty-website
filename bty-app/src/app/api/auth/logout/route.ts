import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// RFC1123 date for epoch
const EPOCH = "Thu, 01 Jan 1970 00:00:00 GMT";

function appendExpireCookie(
  res: NextResponse,
  name: string,
  path: "/" | "/api",
) {
  // OpenNext/Cloudflare에서 res.cookies.set()이 path를 /api로 바꾸는 케이스가 있어
  // Set-Cookie 문자열을 직접 append해서 Path=/ 삭제를 강제한다.
  const cookie = `${name}=; Path=${path}; Expires=${EPOCH}; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
  res.headers.append("Set-Cookie", cookie);
}

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true }, { status: 200 });
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
      appendExpireCookie(res, n, "/");
      appendExpireCookie(res, n, "/api");
    }

    res.headers.set("x-auth-logout-cookie-names", names.join(","));
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
