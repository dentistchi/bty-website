import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // redirect 응답을 먼저 만들어야 setAll 쿠키가 redirect에 붙는다
  const res = NextResponse.redirect(new URL(next, url.origin));
  const supabase = getSupabaseServer(req, res);

  if (!supabase) {
    return NextResponse.redirect(new URL(`/login?error=server_not_configured`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  return res;
}
