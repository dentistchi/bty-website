import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { jsonFrom } from "@/lib/next-response-json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const supabase = getSupabaseServer(req, res);
    if (!supabase) {
      return jsonFrom(res, { ok: false, error: "Server not configured" }, 503);
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return jsonFrom(res, { ok: false, error: "missing email/password" }, 400);
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return jsonFrom(res, { ok: false, error: error.message }, 401);
    }

    const session = data.session;
    const user = data.user;

    // signUp은 이메일 확인 설정에 따라 session이 없을 수 있음
    if (!session?.access_token || !session?.refresh_token) {
      return jsonFrom(
        res,
        {
          ok: true,
          needs_email_confirm: true,
          user: user ? { id: user.id, email: user.email } : null,
        },
        200
      );
    }

    return jsonFrom(
      res,
      {
        ok: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: user ? { id: user.id, email: user.email } : null,
      },
      200
    );
  } catch (e: any) {
    return jsonFrom(
      res,
      { ok: false, error: e?.message ?? String(e), where: "/api/auth/register" },
      500
    );
  }
}
