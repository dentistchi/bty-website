"use client";

import { useEffect, useState } from "react";

/**
 * Today — Personal Daily Brief (Slice 3.1B-3J). Deterministic reminders + an OPTIONAL, consent-gated
 * AI observation/suggestion, composed SERVER-SIDE (/api/me/today/brief). The raw Reflection body NEVER
 * reaches this client — only generated sentences + DTOs. Renders nothing when there is nothing to show.
 *
 * Slice 3.1B-3L: a separate "LEADERSHIP ATTENTION" section (Host obligations).
 * Slice 3.1B-3M (Action Hygiene): DON'T MISS TODAY holds ONLY actionable items — PENDING actions
 * (overdue/due/upcoming) + REJECTED actions (needs_revision, amber not red). Already-submitted /
 * escalated actions move to a separate calm "VERIFICATION PENDING / AWAITING RESOLUTION" section
 * (never red overdue, never asks the learner to redo the action). Top-3 + Show all N, no dismissal.
 */

type Locale = "en" | "ko";

type Reminder = {
  stableId: string;
  category: "REQUIRED_LEARNING" | "ACTION_DUE" | "ACTION_REVISION" | "PRACTICE_DUE" | "APPLY_DUE" | "FOLLOW_UP_DUE";
  title: string;
  state: "overdue" | "needs_revision" | "due_today" | "active" | "incomplete_required" | "upcoming";
  canonicalDeepLink: string;
  /**
   * ACTION_REVISION → the Host's revision note. APPLY_DUE → the source training title (Slice
   * 3.2R-R2), so the learner can see which training their sentence came from. Absent otherwise.
   */
  note?: string | null;
};
type Brief = { yesterdayObservation: string; todaySuggestion: string };

type HostAttentionCategory = "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED" | "SHARED_REVIEW_DUE";
type HostAttention = {
  stableId: string;
  category: HostAttentionCategory;
  eventId: string;
  focusId: string;
  participantDisplayName: string;
  trainingTitle: string;
  reason: string;
  sourceTimestamp: string;
  deepLink: string;
};

type ActionStatusState = "verification_pending" | "awaiting_resolution";
type ActionStatus = {
  stableId: string;
  contractId: string;
  status: ActionStatusState;
  title: string;
  patternFamily: string;
  sourceTitle: string | null;
  originalDeadline: string | null;
  deepLink: string;
};

// Slice 3.1B-3N Phase 5B — Host Action Review queue item (read-only; server DTO from /api/arena/action-reviews).
type HostActionReview = {
  actionContractId: string;
  learnerLabel: string;
  actionSummary: string;
  submittedAt: string | null;
  originalDeadline: string | null;
  verificationMode: "hybrid" | "link";
  statusLabel: string;
};

/** Operational Field Action stage counts (Slice 3.1B-3N-5D.1) — reviewer-authority scoped. */
type StageCounts = {
  verificationPending: number;
  needsRevision: number;
  reviewedAccepted: number;
  awaitingResolution: number;
};

const HOST_PREVIEW = 3;
const ACTION_STATUS_PREVIEW = 3;
const ACTION_REVIEW_PREVIEW = 3;

