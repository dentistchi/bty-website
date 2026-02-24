import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { expireAuthCookiesHard } from "@/lib/bty/cookies/authCookies";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    expireAuthCookiesHard(req, res);
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 });
  }
}
