"use client";

import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export interface ActionContractHubProps {
  contract: {
    id: string;
    action_text: string;
    deadline_at: string;
    verification_type: "qr" | "link" | "hybrid" | "self_report";
    display_state:
      | "action_required"
      | "action_submitted"
      | "action_awaiting_verification"
      | "verified_completed"
      | "missed"
      | "blocked"
      | "pending"
      | "completed";
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

  if (
    contract.display_state === "action_required" ||
    contract.display_state === "blocked" ||
    contract.display_state === "pending"
  ) {
    return (
      <div
        id="bty-action-contract-hub"
        tabIndex={-1}
        className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.05] md:p-6"
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-100/60">
          {contract.display_state === "blocked" ? "Action Required (Blocked)" : "Action Required"}
        </p>
        <p className="mb-1 text-sm text-gray-900 dark:text-white/80">{t.pendingBody}</p>
        <p className="mb-4 text-sm text-gray-700 dark:text-white/60">{contract.action_text}</p>
        <p className="mb-4 text-xs text-gray-500 dark:text-white/40">
          {t.expiresIn} {formatDeadline(contract.deadline_at, t.expiredShort)}
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          {(contract.verification_type === "qr" || contract.verification_type === "hybrid") && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestQr();
              }}
              className="rounded-lg bg-cyan-100 px-4 py-2 text-sm text-cyan-700 transition-colors hover:bg-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:hover:bg-cyan-500/30"
            >
              {t.btnQr}
            </button>
          )}
          {(contract.verification_type === "link" || contract.verification_type === "hybrid") && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestSecureLink();
              }}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
            >
              {t.btnLink}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (contract.display_state === "action_submitted") {
    return (
      <div
        id="bty-action-contract-hub"
        tabIndex={-1}
        className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-300/20 dark:bg-amber-500/[0.08] md:p-6"
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-amber-700 dark:text-amber-100/70">
          Evidence Submitted
        </p>
        <p className="text-sm text-amber-900/90 dark:text-amber-50/80">
          Your evidence is recorded. Verification is processing.
        </p>
      </div>
    );
  }

  if (contract.display_state === "action_awaiting_verification") {
    return (
      <div
        id="bty-action-contract-hub"
        tabIndex={-1}
        className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-300/20 dark:bg-indigo-500/[0.08] md:p-6"
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-indigo-700 dark:text-indigo-100/70">
          Awaiting Verification
        </p>
        <p className="text-sm text-indigo-900/90 dark:text-indigo-50/80">
          Evidence is approved and waiting for verification completion.
        </p>
      </div>
    );
  }

  if (contract.display_state === "verified_completed" || contract.display_state === "completed") {
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
