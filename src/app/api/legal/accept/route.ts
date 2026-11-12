import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCfClientIp } from "@/lib/rate-limit";
import {
  ACTIVE_CONSENT_VERSION,
  activeConsentDocument,
  isConsentLocale,
} from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";
import { isConsentCurrent } from "@/lib/legal/activeConsent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION_PATTERN = /^\d{4}-\d{2}-[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const locale = req.nextUrl.searchParams.get("locale");
  const document = isConsentLocale(locale) ? activeConsentDocument(locale) : null;
  const headers = { "Cache-Control": "private, no-store" };
  const res = document
    ? NextResponse.json({
        current: await isConsentCurrent(supabase, user.id),
        document,
        documentFingerprint: consentDocumentFingerprint(document),
      }, { headers })
    : NextResponse.json({ error: "invalid_consent_locale" }, { status: 400, headers });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const reply = (body: object, init?: ResponseInit) => {
    const res = NextResponse.json(body, init);
    copyCookiesAndDebug(base, res, req, true);
    return res;
  };

  let body: { consent_version?: unknown; consent_locale?: unknown; document_fingerprint?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const version = body?.consent_version;
  const locale = body?.consent_locale;
  if (typeof version !== "string" || !version) {
    return reply({ ok: false, error: "consent_version_required" }, { status: 400 });
  }
  if (version.length > 50 || !VERSION_PATTERN.test(version)) {
    return reply({ ok: false, error: "invalid_consent_version" }, { status: 400 });
  }
  if (!isConsentLocale(locale)) {
    return reply({ ok: false, error: "invalid_consent_locale" }, { status: 400 });
  }

  const document = activeConsentDocument(locale);
  const fingerprint = document ? consentDocumentFingerprint(document) : null;
  if (!document || version !== ACTIVE_CONSENT_VERSION || body?.document_fingerprint !== fingerprint) {
    return reply({
      ok: false,
      error: "consent_document_stale",
      active_consent_version: ACTIVE_CONSENT_VERSION,
    }, { status: 409 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return reply({ ok: false, error: "unavailable" }, { status: 503 });

  const ip = getCfClientIp(req);
  try {
    // The RPC applies the employee's rate limit and commits the audit row and profile together.
    const { data, error } = await admin.rpc("bty_accept_learner_consent", {
      p_user_id: user.id,
      p_version: version,
      p_locale: locale,
      p_fingerprint: fingerprint,
      p_placeholder: document.classification === "placeholder",
      p_ip_address: isIP(ip) ? ip : null,
      p_user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? "",
    });
    if (!error && data?.status === "accepted") {
      return reply({ ok: true, consent_version: version, redirect_to: null });
    }
    if (!error && data?.status === "rate_limited"
      && Number.isInteger(data.retryAfterSeconds) && data.retryAfterSeconds > 0) {
      return reply({
        error: "Too many requests. Please try again later.",
        retryAfterSeconds: data.retryAfterSeconds,
      }, {
        status: 429,
        headers: { "Retry-After": String(data.retryAfterSeconds) },
      });
    }
    console.error("[legal-accept] consent transaction failed", { code: error?.code ?? "unexpected_result" });
  } catch {
    console.error("[legal-accept] consent transaction unavailable");
  }
  return reply({ ok: false, error: "consent_not_recorded" }, { status: 500 });
}
