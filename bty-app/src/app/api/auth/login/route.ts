import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.append("Vary", "Cookie");
  return res;
}

function copySetCookies(from: NextResponse, to: NextResponse) {
  // 1) Next.js(Node)에서 지원하는 경우(복수 Set-Cookie)
  const getter = (from.headers as any).getSetCookie?.bind(from.headers);
  if (getter) {
    const cookies: string[] = getter() || [];
    cookies.forEach((c) => to.headers.append("set-cookie", c));
    return;
  }

  // 2) 폴백: 단일 set-cookie만 있는 경우
  const single = from.headers.get("set-cookie");
  if (single) to.headers.append("set-cookie", single);
}

export async function POST(req: NextRequest) {
  // ✅ 쿠키를 심기 위한 "템플릿 응답"
  const cookieRes = noStore(NextResponse.json({ ok: false }, { status: 200 }));
  const supabase = getSupabaseServer(req, cookieRes);

  if (!supabase) {
    return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return noStore(NextResponse.json({ ok: false, error: "missing email or password" }, { status: 400 }));
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // ✅ 실패는 반드시 401
    return noStore(
      NextResponse.json(
        { ok: false, error: error?.message ?? "Invalid login credentials" },
        { status: 401 }
      )
    );
  }

  // ✅ 최종 응답(바디는 성공)
  const successRes = noStore(
    NextResponse.json(
      { ok: true, userId: data.user?.id ?? null, email: data.user?.email ?? null },
      { status: 200 }
    )
  );

  // ✅ cookieRes에 심긴 Set-Cookie를 successRes로 복사
  copySetCookies(cookieRes, successRes);

  return successRes;
}
