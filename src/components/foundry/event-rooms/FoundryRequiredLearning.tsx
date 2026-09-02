"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Foundry REQUIRED LEARNING — the installed-app learner surface (Slice 3.1B-3E).
 *
 * A logged-in learner discovers the required learning assigned to them WITHOUT
 * already holding the Room link. It self-fetches GET /api/bty/foundry/assignments/mine
 * (credentials-included, fail-soft) and renders two honest sections: Required
 * (assigned) and Completed (completed). It computes no state — status comes straight
 * from the server; there is NO optimistic completion.
 *
 * Room opening reuses the canonical /f/<token> URL the server minted. It is same-origin
 * with the app, so the anchor navigates INSIDE the WebView (preserving the Supabase
 * session the claim needs) rather than leaking to an external browser. Opening creates
 * no participant and awards no XP — join + claim stay separate, explicit actions in the
 * Room. On return to the app (remount) and on foreground/visibility, we re-fetch so a
 * completed item moves Required -> Completed only after the server confirms it.
 */

type Locale = "en" | "ko";

type Assignment = {
  assignmentId: string;
  eventId: string;
  /**
   * R4-R5C3A2 — `in_progress` is a DERIVED read-time projection, never a stored assignment
   * state. It means only: this account has already started this training. It is still REQUIRED
   * learning, so it groups with `assigned`; only the button label differs.
   */
  status: "assigned" | "in_progress" | "completed";
  title: string;
  assignedAt: string;
  completedAt: string | null;
  roomUrl: string;
  participationMode: "assigned_overlay";
};

type Copy = {
  learningAccount: string;
  switchCta: string;
  requiredHeader: string;
  requiredSub: string;
  emptyTitle: string;
  emptyBody: string;
  completedHeader: string;
  completedSub: string;
  startCta: string;
  /** R4-R5C3A2 — shown when this account has truthfully started this training. */
  continueCta: string;
  reviewCta: string;
  completedTag: string;
  assignedOn: (d: string) => string;
  completedOn: (d: string) => string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    learningAccount: "Learning account",
    switchCta: "Switch",
    requiredHeader: "Required learning",
    requiredSub: "Learning assigned to you by your organization.",
    emptyTitle: "Nothing required right now",
    emptyBody: "You have no assigned learning waiting.",
    completedHeader: "Completed",
    completedSub: "Learning you have finished and connected to your account.",
    startCta: "Start learning",
    /*
      THE ESTABLISHED PAIR, NOT A NEW ONE (R4-R5C3A2). `TodayHome` already ships exactly
      "Continue learning" / "학습 계속하기" for its continue-a-program fallback, so this reuses
      the product's own vocabulary rather than introducing a second phrasing for one idea.

      WHAT IT DELIBERATELY DOES NOT SAY. No "Resume", no "Your progress is saved", no "Continue
      where you left off", no "Your answers are saved". This slice proves ONE thing — that this
      account started this training — and cross-device position restore is not among the things
      it can honestly promise: a second device still creates its own participant, typed answers
      are still written only at completion, and video position is still per-tab sessionStorage.
    */
    continueCta: "Continue learning",
    reviewCta: "Review learning",
    completedTag: "Completed",
    assignedOn: (d) => `Assigned ${d}`,
    completedOn: (d) => `Completed ${d}`,
  },
  ko: {
    learningAccount: "학습 계정",
    switchCta: "전환",
    requiredHeader: "필수 학습",
    requiredSub: "조직에서 나에게 배정한 학습입니다.",
    emptyTitle: "지금 필요한 학습이 없습니다",
    emptyBody: "현재 기다리고 있는 배정 학습이 없습니다.",
    completedHeader: "완료한 학습",
    completedSub: "완료 후 내 계정과 연결된 학습입니다.",
    startCta: "학습 시작",
    continueCta: "학습 계속하기",
    reviewCta: "학습 다시 보기",
    completedTag: "완료",
    assignedOn: (d) => `배정일 ${d}`,
    completedOn: (d) => `완료일 ${d}`,
  },
};

