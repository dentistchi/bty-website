"use client";

import { getMessages, type Locale } from "@/lib/i18n";
import type { MyPageOpenActionContractUi } from "@/lib/bty/my-page/openActionContractForMyPage";

/** 안2-B: owner list of contracts awaiting QR verification. Render-only. */
function formatDeadline(deadlineIso: string, expiredLabel: string): string {
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return expiredLabel;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function AwaitingQrList({
  contracts,
  locale,
  onShowQr,
}: {
  contracts: MyPageOpenActionContractUi[];
  locale: string;
  onShowQr: (contractId: string) => void;
}) {
  if (!contracts || contracts.length === 0) return null;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).actionContract;
  const tierLabel = (tier: string | null | undefined): string =>
    tier === "manager_only" ? t.tierManager : t.tierPersonal;

  return (
    <section
      className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-300/20 dark:bg-cyan-500/[0.06] md:p-6"
      aria-label={t.awaitingListTitle}
    >
      <p className="mb-3 text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-100/70">
        {t.awaitingListTitle}
      </p>
      <ul className="space-y-3" role="list">
        {contracts.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-cyan-200/60 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-medium text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100">
                {tierLabel(c.verification_tier)}
              </span>
              <span className="text-xs text-gray-500 dark:text-white/40">
                {t.expiresIn} {formatDeadline(c.deadline_at, t.expiredShort)}
              </span>
            </div>
            <p className="mb-2 text-sm text-gray-800 dark:text-white/80">{c.action_text}</p>
            <div className="flex items-center justify-between gap-2">
              {c.source ? (
                <span className="truncate text-[11px] text-gray-400 dark:text-white/30">{c.source}</span>
              ) : (
                <span />
              )}
              {(c.verification_type === "qr" || c.verification_type === "hybrid") && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onShowQr(c.id);
                  }}
                  className="ml-auto rounded-lg bg-cyan-100 px-4 py-2 text-sm text-cyan-700 transition-colors hover:bg-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:hover:bg-cyan-500/30"
                >
                  {t.btnQr}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
