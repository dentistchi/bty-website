import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { jsonFrom } from "@/lib/next-response-json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const supabase = getSupabaseServer(req, res);
    if (!supabase) {
      return jsonFrom(res, { ok: false, error: "Supabase env missing (url/key)" }, 503);
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return jsonFrom(
        res,
        { ok: false, error: error.message, where: "supabase.auth.getUser()" },
        401
      );
    }

    return jsonFrom(res, { ok: true, user: data.user ?? null }, 200);
  } catch (e: any) {
    return jsonFrom(
      res,
      {
        ok: false,
        error: e?.message ?? String(e),
        where: "/api/auth/session GET",
      },
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const supabase = getSupabaseServer(req, res);
    if (!supabase) {
      return jsonFrom(res, { ok: false, error: "Server not configured" }, 503);
    }

    const body = (await req.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
    };

    const { access_token, refresh_token } = body;
    if (!access_token || !refresh_token) {
      return jsonFrom(res, { ok: false, error: "missing access_token/refresh_token" }, 400);
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return jsonFrom(res, { ok: false, error: error.message }, 401);
    }

    // ✅ 여기서 res에 set-cookie가 쌓였고 jsonFrom이 headers를 보존해서 내려줌
    return jsonFrom(res, { ok: true }, 200);
  } catch (e: any) {
    return jsonFrom(
      res,
      { ok: false, error: e?.message ?? String(e), where: "/api/auth/session POST" },
      500
    );
  }
}
