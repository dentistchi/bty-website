"use client";

import { useCallback, useEffect, useState } from "react";
import FieldActionForm from "@/components/app-shell/FieldActionForm";
import HostActionReviewDetail from "@/components/app-shell/HostActionReviewDetail";
import { useRouter } from "next/navigation";
import { navigateWithinFrame } from "@/lib/bty/teams/teamsAwareNavigate";
import {
  fieldActionLearnerGroup,
  FIELD_ACTION_GROUP_ORDER,
  type FieldActionLearnerGroup,
} from "@/domain/action-contract/fieldActionGroup";
import type { OpportunityState } from "@/domain/foundry/observation/observationOpportunity";

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
/**
 * Slice 3.2N — a behaviour this reviewer is authorised to confirm. Available work, never a task:
 * nothing here carries a date, a badge count, or a claim that anyone is late.
 */
type ObservationOpportunity = {
  followupId: string;
  learnerLabel: string;
  behavior: string;
  state: OpportunityState;
  firstObservedOn: string | null;
  lastObservedOn: string | null;
  positiveDates: number;
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
  /** Slice 3.2N — two kinds of work can live under one heading without pretending to be one thing. */
  kindFieldAction: string;
  kindObservation: string;
  obsState: Record<OpportunityState, string>;
  obsCtaFirst: string;
  obsCtaAgain: string;
  obsDays: (n: number) => string;
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
    /*
      "Your review work", not "Review queue" (Slice 3.2N). A queue implies a backlog someone is
      behind on. This block now holds two different things — action plans somebody submitted for
      review, and behaviours you are simply permitted to confirm — and only the first is waiting
      on you. The heading has to be true of both.
    */
    hostTitle: "Your review work",
    hostLoading: "Loading your review work…",
    hostVerificationPending: "Verification pending",
    hostNeedsRevision: "Needs revision",
    hostReviewed: "Reviewed action plans",
    hostAwaitingResolution: "Awaiting resolution",
    hostQueueSub: "Awaiting your review",
    submittedOn: "Submitted",
    kindFieldAction: "Action plan review",
    kindObservation: "Behaviour observation",
    obsState: {
      none: "You haven't recorded anything yet",
      // Never "failed" and never "not done": they may simply not have been there.
      not_seen: "You recorded that you couldn't confirm it",
      seen_once: "You saw it once",
      seen_repeatedly: "You saw it more than once",
      sustained: "Sustained",
    },
    obsCtaFirst: "Record what you saw",
    obsCtaAgain: "Record it again if you see it",
    obsDays: (n) => (n === 1 ? "on 1 day" : `on ${n} days`),
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
    hostTitle: "내 검토 업무",
    hostLoading: "검토 업무를 불러오는 중입니다…",
    hostVerificationPending: "검토 대기",
    hostNeedsRevision: "수정 필요",
    hostReviewed: "검토·승인된 행동 계획",
    hostAwaitingResolution: "해결 대기",
    hostQueueSub: "검토를 기다리고 있습니다",
    submittedOn: "제출",
    kindFieldAction: "행동 계획 검토",
    kindObservation: "행동 관찰",
    obsState: {
      none: "아직 기록하지 않았습니다",
      not_seen: "확인하지 못했다고 기록하셨습니다",
      seen_once: "한 번 보셨습니다",
      seen_repeatedly: "여러 번 보셨습니다",
      sustained: "지속됨",
    },
    obsCtaFirst: "본 것을 기록하기",
    obsCtaAgain: "또 보셨다면 기록하기",
    obsDays: (n) => `${n}일`,
  },
};

/**
 * Format an OCCURRENCE day key ("YYYY-MM-DD") in UTC from its own components (Slice 3.2N), so the
 * date a colleague reported is the date they read back. Passing it through the reader's zone
 * could shift it a day and quietly change what they think they recorded.
 */
