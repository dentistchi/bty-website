"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ArenaActionCompletedProps = {
  locale: Locale | string;
  /** Explicit, user-initiated advance — no auto-next. Triggers session reconcile. */
  onNext: () => void | Promise<void>;
  nextLoading?: boolean;
};

/**
 * STAB-06-FIX-03 (U3): terminal completion surface for a self-attest auto-approved
 * action. Replaces the stale QR gate once the contract is verified + run complete.
 * Progression happens only when the user taps "Next scenario".
 */
export function ArenaActionCompleted({ locale, onNext, nextLoading = false }: ArenaActionCompletedProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  return (
    <div
      data-testid="arena-action-completed"
      role="region"
      aria-label={t.arenaActionCompletedTitle}
      className="mt-[18px] rounded-2xl border border-bty-border bg-bty-surface/95 p-4 shadow-sm"
    >
      <h2 className="m-0 mb-2 text-lg font-semibold text-bty-navy">{t.arenaActionCompletedTitle}</h2>
      <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: "var(--arena-text-soft, #475569)" }}>
        {t.arenaActionCompletedLead}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="arena-action-completed-next"
          disabled={nextLoading}
          onClick={() => void Promise.resolve(onNext())}
          className="rounded-xl border border-bty-navy bg-bty-navy px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nextLoading ? t.eliteRunCompleteLoading : t.arenaActionCompletedNextCta}
        </button>
      </div>
    </div>
  );
}
