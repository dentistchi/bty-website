"use client";

import { useState, useTransition } from "react";
import { getMessages, type Locale } from "@/lib/i18n";

/**
 * WHAT THIS COMPONENT NO LONGER DECIDES (Slice 3.2R-R9A).
 *
 * `const CONSENT_VERSION = "2026-05-v1"` used to live here — a browser constant was the only
 * statement anywhere of which agreement was in force, and the API stored whatever it sent. The
 * version now arrives as a prop, from the server, alongside the fingerprint of the document this
 * page actually rendered.
 *
 * These three fields are EVIDENCE OF WHAT WAS DISPLAYED, never authority over what may be
 * accepted. The server re-derives its own active document and refuses anything that does not
 * match — which is what stops a tab left open across a deploy from silently accepting a newer
 * agreement its reader never saw.
 */
export function AcceptClient({
  locale,
  returnUrl,
  consentVersion,
  consentLocale,
  documentFingerprint,
}: {
  locale: Locale;
  returnUrl: string;
  consentVersion: string;
  consentLocale: string;
  documentFingerprint: string;
}) {
  const m = getMessages(locale);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!checked) {
      setError(m.legal.accept.error_required);
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/legal/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent_version: consentVersion,
            consent_locale: consentLocale,
            document_fingerprint: documentFingerprint,
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            setError(m.legal.accept.error_rate_limit);
          } else if (res.status === 409) {
            /*
              THE DOCUMENT MOVED WHILE THIS TAB WAS OPEN (Slice 3.2R-R9A).

              The server refused because what this page rendered is no longer what it requires.
              Reloading is the whole remedy and the only honest one: it fetches the current
              agreement so the learner reads it before accepting. Converting their old click into
              acceptance of new text is exactly what must never happen.
            */
            window.location.reload();
          } else {
            setError(m.legal.accept.error_server);
          }
          return;
        }

        /*
          ONE HARD NAVIGATION, NOT push()+refresh() (Slice 3.2R-R8E).

          The app shell consumes a deep link ONCE on mount and then ERASES it from the URL with
          `history.replaceState`. `router.push` began that client-side transition and
          `router.refresh` immediately re-fetched the route still rendered underneath it — the
          consent page, which now sees consent present and server-redirects to the same
          destination. Two navigations to one URL, with the shell stripping the query between
          them: whichever arrived second landed on a bare `/{locale}/app` and fell back to the
          default surface. That is why accepting consent from the Center deep link dropped the
          learner on My Learning instead of their reflection.

          A full-page assign goes through middleware exactly once (consent is now satisfied),
          hands the untouched URL to a single fresh shell mount, and needs no refresh because
          nothing stale survives it. `returnUrl` is already sanitized server-side.
        */
        window.location.assign(returnUrl);
      } catch {
        setError(m.legal.accept.error_network);
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={isPending}
          className="mt-1 w-4 h-4"
        />
        <span className="text-sm">{m.legal.accept.checkbox_label}</span>
      </label>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!checked || isPending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition"
      >
        {isPending ? m.legal.accept.submitting : m.legal.accept.submit_button}
      </button>
    </div>
  );
}
