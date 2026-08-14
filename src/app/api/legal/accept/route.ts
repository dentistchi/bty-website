import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getCfClientIp, rateLimitKV } from "@/lib/rate-limit";
import {
  ACTIVE_CONSENT_VERSION,
  activeConsentDocument,
  isConsentLocale,
} from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FORMAT IS NOT AUTHORIZATION (Slice 3.2R-R9A).
 *
 * This pattern was the ONLY check on the version, so `2099-12-anything` was a valid consent: it
 * matched, it was stored, and the presence-only gate then treated that user as consented forever.
 * It is kept as a cheap early rejection of malformed input, and the active-document comparison
 * below is what actually decides.
 */
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

  let body: { consent_version?: unknown; consent_locale?: unknown; document_fingerprint?: unknown };
  try {
    body = (await req.json()) as {
      consent_version?: unknown;
      consent_locale?: unknown;
      document_fingerprint?: unknown;
    };
  } catch {
    const res = NextResponse.json({ ok: false as const, error: "invalid_body" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const consent_version = typeof body.consent_version === "string" ? body.consent_version : "";
  const consent_locale = typeof body.consent_locale === "string" ? body.consent_locale : "";
  const document_fingerprint =
    typeof body.document_fingerprint === "string" ? body.document_fingerprint : "";

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
  if (!isConsentLocale(consent_locale)) {
    const res = NextResponse.json(
      { ok: false as const, error: "invalid_consent_locale" },
      { status: 400 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  /**
   * THE SERVER DECIDES WHAT MAY BE ACCEPTED (Slice 3.2R-R9A).
   *
   * Everything the client sent describes the document it RENDERED. None of it is authority. The
   * server re-derives its own active document for that locale and requires all three to agree:
   * version, locale, and the fingerprint of the exact prose.
   *
   * This is what makes a stale tab safe. Open the page under version A, deploy version B, submit:
   * the fields still describe A, they no longer match the active document, and the acceptance is
   * refused. Without it the row would have recorded B — an agreement that reader never saw.
   *
   * It also closes the invented-version hole: an old version, a future one, or a fabricated
   * `2099-12-anything` all fail the same comparison, because none of them is the active document.
   *
   * Fingerprint is matched against the document for the SUBMITTED locale, so a Korean fingerprint
   * can never be recorded as an English acceptance.
   */
  const activeDoc = activeConsentDocument(consent_locale);
  const activeFingerprint = activeDoc ? consentDocumentFingerprint(activeDoc) : null;
  if (
    !activeDoc ||
    consent_version !== ACTIVE_CONSENT_VERSION ||
    document_fingerprint !== activeFingerprint
  ) {
    const res = NextResponse.json(
      {
        ok: false as const,
        error: "consent_document_stale",
        // What the client must re-render before a fresh attempt. No prose, only identity.
        active_consent_version: ACTIVE_CONSENT_VERSION,
      },
      { status: 409 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? "";
  const acceptedAt = new Date().toISOString();

  /**
   * WRITE ORDER IS THE INTEGRITY MECHANISM (Slice 3.2R-R9A).
   *
   * IT USED TO BE BACKWARDS. The profile was marked consented FIRST and the audit row was written
   * after, best-effort — a failed insert only logged a warning and the API still answered 200
   * (test-locked as "returns 200 even when audit INSERT fails"). That is access granted with no
   * durable evidence of consent, which is the one outcome a consent ledger exists to prevent.
   *
   * EVIDENCE FIRST, THEN ACCESS. The immutable audit event is written before the profile is
   * allowed to say "consented":
   *
   *   1. active document identity proven (above)   2. INSERT audit   3. UPSERT profile   4. 200
   *
   * WHY THIS ORDER IS SAFE WITHOUT A TRANSACTION. There are exactly two partial states, and both
   * are honest:
   *
   *   audit fails            → nothing else runs. No profile change, non-200, user still gated.
   *   audit ok, upsert fails → non-200 and the user stays gated, so no access was granted. The
   *                            audit row remains, and it is TRUE: this user did accept this exact
   *                            document at this moment. Retrying appends a second true event and
   *                            eventually sets the profile.
   *
   * The failure this order cannot produce is the dangerous one — a profile claiming consent with
   * no evidence behind it. The residue it can produce is a duplicate audit event, which this
   * domain already treats as harmless: one account legitimately carries 12 rows for a single
   * version, each a real acceptance with its own timestamp and IP. No uniqueness constraint is
   * added, so a retry can never be refused by the database.
   *
   * No RPC is introduced. Atomicity would only be needed to prevent an evidence-free profile, and
   * ordering already prevents it — a stored procedure here would add a schema object to buy
   * nothing this sequence does not already guarantee.
   */
  const { error: insertErr } = await supabase.from("arena_consent_log").insert({
    user_id: user.id,
    consent_type: "tos",
    consent_version,
    consent_locale,
    action: "accepted",
    ip_address: ip,
    user_agent: userAgent,
    accepted_at: acceptedAt,
    /*
      PLACEHOLDER IS DERIVED, NOT ASSERTED. This was hardcoded `placeholder: true`, so a final
      legal acceptance would have been filed as a placeholder one. It now reads the document's own
      classification, and the fingerprint of the exact prose is recorded beside it — the field the
      13 `2026-05-pending-v1` rows never had, and the reason they cannot prove what they showed.
      `sprint` is kept: it is genuine provenance for the placeholder era.
    */
    notes: {
      sprint: "AL-LAUNCH-D3",
      placeholder: activeDoc.classification === "placeholder",
      documentFingerprint: document_fingerprint,
    },
  });

  if (insertErr) {
    console.error("[legal-accept] audit INSERT failed — refusing to grant consent:", insertErr);
    const res = NextResponse.json(
      { ok: false as const, error: "consent_not_recorded" },
      { status: 500 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  // Upsert (not update): a brand-new user has no arena_profiles row yet, so a
  // bare .update() was a silent no-op and consent never persisted (DIAG-02).
  // Payload is restricted to the 3 consent columns + user_id (conflict key);
  // every other column is left for the DB NOT NULL DEFAULTs on insert, so XP
  // initialization by applyCoreXp stays intact (DIAG-03).
  const { data: upsertRows, error: upsertErr } = await supabase
    .from("arena_profiles")
    .upsert(
      {
        user_id: user.id,
        consent_version,
        consent_accepted_at: acceptedAt,
        consent_locale,
      },
      { onConflict: "user_id" },
    )
    .select("user_id, consent_version");

  if (upsertErr) {
    console.error("[legal-accept] UPSERT error:", upsertErr);
    const res = NextResponse.json(
      { ok: false as const, error: "database_error" },
      { status: 500 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  // Confirm the consent actually landed before reporting ok:true — guards
  // against a false-success response if the write affected no row.
  const savedRow = upsertRows?.[0];
  if (!savedRow || savedRow.consent_version !== consent_version) {
    console.error("[legal-accept] UPSERT returned no confirmed row", {
      userId: user.id,
      rowCount: upsertRows?.length ?? 0,
    });
    const res = NextResponse.json(
      { ok: false as const, error: "consent_not_persisted" },
      { status: 500 },
    );
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const res = NextResponse.json({
    ok: true as const,
    consent_version,
    redirect_to: null,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
