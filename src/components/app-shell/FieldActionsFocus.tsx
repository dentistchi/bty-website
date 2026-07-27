"use client";

import { useCallback, useEffect, useState } from "react";
import FieldActionForm from "@/components/app-shell/FieldActionForm";
import HostActionReviewDetail from "@/components/app-shell/HostActionReviewDetail";
import {
  fieldActionLearnerGroup,
  FIELD_ACTION_GROUP_ORDER,
  type FieldActionLearnerGroup,
} from "@/domain/action-contract/fieldActionGroup";

/**
 * Practice → Field Actions — focused surface (canonical learner inventory V1).
 *
 * The learner sections are driven by a CANONICAL, authorized inventory of the caller's field_action
 * contracts (`GET /api/bty/action-contract/mine`) — every relevant contract regardless of Today
 * ranking, due date, reminder eligibility, or primary-CTA status. This fixes the gap where a
 * `submitted` contract was in the Host reviewer queue but absent from the learner surface (the old
 * surface derived learner state from the Today brief, a priority/reminder projection). One canonical
 * source → contract-id identity → no cross-projection duplication. No new table, no lifecycle copied,
 * no authorization in the client (ownership is enforced server-side by the session user).
 *
 * The Host sections keep the existing reviewer-authority queue + stage-count service
 * (`/api/arena/action-review-queue`), unchanged and authority-scoped (empty for non-reviewers).
 * State-aware interactions reuse {@link FieldActionForm} (rejected=editable+note / submitted=read-only)
 * and {@link HostActionReviewDetail}. Explicit loading / empty / error states — never a blank screen.
 */

type Locale = "en" | "ko";

type MyFieldAction = {
  contractId: string;
  status: string | null;
  who: string | null;
  what: string | null;
  contractDescription: string | null;
  revisionNote: string | null;
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
  loading: string;
  empty: string;
  errorText: string;
  retry: string;
  groups: Record<Exclude<FieldActionLearnerGroup, "other">, string>;
  reviewedAccepted: string;
  awaitingReviewBadge: string;
  awaitingResolutionBadge: string;
  awaitingResolutionBody: string;
  needsRevisionBadge: string;
  revisionNote: string;
  reviewedOn: string;
  hostTitle: string;
  hostLoading: string;
  hostVerificationPending: string;
  hostNeedsRevision: string;
  hostReviewed: string;
  hostAwaitingResolution: string;
  hostQueueSub: string;
  submittedOn: string;
}> = {
  en: {
    title: "Action plans",
    back: "Back",
    loading: "Loading field actions…",
    empty: "No field actions right now.",
    errorText: "Field actions could not be loaded.",
    retry: "Try again",
    groups: {
      needs_revision: "Needs revision",
      awaiting_review: "Awaiting review",
      awaiting_resolution: "Awaiting resolution",
      upcoming: "Upcoming actions",
      reviewed: "Reviewed action plans",
    },
    reviewedAccepted: "Action plan reviewed & accepted",
    awaitingReviewBadge: "Awaiting review",
    awaitingResolutionBadge: "Awaiting resolution",
    awaitingResolutionBody: "This action is waiting for a resolution.",
    needsRevisionBadge: "Needs revision",
    revisionNote: "Revision requested",
    reviewedOn: "Reviewed",
    hostTitle: "Review queue",
    hostLoading: "Loading review queue…",
    hostVerificationPending: "Verification pending",
    hostNeedsRevision: "Needs revision",
    hostReviewed: "Reviewed action plans",
    hostAwaitingResolution: "Awaiting resolution",
    hostQueueSub: "Awaiting your review",
    submittedOn: "Submitted",
  },
  ko: {
    title: "행동 계획",
    back: "뒤로",
    loading: "행동 계획을 불러오는 중입니다…",
    empty: "현재 진행 중인 행동 계획이 없습니다.",
    errorText: "행동 계획을 불러오지 못했습니다.",
    retry: "다시 시도",
    groups: {
      needs_revision: "수정이 필요합니다",
      awaiting_review: "검토 대기",
      awaiting_resolution: "해결 대기 중",
      upcoming: "예정된 행동",
      reviewed: "검토·승인된 행동 계획",
    },
    reviewedAccepted: "행동 계획이 검토되고 승인되었습니다",
    awaitingReviewBadge: "검토 대기",
    awaitingResolutionBadge: "해결 대기 중",
    awaitingResolutionBody: "이 행동은 해결을 기다리고 있습니다.",
    needsRevisionBadge: "수정 필요",
    revisionNote: "수정 요청",
    reviewedOn: "검토됨",
    hostTitle: "검토 대기열",
    hostLoading: "검토 대기열을 불러오는 중입니다…",
    hostVerificationPending: "검토 대기",
    hostNeedsRevision: "수정 필요",
    hostReviewed: "검토·승인된 행동 계획",
    hostAwaitingResolution: "해결 대기",
    hostQueueSub: "검토를 기다리고 있습니다",
    submittedOn: "제출",
  },
};