const COPY: Record<Locale, {
  yesterday: string;
  today: string;
  dontMiss: string;
  overdue: string;
  needsRevision: string;
  dueToday: string;
  incomplete: string;
  upcoming: string;
  required: string;
  action: string;
  practice: string;
  /* Slice 3.2R-R2 — Apply Window. Deliberately free of deadline/failure vocabulary. */
  apply: string;
  applyThisWeek: string;
  applyLastDay: string;
  applyClosed: string;
  leadershipTitle: string;
  leadershipSub: string;
  showAll: (n: number) => string;
  showLess: string;
  hostTags: Record<HostAttentionCategory, string>;
  actionStatusEyebrow: (states: Set<ActionStatusState>) => string;
  actionStatusSub: (n: number, states: Set<ActionStatusState>) => string;
  actionStatusBadge: Record<ActionStatusState, string>;
  actionStatusCopy: Record<ActionStatusState, string>;
  originalDeadline: string;
  actionReviewsTitle: string;
  actionReviewsSub: (n: number) => string;
  remoteReview: string;
  submittedOn: string;
  revisionNoteLabel: string;
  stageCountsTitle: string;
  stageVerificationPending: string;
  stageNeedsRevision: string;
  stageReviewedAccepted: string;
  stageAwaitingResolution: string;
}> = {
  en: {
    yesterday: "Yesterday",
    today: "Today",
    dontMiss: "DON'T MISS TODAY",
    overdue: "Overdue",
    apply: "Apply this week",
    applyThisWeek: "This week",
    applyLastDay: "Last day",
    // NOT "Overdue". The window closing is not a failure and the learner did not miss a deadline
    // — the period their decision was live has simply ended, and the follow-up is what asks how
    // it went. Rendering red "Overdue" on someone's own commitment is the compliance-dashboard
    // tone this surface exists to avoid.
    applyClosed: "Window closed",
    needsRevision: "Needs revision",
    dueToday: "Due today",
    incomplete: "Incomplete",
    upcoming: "Upcoming",
    required: "Required training",
    action: "Action",
    practice: "Practice",
    leadershipTitle: "LEADERSHIP ATTENTION",
    leadershipSub: "People who may need your attention today",
    showAll: (n) => `Show all ${n}`,
    showLess: "Show less",
    hostTags: {
      FOLLOW_UP_OVERDUE: "Follow-up overdue",
      FOLLOW_UP_NEEDED: "Needs follow-up",
      SHARED_REVIEW_DUE: "Shared response awaiting review",
    },
    actionStatusEyebrow: (s) =>
      s.has("verification_pending") && s.has("awaiting_resolution")
        ? "ACTION STATUS"
        : s.has("awaiting_resolution")
          ? "AWAITING RESOLUTION"
          : "VERIFICATION PENDING",
    actionStatusSub: (n, s) =>
      s.has("verification_pending") && s.has("awaiting_resolution")
        ? `${n} action${n === 1 ? "" : "s"} submitted or escalated, awaiting a next step`
        : s.has("awaiting_resolution")
          ? `${n} action${n === 1 ? "" : "s"} awaiting resolution`
          : `${n} action${n === 1 ? "" : "s"} waiting for verification`,
    actionStatusBadge: { verification_pending: "Verification pending", awaiting_resolution: "Awaiting resolution" },
    actionStatusCopy: {
      verification_pending: "Your action was submitted and is waiting for verification.",
      awaiting_resolution: "This action was escalated and is awaiting resolution.",
    },
    originalDeadline: "Original deadline",
    actionReviewsTitle: "ACTION REVIEWS",
    actionReviewsSub: (n) => `${n} action${n === 1 ? "" : "s"} awaiting your review`,
    remoteReview: "Remote review allowed",
    submittedOn: "Submitted",
    revisionNoteLabel: "Revision requested",
    stageCountsTitle: "Field action plans",
    stageVerificationPending: "Verification pending",
    stageNeedsRevision: "Needs revision",
    stageReviewedAccepted: "Reviewed action plans",
    stageAwaitingResolution: "Awaiting resolution",
  },
  ko: {
    yesterday: "어제의 나",
    today: "오늘의 제안",
    dontMiss: "오늘 놓치지 말 것",
    overdue: "기한 지남",
    apply: "이번 주에 적용하기",
    applyThisWeek: "이번 주",
    applyLastDay: "마지막 날",
    applyClosed: "적용 기간 종료",
    needsRevision: "수정이 필요합니다",
    dueToday: "오늘 마감",
    incomplete: "미완료",
    upcoming: "예정",
    required: "필수 교육",
    action: "행동",
    practice: "연습",
    leadershipTitle: "리더십 확인",
    leadershipSub: "오늘 관심을 기울여야 할 사람",
    showAll: (n) => `${n}개 모두 보기`,
    showLess: "접기",
    hostTags: {
      FOLLOW_UP_OVERDUE: "후속 확인 지연",
      FOLLOW_UP_NEEDED: "후속 확인 필요",
      SHARED_REVIEW_DUE: "공유 이해 검토 대기",
    },
    actionStatusEyebrow: (s) =>
      s.has("verification_pending") && s.has("awaiting_resolution")
        ? "행동 상태"
        : s.has("awaiting_resolution")
          ? "해결 대기 중"
          : "확인 대기 중",
    actionStatusSub: (n, s) =>
      s.has("verification_pending") && s.has("awaiting_resolution")
        ? `${n}개의 행동이 제출·전달되어 다음 단계를 기다리고 있습니다`
        : s.has("awaiting_resolution")
          ? `${n}개의 행동이 해결을 기다리고 있습니다`
          : `${n}개의 행동이 확인을 기다리고 있습니다`,
    actionStatusBadge: { verification_pending: "확인 대기 중", awaiting_resolution: "해결 대기 중" },
    actionStatusCopy: {
      verification_pending: "실행 결과가 제출되었으며 확인을 기다리고 있습니다.",
      awaiting_resolution: "이 실행은 상위 확인으로 전달되어 해결을 기다리고 있습니다.",
    },
    originalDeadline: "원래 기한",
    actionReviewsTitle: "행동 검토",
    actionReviewsSub: (n) => `${n}개의 행동이 검토를 기다리고 있습니다`,
    remoteReview: "원격 검토 가능",
    submittedOn: "제출",
    revisionNoteLabel: "수정 요청",
    stageCountsTitle: "현장 행동 계획",
    stageVerificationPending: "검토 대기",
    stageNeedsRevision: "수정 필요",
    stageReviewedAccepted: "검토·승인된 행동 계획",
    stageAwaitingResolution: "해결 대기",
  },
};

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null, loc: Locale): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function TodayPersonalBrief({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [brief, setBrief] = useState<Brief | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hostAttention, setHostAttention] = useState<HostAttention[]>([]);
  const [actionStatus, setActionStatus] = useState<ActionStatus[]>([]);
  const [hostActionReviews, setHostActionReviews] = useState<HostActionReview[]>([]);
  const [stageCounts, setStageCounts] = useState<StageCounts | null>(null);
  const [showAllHost, setShowAllHost] = useState(false);
  const [showAllAction, setShowAllAction] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tz = deviceTz();
    void (async () => {
      const qs = new URLSearchParams({ locale: loc });
      if (tz) qs.set("tz", tz);
      // Today brief (existing) — fail-soft.
      try {
        const res = await fetch(`/api/me/today/brief?${qs.toString()}`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as {
            ok?: boolean;
            brief?: Brief | null;
            reminders?: Reminder[];
            hostAttention?: HostAttention[];
            actionStatus?: ActionStatus[];
          };
          if (!cancelled && d?.ok) {
            setBrief(d.brief ?? null);
            setReminders(Array.isArray(d.reminders) ? d.reminders : []);
            setHostAttention(Array.isArray(d.hostAttention) ? d.hostAttention : []);
            setActionStatus(Array.isArray(d.actionStatus) ? d.actionStatus : []);
          }
        }
      } catch {
        /* fail-soft — brief renders nothing */
      }
      // Host Action Review queue (Slice 3.1B-3N Phase 5B) — independent, isolated failure.
      try {
        const res2 = await fetch(`/api/arena/action-review-queue?locale=${loc}`, { credentials: "include", cache: "no-store" });
        if (res2.ok) {
          const d2 = (await res2.json()) as { items?: HostActionReview[]; stageCounts?: StageCounts };
          if (!cancelled) {
            setHostActionReviews(Array.isArray(d2.items) ? d2.items : []);
            setStageCounts(d2.stageCounts ?? null);
          }
        }
      } catch {
        /* fail-soft — Action reviews subsection omitted */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loc]);

  const stageTotal = stageCounts
    ? stageCounts.verificationPending +
      stageCounts.needsRevision +
      stageCounts.reviewedAccepted +
      stageCounts.awaitingResolution
    : 0;
  const hasStageCounts = stageTotal > 0;

  if (!loaded) return null;
  if (
    !brief &&
    reminders.length === 0 &&
    hostAttention.length === 0 &&
    actionStatus.length === 0 &&
    hostActionReviews.length === 0 &&
    !hasStageCounts
  )
    return null;

  /*
    Slice 3.2R-R2 — the state chip is CATEGORY-AWARE, for one reason: an Apply Window that has
    closed is not an overdue task. The learner committed to something and the period ended; they
    have not failed, and nothing was missed. Sharing the generic red "Overdue" chip would make
    their own sentence read like a compliance breach, so APPLY_DUE gets calm vocabulary and a
    neutral tone while every other category is untouched.
  */
  const stateLabel = (s: Reminder["state"], c?: Reminder["category"]) => {
    if (c === "APPLY_DUE") {
      return s === "overdue" ? t.applyClosed : s === "due_today" ? t.applyLastDay : t.applyThisWeek;
    }
    return s === "overdue" ? t.overdue
      : s === "needs_revision" ? t.needsRevision
        : s === "due_today" ? t.dueToday
          : s === "active" ? t.applyThisWeek
            : s === "incomplete_required" ? t.incomplete
              : t.upcoming;
  };
  const catLabel = (c: Reminder["category"]) =>
    c === "REQUIRED_LEARNING" ? t.required
      : c === "ACTION_DUE" || c === "ACTION_REVISION" ? t.action
        : c === "PRACTICE_DUE" ? t.practice
          : c === "APPLY_DUE" ? t.apply
            : ""; // FOLLOW_UP_DUE carries its own eyebrow in the title
  // needs_revision is amber (actionable, not punitive) — NEVER the red overdue tone.
  const stateTone = (s: Reminder["state"], c?: Reminder["category"]) =>
    // An Apply Window is NEVER red, in any state. See stateLabel.
    c === "APPLY_DUE" ? (s === "due_today" ? "text-[#E5B769] border-[#C9A66B]/35" : "text-white/50 border-white/12")
    : s === "overdue" ? "text-red-300/80 border-red-400/30"
      : s === "needs_revision" ? "text-[#E5B769] border-[#C9A66B]/45"
        : s === "due_today" ? "text-[#E5B769] border-[#C9A66B]/35"
          : "text-white/50 border-white/12";

  const hostTagTone = (c: HostAttentionCategory) =>
    c === "FOLLOW_UP_OVERDUE" ? "text-red-300/80 border-red-400/30"
      : c === "FOLLOW_UP_NEEDED" ? "text-[#E5B769] border-[#C9A66B]/35"
        : "text-white/55 border-white/14";

  // Action-status badges are calm — NEVER red. Escalated is visually distinct (violet) from submitted (slate).
  const actionStatusTone = (s: ActionStatusState) =>
    s === "awaiting_resolution" ? "text-violet-200/80 border-violet-400/30" : "text-sky-200/75 border-sky-400/25";

  const hostVisible = showAllHost ? hostAttention : hostAttention.slice(0, HOST_PREVIEW);
  const actionVisible = showAllAction ? actionStatus : actionStatus.slice(0, ACTION_STATUS_PREVIEW);
  const actionStates = new Set(actionStatus.map((a) => a.status));
  const reviewsVisible = showAllReviews ? hostActionReviews : hostActionReviews.slice(0, ACTION_REVIEW_PREVIEW);

  return (
    <section data-testid="today-personal-brief" className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      {brief ? (
        <div className="flex flex-col gap-2" data-testid="brief-ai">
          <div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/80">{t.yesterday}</span>
            <p className="mt-0.5 text-sm leading-6 text-white/80">{brief.yesterdayObservation}</p>
          </div>
          <div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/80">{t.today}</span>
            <p className="mt-0.5 text-sm leading-6 text-white/80">{brief.todaySuggestion}</p>
          </div>
        </div>
      ) : null}

      {reminders.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="brief-reminders">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.dontMiss}</span>
          <ul className="flex flex-col gap-1.5">
            {reminders.map((r) => {
              const revisionNote =
                r.category === "ACTION_REVISION" && typeof r.note === "string" && r.note.trim() !== ""
                  ? r.note.trim()
                  : null;
              // Slice 3.2R-R2 — which training this decision came from. Quiet context, not a note.
              const applySource =
                r.category === "APPLY_DUE" && typeof r.note === "string" && r.note.trim() !== ""
                  ? r.note.trim()
                  : null;
              return (
                <li key={r.stableId} data-testid="brief-reminder" data-category={r.category} data-state={r.state}>
                  <a href={r.canonicalDeepLink} className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                        {catLabel(r.category) ? <span className="text-white/40">{catLabel(r.category)} · </span> : null}
                        {r.title}
                      </span>
                      <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.68rem] " + stateTone(r.state, r.category)}>{stateLabel(r.state, r.category)}</span>
                    </div>
                    {applySource ? (
                      <span data-testid="brief-apply-source" className="text-[0.66rem] text-white/35">
                        {applySource}
                      </span>
                    ) : null}
                    {revisionNote ? (
                      <div data-testid="brief-reminder-revision-note" className="flex flex-col gap-0.5 rounded-md border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-2.5 py-1.5">
                        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#E5B769]/80">{t.revisionNoteLabel}</span>
                        <span className="whitespace-pre-wrap text-xs leading-5 text-white/75">{revisionNote}</span>
                      </div>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {actionStatus.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="brief-action-status">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.actionStatusEyebrow(actionStates)}</span>
            <span className="text-[0.72rem] text-white/45">{t.actionStatusSub(actionStatus.length, actionStates)}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {actionVisible.map((a) => {
              const deadline = fmtDate(a.originalDeadline, loc);
              return (
                <li key={a.stableId} data-testid="action-status-row" data-status={a.status}>
                  <a href={a.deepLink} className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-white/80">{a.title}</span>
                      <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.66rem] " + actionStatusTone(a.status)}>{t.actionStatusBadge[a.status]}</span>
                    </div>
                    <span className="text-xs text-white/50">{t.actionStatusCopy[a.status]}</span>
                    {a.sourceTitle ? <span className="truncate text-xs text-white/40">{a.sourceTitle}</span> : null}
                    {deadline ? <span className="text-[0.7rem] text-white/35">{t.originalDeadline} · {deadline}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
          {actionStatus.length > ACTION_STATUS_PREVIEW ? (
            <button
              type="button"
              data-testid="action-status-toggle"
              onClick={() => setShowAllAction((v) => !v)}
              className="self-start pt-0.5 text-xs text-white/50 hover:text-white/80"
            >
              {showAllAction ? t.showLess : t.showAll(actionStatus.length)}
            </button>
          ) : null}
        </div>
      ) : null}

      {hostAttention.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="brief-host-attention">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">{t.leadershipTitle}</span>
            <span className="text-[0.72rem] text-white/45">{t.leadershipSub}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {hostVisible.map((h) => (
              <li key={h.stableId} data-testid="host-attention-row" data-category={h.category}>
                <a href={h.deepLink} className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{h.participantDisplayName}</span>
                    <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.66rem] " + hostTagTone(h.category)}>{t.hostTags[h.category]}</span>
                  </div>
                  <span className="truncate text-xs text-white/45">{h.trainingTitle}</span>
                  <span className="text-xs text-white/60">{h.reason}</span>
                </a>
              </li>
            ))}
          </ul>
          {hostAttention.length > HOST_PREVIEW ? (
            <button
              type="button"
              data-testid="host-attention-toggle"
              onClick={() => setShowAllHost((v) => !v)}
              className="self-start pt-0.5 text-xs text-white/50 hover:text-white/80"
            >
              {showAllHost ? t.showLess : t.showAll(hostAttention.length)}
            </button>
          ) : null}
        </div>
      ) : null}

      {hasStageCounts && stageCounts ? (
        <div className="flex flex-col gap-2" data-testid="action-review-stage-counts">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">
            {t.stageCountsTitle}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["verificationPending", t.stageVerificationPending, stageCounts.verificationPending],
              ["needsRevision", t.stageNeedsRevision, stageCounts.needsRevision],
              ["reviewedAccepted", t.stageReviewedAccepted, stageCounts.reviewedAccepted],
              ["awaitingResolution", t.stageAwaitingResolution, stageCounts.awaitingResolution],
            ] as const).map(([key, label, n]) => (
              <div
                key={key}
                data-testid={`stage-count-${key}`}
                data-count={n}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
              >
                <span className="min-w-0 truncate text-[0.72rem] text-white/55">{label}</span>
                <span className="shrink-0 text-sm font-semibold text-white/85">{n}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {hostActionReviews.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="brief-action-reviews">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">{t.actionReviewsTitle}</span>
            <span className="text-[0.72rem] text-white/45">{t.actionReviewsSub(hostActionReviews.length)}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {reviewsVisible.map((r) => {
              const submitted = fmtDate(r.submittedAt, loc);
              const deadline = fmtDate(r.originalDeadline, loc);
              return (
                <li key={r.actionContractId} data-testid="action-review-row" data-mode={r.verificationMode}>
                  <a
                    href={`/${locale}/app?tab=today&actionReview=${r.actionContractId}`}
                    className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{r.learnerLabel}</span>
                      <span className="shrink-0 rounded-md border border-sky-400/25 px-2 py-0.5 text-[0.66rem] text-sky-200/75">{r.statusLabel}</span>
                    </div>
                    {r.actionSummary ? <span className="truncate text-xs text-white/60">{r.actionSummary}</span> : null}
                    <span className="text-[0.7rem] text-white/40">{t.remoteReview}</span>
                    {submitted ? <span className="text-[0.7rem] text-white/35">{t.submittedOn} · {submitted}</span> : null}
                    {deadline ? <span className="text-[0.7rem] text-white/35">{t.originalDeadline} · {deadline}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
          {hostActionReviews.length > ACTION_REVIEW_PREVIEW ? (
            <button
              type="button"
              data-testid="action-review-toggle"
              onClick={() => setShowAllReviews((v) => !v)}
              className="self-start pt-0.5 text-xs text-white/50 hover:text-white/80"
            >
              {showAllReviews ? t.showLess : t.showAll(hostActionReviews.length)}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
