"use client";

import { useCallback, useEffect, useState } from "react";

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
  status: "assigned" | "completed";
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
  onOpenMyLearning = () => {},
}: {
  locale: string;
  /** Open the learner's own My Learning / private reflection history (Slice 3.1B-3H). */
  onOpenMyLearning?: () => void;
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
  // The signed-in email for the compact "Learning account" line — read from the
  // authenticated session endpoint (never inferred from profile/membership).
  const [email, setEmail] = useState<string | null>(null);

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

  const loadEmail = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; user?: { email?: string | null } };
      if (data?.ok && data.user?.email) setEmail(data.user.email);
    } catch {
      /* leave email null; the Switch action still works */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadEmail();
    // Refresh when the app returns to the foreground (return-from-Room, tab focus).
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
        void loadEmail();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load, loadEmail]);

  // Pre-first-response hold: render nothing (bounded — the fetch resolves fast). The
  // host room below is unaffected.
  if (assignments === null) return null;

  const required = assignments.filter((a) => a.status === "assigned");
  const completed = assignments.filter((a) => a.status === "completed");

  return (
    <section className="flex flex-col gap-6" data-testid="foundry-required-learning" aria-label={t.requiredHeader}>
      {/* Discoverable entry to the learner's own private reflection history (Slice 3.1B-3H). */}
      <button
        type="button"
        onClick={onOpenMyLearning}
        data-testid="open-my-learning"
        className="flex items-center justify-between gap-2 rounded-xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-[#C9A66B]">{loc === "ko" ? "내 학습" : "My Learning"}</span>
        <span aria-hidden="true" className="text-sm text-[#C9A66B]/70">→</span>
      </button>
      {/* Compact contextual account line — WHO this required-learning list belongs to. Account
          SWITCHING is consolidated to the single Me-tab control (Slice 3.1B-3N-5B.1): no duplicate
          switch here. */}
      <div
        data-testid="foundry-learning-account"
        className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5"
      >
        <span className="min-w-0 truncate text-xs text-white/50">
          {t.learningAccount}: <span className="text-white/75" data-testid="foundry-account-email">{email ?? "…"}</span>
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
            {t.requiredHeader}
          </h2>
          <p className="text-sm leading-6 text-white/50">{t.requiredSub}</p>
        </div>

        {required.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {required.map((a) => (
              <RequiredCard key={a.assignmentId} a={a} t={t} loc={loc} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center"
            data-testid="required-empty"
          >
            <p className="text-[0.95rem] font-medium text-white/80">{t.emptyTitle}</p>
            <p className="mt-1 text-sm leading-6 text-white/45">{t.emptyBody}</p>
          </div>
        )}
      </div>

      {completed.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
              {t.completedHeader}
            </h2>
            <p className="text-sm leading-6 text-white/40">{t.completedSub}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {completed.map((a) => (
              <CompletedCard key={a.assignmentId} a={a} t={t} loc={loc} onOpenReview={onOpenReview} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RequiredCard({ a, t, loc }: { a: Assignment; t: Copy; loc: Locale }) {
  const date = fmtDate(a.assignedAt, loc);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#C9A66B]/30 bg-[#C9A66B]/[0.05] px-4 py-3.5">
      <div className="flex min-w-0 flex-col">
        <span className="min-w-0 truncate text-[0.98rem] font-medium text-white/90">{a.title}</span>
        {date ? <span className="text-xs text-white/40">{t.assignedOn(date)}</span> : null}
      </div>
      {/* Same-origin anchor: navigates the WebView to the live Room (session preserved), and
          carries a sanitized return target so the Room can offer "Back to Foundry". No
          target=_blank — a new WKWebView context would not share the auth cookie. */}
      <a
        href={`${a.roomUrl}?return=${encodeURIComponent(`/${loc}/app?tab=foundry`)}`}
        className="shrink-0 rounded-lg bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
      >
        {t.startCta}
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
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
