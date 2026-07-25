"use client";

import { useEffect, useState } from "react";
import FieldActionForm from "@/components/app-shell/FieldActionForm";
import HostActionReviewDetail from "@/components/app-shell/HostActionReviewDetail";

/**
 * Practice → Field Actions — focused surface (App Shell + Today Simplification V1).
 *
 * A dedicated in-shell destination for the learner's (and, when authorized, the reviewer's) full
 * Field Action state. It REUSES existing projections — it duplicates NO canonical data, lifecycle,
 * authorization, or evidence semantics, and adds no new API:
 *   • learner "Needs revision" / "Upcoming actions" ← /api/me/today/brief reminders (field_action only,
 *     identified by the canonical ?tab=practice&fieldAction= deep link)
 *   • learner "Awaiting review"                     ← /api/me/today/brief actionStatus (verification_pending,
 *     actionType==="field_action")
 *   • learner "Reviewed action plans"              ← /api/bty/action-contract/reviewed-plans (E3-safe)
 *   • Host stages + queue                          ← /api/arena/action-review-queue (reviewer-authority
 *     scoped server-side; empty for non-reviewers, so Host sections never leak unauthorized learners)
 *
 * All state-aware interactions reuse the canonical components: {@link FieldActionForm} (rejected =
 * editable + revision note; submitted = read-only "Awaiting review") and {@link HostActionReviewDetail}
 * (reviewer decision). No lifecycle logic is copied here. Back returns to the Practice landing.
 */

type Locale = "en" | "ko";

type Reminder = {
  stableId: string;
  category: "REQUIRED_LEARNING" | "ACTION_DUE" | "ACTION_REVISION" | "PRACTICE_DUE" | "FOLLOW_UP_DUE";
  title: string;
  state: string;
  canonicalDeepLink: string;
  note?: string | null;
};
type ActionStatus = {
  stableId: string;
  contractId: string;
  actionType?: string | null;
  status: "verification_pending" | "awaiting_resolution";
  title: string;
  originalDeadline: string | null;
};
type ReviewedPlan = {
  contractId: string;
  who: string | null;
  what: string | null;
  moduleTitle: string | null;
  reviewedAt: string | null;
};
type HostReview = {
  actionContractId: string;
  learnerLabel: string;
  actionSummary: string;
  submittedAt: string | null;
  statusLabel: string;
};
type StageCounts = {
  verificationPending: number;
  needsRevision: number;
  reviewedAccepted: number;
  awaitingResolution: number;
};

const COPY: Record<Locale, {
  title: string;
  back: string;
  learnerNeedsRevision: string;
  learnerAwaitingReview: string;
  learnerUpcoming: string;
  learnerReviewed: string;
  reviewedAccepted: string;
  awaitingReviewBadge: string;
  needsRevisionBadge: string;
  revisionNote: string;
  reviewedOn: string;
  hostTitle: string;
  hostVerificationPending: string;
  hostNeedsRevision: string;
  hostReviewed: string;
  hostAwaitingResolution: string;
  hostQueueSub: string;
  submittedOn: string;
  empty: string;
}> = {
  en: {
    title: "Field Actions",
    back: "Back",
    learnerNeedsRevision: "Needs revision",
    learnerAwaitingReview: "Awaiting review",
    learnerUpcoming: "Upcoming actions",
    learnerReviewed: "Reviewed action plans",
    reviewedAccepted: "Action plan reviewed & accepted",
    awaitingReviewBadge: "Awaiting review",
    needsRevisionBadge: "Needs revision",
    revisionNote: "Revision requested",
    reviewedOn: "Reviewed",
    hostTitle: "Review queue",
    hostVerificationPending: "Verification pending",
    hostNeedsRevision: "Needs revision",
    hostReviewed: "Reviewed action plans",
    hostAwaitingResolution: "Awaiting resolution",
    hostQueueSub: "Awaiting your review",
    submittedOn: "Submitted",
    empty: "No field actions yet.",
  },
  ko: {
    title: "현장 행동",
    back: "뒤로",
    learnerNeedsRevision: "수정이 필요합니다",
    learnerAwaitingReview: "검토 대기",
    learnerUpcoming: "예정된 행동",
    learnerReviewed: "검토·승인된 행동 계획",
    reviewedAccepted: "행동 계획이 검토되고 승인되었습니다",
    awaitingReviewBadge: "검토 대기",
    needsRevisionBadge: "수정 필요",
    revisionNote: "수정 요청",
    reviewedOn: "검토됨",
    hostTitle: "검토 대기열",
    hostVerificationPending: "검토 대기",
    hostNeedsRevision: "수정 필요",
    hostReviewed: "검토·승인된 행동 계획",
    hostAwaitingResolution: "해결 대기",
    hostQueueSub: "검토를 기다리고 있습니다",
    submittedOn: "제출",
    empty: "아직 현장 행동이 없습니다.",
  },
};

