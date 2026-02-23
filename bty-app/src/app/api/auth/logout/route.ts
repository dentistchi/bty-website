import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// RFC1123 date for epoch
const EPOCH = "Thu, 01 Jan 1970 00:00:00 GMT";

function appendExpireCookie(
  res: NextResponse,
  name: string,
  path: "/" | "/api" | "/en" | "/en/bty" | "/ko" | "/ko/bty",
) {
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
    const paths = ["/", "/api", "/en", "/en/bty", "/ko", "/ko/bty"] as const;

    for (const n of names) {
      for (const p of paths) {
        appendExpireCookie(res, n, p);
      }
    }

    res.headers.set("x-auth-logout-cookie-names", names.join(","));
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
