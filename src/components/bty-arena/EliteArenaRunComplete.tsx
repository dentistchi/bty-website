"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type EliteArenaRunCompleteProps = {
  locale: Locale | string;
  onContinue: () => void | Promise<void>;
  continueLoading?: boolean;
};

/**
 * End of run: single control to continue the loop — no narrative block.
 */
export function EliteArenaRunComplete({ locale, onContinue, continueLoading = false }: EliteArenaRunCompleteProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  return (
    <div
      data-testid="elite-run-complete"
      className="mt-2 space-y-3"
      role="region"
      aria-label={t.eliteRunCompleteRegionAria}
    >
      <p className="m-0 text-base font-medium leading-relaxed text-bty-navy">{t.eliteRunCompleteLine}</p>
      <p className="m-0 text-sm leading-relaxed text-bty-navy/80">{t.eliteRunCompletePrepareHint}</p>
      <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-testid="elite-run-complete-continue"
        disabled={continueLoading}
        onClick={() => void Promise.resolve(onContinue())}
        className="rounded-xl border border-bty-navy bg-bty-navy px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {continueLoading ? t.eliteRunCompleteLoading : t.eliteRunCompleteContinueCta}
      </button>
      </div>
    </div>
  );
}
