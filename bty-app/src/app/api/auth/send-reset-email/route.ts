import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();

  const body = await req.json().catch(() => ({}));
  const email = body?.email;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const redirectTo = `${req.nextUrl.origin}/en/auth/callback?next=/en/my-page/account`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
