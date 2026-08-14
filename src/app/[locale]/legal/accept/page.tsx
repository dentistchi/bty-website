import { redirect } from "next/navigation";
import { type Locale } from "@/lib/i18n";
import { localeToBcp47 } from "@/lib/i18n/bcp47";
import { getSupabaseServer } from "@/lib/supabase-server";
import { AcceptClient } from "./AcceptClient";
import { ConsentDocumentView } from "./ConsentDocumentView";
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import { activeConsentDocument, consentSatisfied } from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";

export const dynamic = "force-dynamic";

export default async function LegalAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const { locale } = await params;
  const { return: returnUrl } = await searchParams;

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/bty/login`);
  }

  const { data: prof } = await supabase
    .from("arena_profiles")
    .select("consent_version")
    .eq("user_id", user.id)
    .maybeSingle();

  /*
    OPEN REDIRECT (Slice 3.2R-R8E). This was `returnUrl.startsWith("/")`, which accepts
    `//evil.com` — a protocol-relative URL that starts with "/" and navigates straight off
    origin. `?return=//evil.com` on a consent link was an open redirect through the one screen
    every authenticated user is forced through.

    `sanitizeNextForRedirect` is the repository's existing single source of truth for exactly
    this: it blocks `//`, backslashes, `://` and login loops, and falls back to `/{locale}/bty`
    — the same fallback this line already used. Two safe-return utilities existed and this page
    used neither.
  */
  const safeReturn = sanitizeNextForRedirect(returnUrl, { locale: locale === "ko" ? "ko" : "en" });

  /*
    EXACT EQUALITY, NOT PRESENCE (Slice 3.2R-R9A). This read `prof?.consent_version` — any truthy
    value short-circuited the screen — so a learner holding an older version would have been sent
    straight back to their destination without ever seeing the current document. The gate and this
    page must answer the same question, or the middleware would bounce them here and this line
    would bounce them away again, forever.
  */
  if (consentSatisfied(prof?.consent_version)) {
    redirect(safeReturn);
  }

  /*
    THE DOCUMENT ACTUALLY RENDERED, and its identity, travel together to the client — which sends
    them back on acceptance. That is what makes a stale tab detectable: the server compares what
    was SHOWN against what is active now, instead of assuming they are the same thing.
  */
  const consentLocale = localeToBcp47(locale);
  const doc = activeConsentDocument(consentLocale);
  if (!doc) {
    // A locale we do not publish must never fall back to another language's agreement.
    redirect(`/${locale}/bty`);
  }
  const fingerprint = consentDocumentFingerprint(doc);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow p-8">
        <ConsentDocumentView doc={doc} />

        <div className="mt-6">
          <AcceptClient
            locale={locale}
            returnUrl={safeReturn}
            consentVersion={doc.version}
            consentLocale={doc.locale}
            documentFingerprint={fingerprint}
          />
        </div>
      </div>
    </main>
  );
}
