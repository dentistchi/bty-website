"use client";

import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export interface ActionContractHubProps {
  contract: {
    id: string;
    action_text: string;
    deadline_at: string;
    verification_type: "qr" | "link" | "hybrid";
    display_state: "pending" | "completed" | "missed" | "blocked";
    completion_method: "qr" | "link" | null;
    completed_at?: string | null;
  } | null;
  locale: string;
  onRequestQr: () => void;
  onRequestSecureLink: () => void;
}

export function formatDeadline(deadlineIso: string, expiredLabel: string): string {
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return expiredLabel;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Action Contract Hub — render-only; verification URLs and QR state live in the parent console.
 */
export function ActionContractHub({
  contract,
  locale,
  onRequestQr,
  onRequestSecureLink,
}: ActionContractHubProps) {
  if (!contract) return null;

  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).actionContract;

  if (contract.display_state === "pending" || contract.display_state === "blocked") {
    return (
      <div
        id="bty-action-contract-hub"
        tabIndex={-1}
        className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.05] md:p-6"
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-100/60">{t.pendingTitle}</p>
        <p className="mb-1 text-sm text-gray-900 dark:text-white/80">{t.pendingBody}</p>
        <p className="mb-4 text-sm text-gray-700 dark:text-white/60">{contract.action_text}</p>
        <p className="mb-4 text-xs text-gray-500 dark:text-white/40">
          {t.expiresIn} {formatDeadline(contract.deadline_at, t.expiredShort)}
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          {(contract.verification_type === "qr" || contract.verification_type === "hybrid") && (
            <button
              type="button"
              onClick={onRequestQr}
              className="rounded-lg bg-cyan-100 px-4 py-2 text-sm text-cyan-700 transition-colors hover:bg-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:hover:bg-cyan-500/30"
            >
              {t.btnQr}
            </button>
          )}
          {(contract.verification_type === "link" || contract.verification_type === "hybrid") && (
            <button
              type="button"
              onClick={onRequestSecureLink}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
            >
              {t.btnLink}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (contract.display_state === "completed") {
    return (
      <div
        id="bty-action-contract-hub"
        tabIndex={-1}
        className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03] md:p-6"
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-100/60">{t.completedTitle}</p>
        <p className="text-sm text-gray-700 dark:text-white/60">{t.completedBody}</p>
      </div>
    );
  }

  if (contract.display_state === "missed") {
    return (
      <div
        id="bty-action-contract-hub"
        tabIndex={-1}
        className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03] md:p-6"
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-gray-500 dark:text-white/40">{t.missedTitle}</p>
        <p className="text-sm text-gray-600 dark:text-white/50">{t.missedBody}</p>
      </div>
    );
  }

  return null;
}