function fmtDate(iso: string | null, loc: Locale): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Extract the field_action contract id from a canonical `?tab=practice&fieldAction=<id>` deep link. */
function fieldActionId(link: string): string | null {
  try {
    return new URLSearchParams(link.split("?")[1] ?? "").get("fieldAction");
  } catch {
    return null;
  }
}

type View = { mode: "list" } | { mode: "form"; contractId: string } | { mode: "host"; contractId: string };

export default function FieldActionsFocus({
  locale,
  onBack,
  initialFieldActionId = null,
}: {
  locale: string;
  onBack: () => void;
  /** Deep-link focus (?tab=practice&fieldAction=<id>) — opens that action directly on mount. */
  initialFieldActionId?: string | null;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [actionStatus, setActionStatus] = useState<ActionStatus[]>([]);
  const [reviewedPlans, setReviewedPlans] = useState<ReviewedPlan[]>([]);
  const [hostQueue, setHostQueue] = useState<HostReview[]>([]);
  const [stageCounts, setStageCounts] = useState<StageCounts | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>(
    initialFieldActionId ? { mode: "form", contractId: initialFieldActionId } : { mode: "list" },
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/me/today/brief?locale=${loc}`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { ok?: boolean; reminders?: Reminder[]; actionStatus?: ActionStatus[] };
          if (!cancelled && d?.ok) {
            setReminders(Array.isArray(d.reminders) ? d.reminders : []);
            setActionStatus(Array.isArray(d.actionStatus) ? d.actionStatus : []);
          }
        }
      } catch {
        /* fail-soft */
      }
      try {
        const res2 = await fetch(`/api/bty/action-contract/reviewed-plans`, { credentials: "include", cache: "no-store" });
        if (res2.ok) {
          const d2 = (await res2.json()) as { items?: ReviewedPlan[] };
          if (!cancelled) setReviewedPlans(Array.isArray(d2.items) ? d2.items : []);
        }
      } catch {
        /* fail-soft */
      }
      try {
        const res3 = await fetch(`/api/arena/action-review-queue?locale=${loc}`, { credentials: "include", cache: "no-store" });
        if (res3.ok) {
          const d3 = (await res3.json()) as { items?: HostReview[]; stageCounts?: StageCounts };
          if (!cancelled) {
            setHostQueue(Array.isArray(d3.items) ? d3.items : []);
            setStageCounts(d3.stageCounts ?? null);
          }
        }
      } catch {
        /* fail-soft — Host sections omitted */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loc]);

  // Sub-views reuse the canonical state-aware components (no lifecycle logic here).
  if (view.mode === "form") {
    return (
      <FieldActionForm locale={locale} contractId={view.contractId} onBack={() => setView({ mode: "list" })} />
    );
  }
  if (view.mode === "host") {
    return (
      <HostActionReviewDetail locale={locale} actionContractId={view.contractId} onBack={() => setView({ mode: "list" })} />
    );
  }

  const needsRevision = reminders.filter((r) => r.category === "ACTION_REVISION" && fieldActionId(r.canonicalDeepLink));
  const upcoming = reminders.filter((r) => r.category === "ACTION_DUE" && fieldActionId(r.canonicalDeepLink));
  const awaitingReview = actionStatus.filter((a) => a.actionType === "field_action" && a.status === "verification_pending");
  const hostTotal = stageCounts
    ? stageCounts.verificationPending + stageCounts.needsRevision + stageCounts.reviewedAccepted + stageCounts.awaitingResolution
    : 0;
  const showHost = hostTotal > 0;
  const learnerEmpty =
    needsRevision.length === 0 && awaitingReview.length === 0 && upcoming.length === 0 && reviewedPlans.length === 0;

  const eyebrow = "text-[0.7rem] font-semibold uppercase tracking-[0.16em]";
  const rowCls = "flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-left w-full";

  return (
    <div className="flex flex-col gap-4" data-testid="field-actions-focus">
      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="field-actions-back"
          onClick={onBack}
          className="text-xs font-medium text-white/55 hover:text-white/85"
        >
          ‹ {t.back}
        </button>
        <h1 className="text-[1.1rem] font-semibold tracking-tight text-white">{t.title}</h1>
        <span className="w-8" aria-hidden />
      </div>

      {!loaded ? null : (
        <>
          {/* ── LEARNER ─────────────────────────────────────────────── */}
          {needsRevision.length > 0 ? (
            <section className="flex flex-col gap-2" data-testid="fa-needs-revision">
              <span className={eyebrow + " text-[#E5B769]/85"}>{t.learnerNeedsRevision}</span>
              {needsRevision.map((r) => (
                <button key={r.stableId} data-testid="fa-needs-revision-item" className={rowCls}
                  onClick={() => setView({ mode: "form", contractId: fieldActionId(r.canonicalDeepLink)! })}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">{r.title}</span>
                    <span className="shrink-0 rounded-md border border-[#C9A66B]/45 px-2 py-0.5 text-[0.66rem] text-[#E5B769]">{t.needsRevisionBadge}</span>
                  </div>
                  {r.note && r.note.trim() ? (
                    <span className="rounded-md border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-2.5 py-1.5 text-xs leading-5 text-white/75">
                      <span className="mr-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#E5B769]/80">{t.revisionNote}:</span>
                      {r.note.trim()}
                    </span>
                  ) : null}
                </button>
              ))}
            </section>
          ) : null}

          {awaitingReview.length > 0 ? (
            <section className="flex flex-col gap-2" data-testid="fa-awaiting-review">
              <span className={eyebrow + " text-white/40"}>{t.learnerAwaitingReview}</span>
              {awaitingReview.map((a) => (
                <button key={a.stableId} data-testid="fa-awaiting-review-item" className={rowCls}
                  onClick={() => setView({ mode: "form", contractId: a.contractId })}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">{a.title}</span>
                    <span className="shrink-0 rounded-md border border-sky-400/25 px-2 py-0.5 text-[0.66rem] text-sky-200/75">{t.awaitingReviewBadge}</span>
                  </div>
                </button>
              ))}
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="flex flex-col gap-2" data-testid="fa-upcoming">
              <span className={eyebrow + " text-white/40"}>{t.learnerUpcoming}</span>
              {upcoming.map((r) => (
                <button key={r.stableId} data-testid="fa-upcoming-item" className={rowCls}
                  onClick={() => setView({ mode: "form", contractId: fieldActionId(r.canonicalDeepLink)! })}>
                  <span className="truncate text-sm text-white/80">{r.title}</span>
                </button>
              ))}
            </section>
          ) : null}

          {reviewedPlans.length > 0 ? (
            <section className="flex flex-col gap-2" data-testid="fa-reviewed">
              <span className={eyebrow + " text-[#C9A66B]/70"}>{t.learnerReviewed}</span>
              {reviewedPlans.map((p) => {
                const on = fmtDate(p.reviewedAt, loc);
                return (
                  <div key={p.contractId} data-testid="fa-reviewed-item" className="flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                    {p.moduleTitle ? <span className="truncate text-xs text-white/45">{p.moduleTitle}</span> : null}
                    <span className="text-sm text-white/80">{t.reviewedAccepted}</span>
                    {on ? <span className="text-[0.7rem] text-white/35">{t.reviewedOn} · {on}</span> : null}
                  </div>
                );
              })}
            </section>
          ) : null}

          {learnerEmpty && !showHost ? (
            <p className="text-sm text-white/40" role="status" data-testid="fa-empty">{t.empty}</p>
          ) : null}

          {/* ── HOST (reviewer-authority scoped; empty for non-reviewers) ── */}
          {showHost && stageCounts ? (
            <section className="flex flex-col gap-2" data-testid="fa-host">
              <span className={eyebrow + " text-[#C9A66B]/70"}>{t.hostTitle}</span>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["verificationPending", t.hostVerificationPending, stageCounts.verificationPending],
                  ["needsRevision", t.hostNeedsRevision, stageCounts.needsRevision],
                  ["reviewedAccepted", t.hostReviewed, stageCounts.reviewedAccepted],
                  ["awaitingResolution", t.hostAwaitingResolution, stageCounts.awaitingResolution],
                ] as const).map(([key, label, n]) => (
                  <div key={key} data-testid={`fa-host-count-${key}`} data-count={n}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                    <span className="min-w-0 truncate text-[0.72rem] text-white/55">{label}</span>
                    <span className="shrink-0 text-sm font-semibold text-white/85">{n}</span>
                  </div>
                ))}
              </div>
              {hostQueue.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.72rem] text-white/45">{t.hostQueueSub}</span>
                  {hostQueue.map((q) => {
                    const on = fmtDate(q.submittedAt, loc);
                    return (
                      <button key={q.actionContractId} data-testid="fa-host-queue-item" className={rowCls}
                        onClick={() => setView({ mode: "host", contractId: q.actionContractId })}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{q.learnerLabel}</span>
                          <span className="shrink-0 rounded-md border border-sky-400/25 px-2 py-0.5 text-[0.66rem] text-sky-200/75">{q.statusLabel}</span>
                        </div>
                        {q.actionSummary ? <span className="truncate text-xs text-white/60">{q.actionSummary}</span> : null}
                        {on ? <span className="text-[0.7rem] text-white/35">{t.submittedOn} · {on}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