function fmtDayKey(dayKey: string, loc: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return "";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(
    loc === "ko" ? "ko-KR" : "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
}

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
  const [opportunities, setOpportunities] = useState<ObservationOpportunity[]>([]);
  const router = useRouter();
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
      }
      /*
        Slice 3.2N — observation opportunities. A SEPARATE, independently fail-soft read: a
        failure here must not remove the action-plan reviews a reviewer can still act on, and
        vice versa. Empty is the normal answer for everyone who holds no reviewer edges.
      */
      try {
        const res = await fetch(`/api/bty/foundry/observations/mine`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { items?: ObservationOpportunity[] };
          if (!cancelled) setOpportunities(Array.isArray(d.items) ? d.items : []);
        }
      } catch {
        /* fail-soft — observation section omitted */
      }
      if (!cancelled) setHostState("ready");
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
  // The block appears for EITHER kind of work. A reviewer with no action plans but a behaviour
  // to confirm still has review work, and a stage-count-only gate would have hidden it.
  const showHost = hostState === "ready" && (hostTotal > 0 || opportunities.length > 0);

  const eyebrow = "text-[0.7rem] font-semibold uppercase tracking-[0.16em]";
  const rowCls = "flex flex-col gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left w-full";
  const groupTone: Record<Exclude<FieldActionLearnerGroup, "other">, string> = {
    needs_revision: "text-[#E5B769]/85",
    awaiting_review: "text-white/55",
    awaiting_resolution: "text-violet-200/70",
    upcoming: "text-white/55",
    reviewed: "text-[#C9A66B]/70",
  };

  return (
    <div className="flex flex-col gap-4" data-testid="field-actions-focus">
      <div className="flex items-center justify-between">
        <button type="button" data-testid="field-actions-back" onClick={onBack} className="text-xs font-medium text-white/60 hover:text-white/85">
          ‹ {t.back}
        </button>
        <h1 className="text-[1.1rem] font-semibold tracking-tight text-white">{t.title}</h1>
        <span className="w-8" aria-hidden />
      </div>

      {/* ── LEARNER: explicit loading / error / empty / list (never a blank screen) ── */}
      {learnerState === "loading" ? (
        <p className="text-sm text-white/60" role="status" data-testid="fa-loading">{t.loading}</p>
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
        <p className="text-sm text-white/55" role="status" data-testid="fa-empty">{t.empty}</p>
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
                    <div key={a.contractId} data-testid="fa-item" data-group={g} data-contract={a.contractId} className="flex flex-col gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                      <span className="truncate text-xs text-white/55">{label(a)}</span>
                      <span className="text-sm text-white/80">{t.reviewedAccepted}</span>
                      {on ? <span className="text-[0.7rem] text-white/50">{t.reviewedOn} · {on}</span> : null}
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
                      <span className="text-xs leading-5 text-white/60">{t.awaitingResolutionBody}</span>
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
        <p className="text-sm text-white/55" role="status" data-testid="fa-host-loading">{t.hostLoading}</p>
      ) : showHost ? (
        <section className="flex flex-col gap-3" data-testid="fa-host">
          <span className={eyebrow + " text-[#C9A66B]/70"}>{t.hostTitle}</span>
          {stageCounts ? (
        <div className="flex flex-col gap-2">
          <span className="text-[0.66rem] uppercase tracking-[0.14em] text-white/50" data-testid="fa-kind-field-action">
            {t.kindFieldAction}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["verificationPending", t.hostVerificationPending, stageCounts.verificationPending],
              ["needsRevision", t.hostNeedsRevision, stageCounts.needsRevision],
              ["reviewedAccepted", t.hostReviewed, stageCounts.reviewedAccepted],
              ["awaitingResolution", t.hostAwaitingResolution, stageCounts.awaitingResolution],
            ] as const).map(([key, lab, n]) => (
              <div key={key} data-testid={`fa-host-count-${key}`} data-count={n}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                <span className="min-w-0 truncate text-[0.72rem] text-white/60">{lab}</span>
                <span className="shrink-0 text-sm font-semibold text-white/85">{n}</span>
              </div>
            ))}
          </div>
          {hostQueue.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.72rem] text-white/55">{t.hostQueueSub}</span>
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
                    {on ? <span className="text-[0.7rem] text-white/50">{t.submittedOn} · {on}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
          ) : null}

          {/*
            BEHAVIOUR OBSERVATION (Slice 3.2N) — available work, kept visually distinct from the
            action plans above so the shared heading never implies the two are the same object.

            Nothing here is a task: no due date, no overdue tone, no count badge. The card carries
            only what the observer page will carry anyway — who, the behaviour, and this
            reviewer's own record — and the button opens that page rather than duplicating the
            form. It stays after a report, because the opportunity genuinely stays.
          */}
          {opportunities.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="fa-observations">
              <span className="text-[0.66rem] uppercase tracking-[0.14em] text-white/50" data-testid="fa-kind-observation">
                {t.kindObservation}
              </span>
              {opportunities.map((o) => {
                const seen = o.state === "seen_once" || o.state === "seen_repeatedly" || o.state === "sustained";
                const span =
                  o.firstObservedOn && o.lastObservedOn && o.firstObservedOn !== o.lastObservedOn
                    ? `${fmtDayKey(o.firstObservedOn, loc)}–${fmtDayKey(o.lastObservedOn, loc)}`
                    : o.lastObservedOn
                      ? fmtDayKey(o.lastObservedOn, loc)
                      : null;
                return (
                  <button
                    key={o.followupId}
                    type="button"
                    data-testid="fa-observation-item"
                    data-state={o.state}
                    className={rowCls}
                    onClick={() =>
                      // Slice A0 — identical to `router.push` everywhere except inside the Teams
                      // tab, where `/observe` is an X-Frame-Options: DENY page and pushing it
                      // would blank the frame rather than navigate. There it opens externally.
                      navigateWithinFrame(
                        (href) => router.push(href),
                        `/${loc}/observe/${encodeURIComponent(o.followupId)}`,
                      )
                    }
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-white/85">{o.learnerLabel}</span>
                    {/*
                      Slice R4-R1A — two lines cut the behaviour in half on a phone. The live
                      standard reads "At the end of a team huddle when there are open action items
                      that need follow-through, you must name one owner and one deadline…", and
                      `line-clamp-2` ended it at "follow-th…" — before the verb, so the card asked
                      the reviewer to open a page to learn what the work even was.

                      Four lines, not unbounded: the card must still answer "do I understand what
                      kind of behaviour this is?" while staying a list item. The detail page
                      remains the authority, and nothing here paraphrases or summarises the frozen
                      standard — it is the same sentence, shown further.
                    */}
                    <span className="line-clamp-4 text-xs leading-5 text-[#C9A66B]/80">{o.behavior}</span>
                    <span className="text-[0.7rem] text-white/55">
                      {t.obsState[o.state]}
                      {seen && o.positiveDates > 1 ? ` · ${t.obsDays(o.positiveDates)}` : ""}
                      {span ? ` · ${span}` : ""}
                    </span>
                    <span className="text-[0.72rem] text-sky-200/75">{seen ? t.obsCtaAgain : t.obsCtaFirst}</span>
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