/** Presentation-only date label (no business logic). Blank on an unparseable value. */
function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FoundryRequiredLearning({
  locale,
  onOpenReview = () => {},
  focusAssignmentId = null,
  onFocusConsumed,
}: {
  locale: string;
  /**
   * TODAY NAMED THIS ONE (Slice R4-R5C1). The assignment a Today Required Learning card pointed
   * at: brought into view and outlined so the learner recognises it without reading the list. It
   * changes NO state — not completion, not status, not the card's own controls — and a stale or
   * unknown id simply focuses nothing. Reuses the `focusEntryId` pattern already shipped in
   * `CenterRealityFeed`: prop → ref → `scrollIntoView` → a `focused` flag on the card.
   */
  focusAssignmentId?: string | null;
  /** Told once the focus has been shown, so a later Back does not re-focus a card. */
  onFocusConsumed?: () => void;
  /** Open the learner's own My Learning / private reflection history (Slice 3.1B-3H). */
  /** Open the authenticated read-only review for a COMPLETED assignment (never the Room). */
  onOpenReview?: (assignmentId: string) => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];

  // null = not yet resolved (bounded hold — never an indefinite skeleton). On a
  // resolved response we render the sections; on error we keep the last known list
  // (initially null -> the surface simply stays absent) rather than asserting a false
  // "nothing required".
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);
  // Completed history is collapsed by default (B3A.2C) so it never dominates the
  // Learn screen; returning to Learn root resets to collapsed (fresh mount).
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/assignments/mine", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return; // keep prior state; never surface an error card
      const data = (await res.json()) as { ok?: boolean; assignments?: Assignment[] };
      if (data?.ok && Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
      }
    } catch {
      /* transient — keep prior state */
    }
  }, []);

  useEffect(() => {
    void load();
    // Refresh when the app returns to the foreground (return-from-Room, tab focus).
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  /*
    Bring the named card into view once the list exists. `block: "center"` and no smooth behaviour,
    matching `CenterRealityFeed` — a stable initial position rather than an animation, so nothing
    moves under a learner who is already reading. Guarded on the id actually matching a row, so a
    stale link scrolls nothing.
  */
  useEffect(() => {
    if (!focusAssignmentId || !assignments) return;
    const el = focusRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
    onFocusConsumed?.();
  }, [focusAssignmentId, assignments, onFocusConsumed]);

  // Pre-first-response hold: render nothing (bounded — the fetch resolves fast). The
  // host room below is unaffected.
  if (assignments === null) return null;

  /*
    `in_progress` GROUPS WITH REQUIRED, not with completed (R4-R5C3A2). It is the same
    outstanding obligation; only the label on its button changes. Filtering it out here would
    make a started training vanish from the learner's list — the failure this slice exists to
    prevent, not cause.
  */
  const required = assignments.filter((a) => a.status === "assigned" || a.status === "in_progress");
  const completed = assignments.filter((a) => a.status === "completed");

  return (
    <section className="flex flex-col gap-6" data-testid="foundry-required-learning" aria-label={t.requiredHeader}>
      {/* B3A.2C Learn hygiene: one My learning surface (the LearnDoors door owns the
          entry). The duplicate My-Learning pill and the "Learning account: <email>"
          block are removed from the content area — account controls live in Me;
          assignment loading is still session-scoped (isolation unchanged). */}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
            {t.requiredHeader}
          </h2>
          <p className="text-sm leading-6 text-white/50">{t.requiredSub}</p>
        </div>

        {required.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {required.map((a) => {
              const focused = !!focusAssignmentId && a.assignmentId === focusAssignmentId;
              return (
                <RequiredCard
                  key={a.assignmentId}
                  a={a}
                  t={t}
                  loc={loc}
                  focused={focused}
                  refCb={focused ? (el) => { focusRef.current = el; } : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-center"
            data-testid="required-empty"
          >
            <p className="text-[0.95rem] font-medium text-white/80">{t.emptyTitle}</p>
            <p className="mt-1 text-sm leading-6 text-white/45">{t.emptyBody}</p>
          </div>
        )}
      </div>

      {completed.length > 0 ? (
        <div className="flex flex-col gap-2">
          {/* Completed is a compact disclosure, collapsed by default (B3A.2C) — the
              count is always visible; the cards render only when expanded. */}
          <button
            type="button"
            data-testid="completed-disclosure"
            aria-expanded={showCompleted}
            aria-controls="foundry-completed-list"
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-white/75">
              {t.completedHeader} ({completed.length}) · {t.reviewCta}
            </span>
            <span aria-hidden="true" className="shrink-0 text-white/45">{showCompleted ? "▲" : "▼"}</span>
          </button>
          {showCompleted ? (
            <div id="foundry-completed-list" data-testid="completed-list" className="flex flex-col gap-2.5">
              {completed.map((a) => (
                <CompletedCard key={a.assignmentId} a={a} t={t} loc={loc} onOpenReview={onOpenReview} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RequiredCard({
  a,
  t,
  loc,
  focused = false,
  refCb,
}: {
  a: Assignment;
  t: Copy;
  loc: Locale;
  /** Outlined because Today named this exact training. Presentation only — no state, no write. */
  focused?: boolean;
  refCb?: (el: HTMLDivElement | null) => void;
}) {
  const date = fmtDate(a.assignedAt, loc);
  return (
    <div
      ref={refCb}
      data-testid="required-card"
      data-assignment-id={a.assignmentId}
      data-focused={focused ? "1" : undefined}
      className={
        "flex items-center justify-between gap-3 rounded-xl border bg-[#C9A66B]/[0.05] px-4 py-3.5 " +
        (focused ? "border-[#C9A66B]/60 ring-1 ring-[#C9A66B]/40" : "border-[#C9A66B]/30")
      }
    >
      <div className="flex min-w-0 flex-col">
        <span className="min-w-0 truncate text-[0.98rem] font-medium text-white/90">{a.title}</span>
        {date ? <span className="text-xs text-white/40">{t.assignedOn(date)}</span> : null}
      </div>
      {/* Same-origin anchor: navigates the WebView to the live Room (session preserved), and
          carries a sanitized return target so the Room can offer "Back to Learn" (R4-R5B2). No
          target=_blank — a new WKWebView context would not share the auth cookie. */}
      {/*
        THE SAME ROOM URL EITHER WAY (R4-R5C3A2). Continue carries no participant id, user id,
        resume token or progress id — the public capability model is untouched. Once inside, the
        device's own participant session decides what can actually be restored; the label only
        tells the learner what BTY already knows.
      */}
      <a
        href={`${a.roomUrl}?return=${encodeURIComponent(`/${loc}/app?tab=foundry`)}`}
        data-status={a.status}
        className="shrink-0 rounded-lg bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
      >
        {a.status === "in_progress" ? t.continueCta : t.startCta}
      </a>
    </div>
  );
}

function CompletedCard({
  a,
  t,
  loc,
  onOpenReview,
}: {
  a: Assignment;
  t: Copy;
  loc: Locale;
  onOpenReview: (assignmentId: string) => void;
}) {
  const date = fmtDate(a.completedAt, loc);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
      <div className="flex min-w-0 flex-col">
        <span className="min-w-0 truncate text-[0.98rem] font-medium text-white/80">{a.title}</span>
        <span className="text-xs text-emerald-300/70">
          {t.completedTag}
          {date ? ` · ${t.completedOn(date)}` : ""}
        </span>
      </div>
      {/* A completed assignment MUST NOT reopen the anonymous Room. "Review learning" opens
          the authenticated read-only review in-shell — no participant, no XP, no join. */}
      <button
        type="button"
        onClick={() => onOpenReview(a.assignmentId)}
        className="shrink-0 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/70"
      >
        {t.reviewCta}
      </button>
    </div>
  );
}
