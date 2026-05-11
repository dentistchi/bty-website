import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const ip = getCfClientIp(req);
  const rl = await rateLimitKV({
    endpoint: "register",
    identifier: ip,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many registration attempts. Please try again later.",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  try {
    const supabase = await getSupabaseServer();

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "missing email/password" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 401 }
      );
    }

    const session = data.session;
    const user = data.user;

    // signUp은 이메일 확인 설정에 따라 session이 없을 수 있음
    if (!session?.access_token || !session?.refresh_token) {
      return NextResponse.json(
        {
          ok: true,
          needs_email_confirm: true,
          user: user ? { id: user.id, email: user.email } : null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: user ? { id: user.id, email: user.email } : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e), where: "/api/auth/register" },
      { status: 500 }
    );
  }
}
