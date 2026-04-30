"use client";

import Link from "next/link";
import React from "react";
import type { ArenaPendingContractPayload } from "@/lib/bty/arena/arenaSessionRouterClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ArenaPendingContractGateProps = {
  locale: Locale | string;
  contract: ArenaPendingContractPayload;
  runtimeState?: "ACTION_REQUIRED" | "ACTION_SUBMITTED" | "ACTION_AWAITING_VERIFICATION" | null;
  onRetry: () => void;
  retryLoading?: boolean;
  qrAllowed?: boolean;
  onCompleteByQr?: () => void;
  qrLoading?: boolean;
};

/**
 * Session router returned 409 `action_contract_pending` — render-only display of API contract fields.
 */
export function ArenaPendingContractGate({
  locale,
  contract,
  runtimeState = null,
  onRetry,
  retryLoading = false,
  qrAllowed = false,
  onCompleteByQr,
  qrLoading = false,
}: ArenaPendingContractGateProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const actionT = getMessages(lang).actionContract;

  const deadlineRaw = typeof contract.deadline_at === "string" ? contract.deadline_at.trim() : "";
  const deadlineDisplay =
    deadlineRaw !== ""
      ? new Date(deadlineRaw).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  const canonicalLabel =
    runtimeState === "ACTION_SUBMITTED"
      ? "ACTION_SUBMITTED"
      : runtimeState === "ACTION_AWAITING_VERIFICATION"
        ? "ACTION_AWAITING_VERIFICATION"
        : "ACTION_REQUIRED";
  const canonicalLead =
    runtimeState === "ACTION_SUBMITTED"
      ? "Evidence submitted. Verification is still required before next scenario."
      : runtimeState === "ACTION_AWAITING_VERIFICATION"
        ? "Awaiting verification completion before next scenario."
        : t.arenaPendingContractLead;

  return (
    <div
      data-testid="arena-pending-action-contract-gate"
      role="region"
      aria-label={t.arenaPendingContractRegionAria}
      className="mt-[18px] rounded-2xl border border-bty-border bg-bty-surface/95 p-4 shadow-sm"
    >
      <h2 className="m-0 mb-2 text-lg font-semibold text-bty-navy">{t.arenaPendingContractTitle}</h2>
      {runtimeState === "ACTION_REQUIRED" ? (
        <p
          data-testid="arena-observable-action-confirmation"
          className="m-0 mb-3 rounded-lg border border-emerald-200/90 bg-emerald-50/80 px-3 py-2 text-sm leading-relaxed text-emerald-950/95"
        >
          {t.arenaObservableActionConfirmationLead}
        </p>
      ) : null}
      <p className="m-0 mb-4 text-sm leading-relaxed" style={{ color: "var(--arena-text-soft, #475569)" }}>
        {canonicalLead}
      </p>
      <p className="m-0 mb-4 text-xs font-mono text-bty-navy/70" data-testid="arena-pending-contract-runtime-state">
        {canonicalLabel}
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
        {qrAllowed && typeof onCompleteByQr === "function" ? (
          <button
            type="button"
            data-testid="arena-pending-contract-complete-by-qr"
            disabled={qrLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCompleteByQr();
            }}
            className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {qrLoading ? t.eliteRunCompleteLoading : actionT.btnQr}
          </button>
        ) : null}
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
        <button
          type="button"
          data-testid="arena-pending-contract-refresh-status"
          disabled={retryLoading}
          onClick={() => void Promise.resolve(onRetry())}
          className="rounded-xl border border-bty-border bg-bty-surface px-4 py-2 text-sm font-medium text-bty-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}
