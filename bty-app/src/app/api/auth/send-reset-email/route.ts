import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { rateLimitKV } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = body?.email;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();
  const rl = await rateLimitKV({
    endpoint: "send-reset-email",
    identifier: normalized,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many reset attempts for this email. Please try again later.",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  const supabase = await getSupabaseServer();

  const redirectTo = `${req.nextUrl.origin}/en/auth/callback?next=/en/my-page/account`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