function fmtDate(iso: string | null, loc: Locale): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

function label(a: MyFieldAction): string {
  return (a.contractDescription ?? a.what ?? "").trim() || (a.who ?? "").trim() || "—";
}

type View = { mode: "list" } | { mode: "form"; contractId: string } | { mode: "host"; contractId: string };

export default function FieldActionsFocus({
  locale,
  onBack,
  initialFieldActionId = null,
}: {
  locale: string;
  onBack: () => void;
  initialFieldActionId?: string | null;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [items, setItems] = useState<MyFieldAction[]>([]);
  const [learnerState, setLearnerState] = useState<"loading" | "ready" | "error">("loading");
  const [hostQueue, setHostQueue] = useState<HostReview[]>([]);
  const [stageCounts, setStageCounts] = useState<StageCounts | null>(null);
  const [hostState, setHostState] = useState<"loading" | "ready">("loading");
  const [view, setView] = useState<View>(
    initialFieldActionId ? { mode: "form", contractId: initialFieldActionId } : { mode: "list" },
  );

  // Canonical learner inventory — READ-only; retry re-fetches, never creates/mutates a contract.
  const loadInventory = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bty/action-contract/mine`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return false;
      const d = (await res.json()) as { ok?: boolean; items?: MyFieldAction[] };
      if (!d?.ok) return false;
      // Dedup by canonical contract id (defensive; the single source is already unique).
      const byId = new Map<string, MyFieldAction>();
      for (const it of Array.isArray(d.items) ? d.items : []) if (it?.contractId) byId.set(it.contractId, it);
      setItems([...byId.values()]);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLearnerState("loading");
    void loadInventory().then((ok) => {
      if (!cancelled) setLearnerState(ok ? "ready" : "error");
    });
    void (async () => {
      try {
        const res = await fetch(`/api/arena/action-review-queue?locale=${loc}`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { items?: HostReview[]; stageCounts?: StageCounts };
          if (!cancelled) {
            setHostQueue(Array.isArray(d.items) ? d.items : []);
            setStageCounts(d.stageCounts ?? null);
          }
        }
      } catch {
        /* fail-soft — Host sections omitted (honest: no authorized scope surfaced) */
      } finally {
        if (!cancelled) setHostState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc, loadInventory]);

  // Sub-views reuse the canonical state-aware components (no lifecycle logic here).
  if (view.mode === "form") {
    return <FieldActionForm locale={locale} contractId={view.contractId} onBack={() => setView({ mode: "list" })} />;
  }
  if (view.mode === "host") {
    return <HostActionReviewDetail locale={locale} actionContractId={view.contractId} onBack={() => setView({ mode: "list" })} />;
  }

  const byGroup: Record<Exclude<FieldActionLearnerGroup, "other">, MyFieldAction[]> = {
    needs_revision: [],
    awaiting_review: [],
    awaiting_resolution: [],
    upcoming: [],
    reviewed: [],
  };
  for (const it of items) {
    const g = fieldActionLearnerGroup(it.status);
    if (g !== "other") byGroup[g].push(it);
  }
  const hostTotal = stageCounts
    ? stageCounts.verificationPending + stageCounts.needsRevision + stageCounts.reviewedAccepted + stageCounts.awaitingResolution
    : 0;
  const showHost = hostState === "ready" && hostTotal > 0;

  const eyebrow = "text-[0.7rem] font-semibold uppercase tracking-[0.16em]";
  const rowCls = "flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-left w-full";
  const groupTone: Record<Exclude<FieldActionLearnerGroup, "other">, string> = {
    needs_revision: "text-[#E5B769]/85",
    awaiting_review: "text-white/40",
    awaiting_resolution: "text-violet-200/70",
    upcoming: "text-white/40",
    reviewed: "text-[#C9A66B]/70",
  };

  return (
    <div className="flex flex-col gap-4" data-testid="field-actions-focus">
      <div className="flex items-center justify-between">
        <button type="button" data-testid="field-actions-back" onClick={onBack} className="text-xs font-medium text-white/55 hover:text-white/85">
          ‹ {t.back}
        </button>
        <h1 className="text-[1.1rem] font-semibold tracking-tight text-white">{t.title}</h1>
        <span className="w-8" aria-hidden />
      </div>

      {/* ── LEARNER: explicit loading / error / empty / list (never a blank screen) ── */}
      {learnerState === "loading" ? (
        <p className="text-sm text-white/50" role="status" data-testid="fa-loading">{t.loading}</p>
      ) : learnerState === "error" ? (
        <div className="flex flex-col items-start gap-2" data-testid="fa-error">
          <p className="text-sm text-white/70">{t.errorText}</p>
          <button
            type="button"
            data-testid="fa-retry"
            onClick={() => {
              setLearnerState("loading");
              void loadInventory().then((ok) => setLearnerState(ok ? "ready" : "error"));
            }}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:text-white"
          >
            {t.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/40" role="status" data-testid="fa-empty">{t.empty}</p>
      ) : (
        FIELD_ACTION_GROUP_ORDER.map((g) => {
          if (g === "other") return null;
          const list = byGroup[g];
          if (list.length === 0) return null;
          return (
            <section key={g} className="flex flex-col gap-2" data-testid={`fa-group-${g}`}>
              <span className={eyebrow + " " + groupTone[g]}>{t.groups[g]}</span>
              {list.map((a) => {
                if (g === "reviewed") {
                  const on = fmtDate(a.reviewedAt, loc);
                  return (
                    <div key={a.contractId} data-testid="fa-item" data-group={g} data-contract={a.contractId} className="flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <span className="truncate text-xs text-white/45">{label(a)}</span>
                      <span className="text-sm text-white/80">{t.reviewedAccepted}</span>
                      {on ? <span className="text-[0.7rem] text-white/35">{t.reviewedOn} · {on}</span> : null}
                    </div>
                  );
                }
                return (
                  <button key={a.contractId} data-testid="fa-item" data-group={g} data-contract={a.contractId} className={rowCls}
                    onClick={() => setView({ mode: "form", contractId: a.contractId })}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-white/85">{label(a)}</span>
                      {g === "needs_revision" ? (
                        <span className="shrink-0 rounded-md border border-[#C9A66B]/45 px-2 py-0.5 text-[0.66rem] text-[#E5B769]">{t.needsRevisionBadge}</span>
                      ) : g === "awaiting_review" ? (
                        <span className="shrink-0 rounded-md border border-sky-400/25 px-2 py-0.5 text-[0.66rem] text-sky-200/75">{t.awaitingReviewBadge}</span>
                      ) : g === "awaiting_resolution" ? (
                        <span className="shrink-0 rounded-md border border-violet-400/30 px-2 py-0.5 text-[0.66rem] text-violet-200/80">{t.awaitingResolutionBadge}</span>
                      ) : null}
                    </div>
                    {g === "awaiting_resolution" ? (
                      <span className="text-xs leading-5 text-white/55">{t.awaitingResolutionBody}</span>
                    ) : null}
                    {g === "needs_revision" && a.revisionNote ? (
                      <span className="rounded-md border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-2.5 py-1.5 text-xs leading-5 text-white/75">
                        <span className="mr-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#E5B769]/80">{t.revisionNote}:</span>
                        {a.revisionNote}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </section>
          );
        })
      )}

      {/* ── HOST (reviewer-authority scoped; explicit loading; non-reviewer → no section) ── */}
      {hostState === "loading" ? (
        <p className="text-sm text-white/45" role="status" data-testid="fa-host-loading">{t.hostLoading}</p>
      ) : showHost && stageCounts ? (
        <section className="flex flex-col gap-2" data-testid="fa-host">
          <span className={eyebrow + " text-[#C9A66B]/70"}>{t.hostTitle}</span>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["verificationPending", t.hostVerificationPending, stageCounts.verificationPending],
              ["needsRevision", t.hostNeedsRevision, stageCounts.needsRevision],
              ["reviewedAccepted", t.hostReviewed, stageCounts.reviewedAccepted],
              ["awaitingResolution", t.hostAwaitingResolution, stageCounts.awaitingResolution],
            ] as const).map(([key, lab, n]) => (
              <div key={key} data-testid={`fa-host-count-${key}`} data-count={n}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <span className="min-w-0 truncate text-[0.72rem] text-white/55">{lab}</span>
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
    </div>
  );
}
