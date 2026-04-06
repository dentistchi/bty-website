"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ActionContractFollowupModalProps = {
  locale: Locale | string;
  contractId: string;
  onRecorded: () => void;
};

/**
 * Follow-up after action contract: did they start the conversation; if yes, first 30s (raw text).
 * Posted to POST /api/bty/action-contract/followup — not tied to scenario or pattern engine.
 */
export function ActionContractFollowupModal({
  locale,
  contractId,
  onRecorded,
}: ActionContractFollowupModalProps) {
  const t = getMessages(locale === "ko" ? "ko" : "en").arenaRun;
  const [started, setStarted] = React.useState<boolean | null>(null);
  const [first30, setFirst30] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(
    async (startedConversation: boolean, first30Seconds: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/bty/action-contract/followup", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId,
            startedConversation,
            ...(startedConversation ? { first30Seconds } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : t.actionContractFollowupError);
          return;
        }
        onRecorded();
      } catch {
        setError(t.actionContractFollowupError);
      } finally {
        setSubmitting(false);
      }
    },
    [contractId, onRecorded, t.actionContractFollowupError],
  );

  const onNo = React.useCallback(() => {
    void submit(false, "");
  }, [submit]);

  const onYesSubmit = React.useCallback(() => {
    void submit(true, first30);
  }, [submit, first30]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-contract-followup-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-bty-border bg-bty-surface p-5 shadow-xl">
        <h2 id="action-contract-followup-title" className="mt-0 text-lg font-semibold text-bty-navy">
          {t.actionContractFollowupTitle}
        </h2>
        <p className="text-sm leading-relaxed opacity-90">{t.actionContractFollowupLead}</p>

        {started === null ? (
          <div className="mt-4 space-y-3">
            <p className="m-0 text-sm font-medium text-bty-navy">{t.actionContractFollowupQuestion}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-bty-border bg-bty-surface px-4 py-2 text-sm font-medium text-bty-navy hover:bg-bty-soft/80 disabled:opacity-50"
                disabled={submitting}
                onClick={() => setStarted(true)}
              >
                {t.actionContractFollowupYes}
              </button>
              <button
                type="button"
                className="rounded-xl border border-bty-border bg-bty-surface px-4 py-2 text-sm font-medium text-bty-navy hover:bg-bty-soft/80 disabled:opacity-50"
                disabled={submitting}
                onClick={onNo}
              >
                {t.actionContractFollowupNo}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium opacity-85">
              {t.actionContractFollowupFirst30Label}
              <textarea
                value={first30}
                onChange={(e) => setFirst30(e.target.value)}
                placeholder={t.actionContractFollowupFirst30Placeholder}
                rows={4}
                className="mt-1 w-full resize-y rounded-xl border border-bty-border px-3 py-2 text-sm"
                disabled={submitting}
              />
            </label>
            <button
              type="button"
              className="w-full rounded-xl bg-bty-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={submitting}
              onClick={onYesSubmit}
            >
              {submitting ? t.actionContractFollowupSubmitting : t.actionContractFollowupSubmit}
            </button>
          </div>
        )}

        {error ? (
          <p className="mt-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
