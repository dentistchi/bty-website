import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { sanitizeNext } from "@/lib/sanitize-next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickNext(req: NextRequest) {
  const u = new URL(req.url);
  return sanitizeNext(u.searchParams.get("next"));
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    // 쿠키가 아직 반영 안 됐거나 세션 없음
    const login = new URL("/bty/login", req.url);
    login.searchParams.set("next", pickNext(req));
    login.searchParams.set("e", "no_session");
    return NextResponse.redirect(login);
  }

  // ✅ 여기까지 오면 "쿠키 포함 요청"으로 유저 확인 완료
  const dest = pickNext(req);
  return NextResponse.redirect(new URL(dest, req.url));
}
