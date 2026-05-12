import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getCfClientIp, rateLimitKV } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LOCALES = new Set<string>(["en-US", "ko-KR"]);
const VERSION_PATTERN = /^\d{4}-\d{2}-[a-z0-9\-]+$/;

export async function POST(req: NextRequest) {
  const ip = getCfClientIp(req);
  const rl = await rateLimitKV({
    endpoint: "legal-accept",
    identifier: ip,
    limit: 5,
    windowSeconds: 900,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { consent_version?: unknown; consent_locale?: unknown };
  try {
    body = (await req.json()) as { consent_version?: unknown; consent_locale?: unknown };
  } catch {
    const res = NextResponse.json({ ok: false as const, error: "invalid_body" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const consent_version = typeof body.consent_version === "string" ? body.consent_version : "";
  const consent_locale = typeof body.consent_locale === "string" ? body.consent_locale : "";

  if (!consent_version) {
    const res = NextResponse.json(
      { ok: false as const, error: "consent_version_required" },
      { status: 400 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
  if (consent_version.length > 50 || !VERSION_PATTERN.test(consent_version)) {
    const res = NextResponse.json(
      { ok: false as const, error: "invalid_consent_version" },
      { status: 400 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
  if (!ALLOWED_LOCALES.has(consent_locale)) {
    const res = NextResponse.json(
      { ok: false as const, error: "invalid_consent_locale" },
      { status: 400 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? "";
  const acceptedAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("arena_profiles")
    .update({
      consent_version,
      consent_accepted_at: acceptedAt,
      consent_locale,
    })
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[legal-accept] UPDATE error:", updateErr);
    const res = NextResponse.json(
      { ok: false as const, error: "database_error" },
      { status: 500 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const { error: insertErr } = await supabase.from("arena_consent_log").insert({
    user_id: user.id,
    consent_type: "tos",
    consent_version,
    consent_locale,
    action: "accepted",
    ip_address: ip,
    user_agent: userAgent,
    notes: { sprint: "AL-LAUNCH-D3", placeholder: true },
  });

  if (insertErr) {
    console.warn("[legal-accept] audit INSERT error:", insertErr);
  }

  const res = NextResponse.json({
    ok: true as const,
    consent_version,
    redirect_to: null,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
