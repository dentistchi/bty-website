"use client";

import Link from "next/link";
import React from "react";
import type { ArenaPendingContractPayload } from "@/lib/bty/arena/arenaSessionRouterClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ArenaPendingContractGateProps = {
  locale: Locale | string;
  contract: ArenaPendingContractPayload;
  onRetry: () => void;
  retryLoading?: boolean;
};

/**
 * Session router returned 409 `action_contract_pending` — render-only display of API contract fields.
 */
export function ArenaPendingContractGate({
  locale,
  contract,
  onRetry,
  retryLoading = false,
}: ArenaPendingContractGateProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  const deadlineRaw = typeof contract.deadline_at === "string" ? contract.deadline_at.trim() : "";
  const deadlineDisplay =
    deadlineRaw !== ""
      ? new Date(deadlineRaw).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <div
      data-testid="arena-pending-action-contract-gate"
      role="region"
      aria-label={t.arenaPendingContractRegionAria}
      className="mt-[18px] rounded-2xl border border-bty-border bg-bty-surface/95 p-4 shadow-sm"
    >
      <h2 className="m-0 mb-2 text-lg font-semibold text-bty-navy">{t.arenaPendingContractTitle}</h2>
      <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: "var(--arena-text-soft, #475569)" }}>
        {t.arenaPendingContractLead}
      </p>
      <dl className="m-0 space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-bty-navy">{t.arenaPendingContractActionLabel}</dt>
          <dd className="m-0 mt-1 whitespace-pre-wrap text-bty-navy/90">{contract.action_text}</dd>
        </div>
        <div>
          <dt className="font-semibold text-bty-navy">{t.arenaPendingContractDeadlineLabel}</dt>
          <dd className="m-0 mt-1 text-bty-navy/90">{deadlineDisplay}</dd>
        </div>
        <div>
          <dt className="font-semibold text-bty-navy">{t.arenaPendingContractVerificationLabel}</dt>
          <dd className="m-0 mt-1 text-bty-navy/90">{contract.verification_type || "—"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/${lang}/my-page?arena_contract=resolve`}
          className="inline-flex rounded-xl border border-bty-navy bg-bty-navy px-4 py-2 text-sm font-medium text-white no-underline transition-opacity hover:opacity-95"
          data-testid="arena-pending-contract-go-my-page"
        >
          {t.arenaPendingContractMyPageCta}
        </Link>
        <button
          type="button"
          data-testid="arena-pending-contract-retry"
          disabled={retryLoading}
          onClick={() => void Promise.resolve(onRetry())}
          className="rounded-xl border border-bty-border bg-bty-surface px-4 py-2 text-sm font-medium text-bty-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retryLoading ? t.eliteRunCompleteLoading : t.arenaPendingContractRetry}
        </button>
      </div>
    </div>
  );
}
