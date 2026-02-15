export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const DEBUG_SESSION = process.env.NODE_ENV !== "production";

export function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    const body: { ok: false; message: string; _debug?: { hasUrl: boolean; hasAnon: boolean } } = {
      ok: false,
      message: "Supabase env가 설정되지 않았습니다.",
    };
    if (process.env.NODE_ENV !== "production") body._debug = { hasUrl: !!supabaseUrl, hasAnon: !!supabaseAnonKey };
    return NextResponse.json(body, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });

  const isProd = process.env.NODE_ENV === "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set({
          name,
          value,
          path: "/",
          ...(isProd && { secure: true, sameSite: "lax" as const }),
          ...options,
        });
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value: "", maxAge: 0, path: "/", ...options });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email: email ?? "", password: password ?? "" });
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
  }

  if (!DEBUG_SESSION) return response;
  const out = NextResponse.json({ ok: true as const, session: !!data?.session });
  const setCookies = response.headers.getSetCookie?.();
  if (Array.isArray(setCookies)) for (const v of setCookies) out.headers.append("set-cookie", v);
  else return response;
  return out;
}
