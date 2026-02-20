import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const EPOCH = "Thu, 01 Jan 1970 00:00:00 GMT";

function appendExpireCookie(res: NextResponse, name: string, path: "/" | "/api") {
  const cookie = `${name}=; Path=${path}; Expires=${EPOCH}; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
  res.headers.append("Set-Cookie", cookie);
}

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/bty";
  const redirectTo = new URL(`/bty/login?next=${encodeURIComponent(next)}`, req.url);

  const res = NextResponse.redirect(redirectTo, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Clear-Site-Data", '"cookies"');

  try {
    const supabase = await getSupabaseServer();
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut 실패해도 쿠키 삭제는 계속
    }
  } catch {
    // getSupabaseServer 실패해도 쿠키 삭제는 계속
  }

  const base = "sb-mveycersmqfiuddslnrj-auth-token";
  const names = [base, `${base}.0`, `${base}.1`, `${base}.2`, `${base}.3`];

  for (const n of names) {
    appendExpireCookie(res, n, "/");
    appendExpireCookie(res, n, "/api");
  }

  res.headers.set("x-auth-logout-cookie-names", names.join(","));
  return res;
}
