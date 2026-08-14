"use client";

import { useState, useTransition } from "react";
import { getMessages, type Locale } from "@/lib/i18n";
import { localeToBcp47 } from "@/lib/i18n/bcp47";

const CONSENT_VERSION = "2026-05-v1";

export function AcceptClient({ locale, returnUrl }: { locale: Locale; returnUrl: string }) {
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
            consent_version: CONSENT_VERSION,
            consent_locale: localeToBcp47(locale),
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            setError(m.legal.accept.error_rate_limit);
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
