"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, CardSkeleton } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/**
 * Pending Action list — render-only surface for GET /api/arena/action-contracts/pending.
 * Lists the caller's unclosed action contracts (verified_at IS NULL). Display only:
 * no status transition, no QR mint, no session/next call. `display_state` is
 * intentionally NOT derived (out of slice) — the badge maps the raw `status` +
 * `verification_type` the endpoint exposes.
 */

type PendingContract = {
  id: string;
  status: string;
  action_text: string;
  deadline_at: string;
  verification_type: string | null;
  session_id: string;
  created_at: string;
};

type PendingRes = { contracts?: PendingContract[] };

/** verification_type values that carry a QR witness affordance (extends the ActionContractHub qr||hybrid precedent to the canonical qr_* variants). */
const QR_TYPES = ["qr", "hybrid", "qr_peer", "qr_system", "qr_location"];

/** Non-QR contracts the user has already acted on — now awaiting verification. */
const AWAITING_STATUSES = ["submitted", "approved", "escalated"];

type BadgeTone = "amber" | "blue" | "green";

/**
 * Simplified badge mapping — "what must the user do?". Every row here is already
 * `verified_at IS NULL`. A QR-channel contract always needs the witness QR
 * (regardless of status); a non-QR contract splits on whether the user has acted
 * (submitted-onward → awaiting verification) or not (everything else → in progress).
 * The "재노출 예정" (REEXPOSURE_DUE) badge stays OUT OF SCOPE — that signal is a
 * runtime_state, not a contract field, and is absent from this endpoint's shape.
 * Pure frontend function; no display_state.
 */
function badgeFor(
  status: string,
  verificationType: string | null,
  t: { badgeQrRequired: string; badgeAwaitingVerification: string; badgeInProgress: string },
): { label: string; tone: BadgeTone } {
  const isQr = verificationType != null && QR_TYPES.includes(verificationType);
  if (isQr) {
    return { label: t.badgeQrRequired, tone: "amber" };
  }
  if (AWAITING_STATUSES.includes(status)) {
    return { label: t.badgeAwaitingVerification, tone: "blue" };
  }
  return { label: t.badgeInProgress, tone: "green" };
}

const TONE_CLASS: Record<BadgeTone, string> = {
  amber: "text-amber-700 dark:text-amber-100/80 bg-amber-500/10",
  blue: "text-blue-700 dark:text-blue-100/80 bg-blue-500/10",
  green: "text-emerald-700 dark:text-emerald-100/80 bg-emerald-500/10",
};

/** Inline deadline formatter — mirrors the existing ActionContractHub/AwaitingQrList helper (kept local to avoid importing from a My Page component). */
function formatDeadline(deadlineIso: string, expiredLabel: string): string {
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return expiredLabel;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PendingActionList() {
  const [contracts, setContracts] = useState<PendingContract[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(locale).actionContract;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch("/api/arena/action-contracts/pending", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: PendingRes | null) => {
        if (cancelled) return;
        if (!res) {
          setError(true);
          setContracts([]);
          return;
        }
        setContracts(Array.isArray(res.contracts) ? res.contracts : []);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setContracts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <CardSkeleton lines={2} showLabel={true} />;

  const count = contracts?.length ?? 0;

  return (
    <section aria-label={t.pendingListTitle}>
      <p className="text-sm font-medium text-[var(--arena-text-soft)] mb-2">{t.pendingListTitle}</p>
      {error && <p className="text-xs text-[var(--arena-text-soft)] opacity-80">{t.pendingErrorMessage}</p>}
      {!error && count === 0 && (
        <EmptyState icon="✅" message={t.pendingEmptyMessage} style={{ padding: "20px 16px" }} />
      )}
      {!error && count > 0 && (
        <ul className="space-y-2">
          {contracts!.map((c) => {
            const badge = badgeFor(c.status, c.verification_type, t);
            return (
              <li
                key={c.id}
                className="rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-card,#fff)]/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[var(--arena-text)] leading-relaxed">{c.action_text}</p>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[badge.tone]}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--arena-text-soft)]">
                  {t.expiresIn} {formatDeadline(c.deadline_at, t.expiredShort)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default PendingActionList;
