"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getMessages, type Locale } from "@/lib/i18n";
import { localeToBcp47 } from "@/lib/i18n/bcp47";

const CONSENT_VERSION = "2026-05-v1";

export function AcceptClient({ locale, returnUrl }: { locale: Locale; returnUrl: string }) {
  const m = getMessages(locale);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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

        router.push(returnUrl);
        router.refresh();
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
