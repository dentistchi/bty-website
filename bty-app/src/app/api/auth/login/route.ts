import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "이메일/비밀번호가 필요합니다." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.headers
          .get("cookie")
          ?.split("; ")
          .find((c) => c.startsWith(name + "="))
          ?.split("=")[1];
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set({
          name,
          value,
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
          ...options,
        });
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({
          name,
          value: "",
          maxAge: 0,
          path: "/",
          ...options,
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 401 }
    );
  }

  return response;
}
