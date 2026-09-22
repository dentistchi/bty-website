"use client";

import { FoundryTrainingDetail } from "./FoundryTrainingDetail";
import { useCallback, useEffect, useRef, useState } from "react";
import { readContentType, type FoundryContentType } from "@/domain/foundry/events/content-type";
import { contentTypeLabel } from "./contentTypeLabel";
import type { EvidenceLevel } from "@/domain/foundry/module/program-authorship";

/**
 * Foundry → My Learning (Slice 3.1B-3I re-placement).
 *
 * Foundry answers "what did I learn and understand?" — so the PRIMARY artifact is the learner's
 * OWN Shared Understanding answer, NOT the Private Reflection (that now lives canonically in
 * Center). Reuses the owner-scoped GET /api/bty/foundry/history (linked_user_id = caller). Each
 * row links to the exact Center reflection via ?tab=center&view=reflections&entry=<entryId>.
 * Explicit DTO allow-list — never the raw row; never Host review notes.
 */

type Locale = "en" | "ko";

/** Explicit client DTO allow-list — the private responseText is deliberately NOT read here. */
type MyLearningItem = {
  entryId: string;
  eventId: string;
  eventTitle: string;
  /** R4-R2G — all four types; null = unknown stored discriminator (rendered as a neutral dash). */
  contentType: FoundryContentType | null;
  completedAt: string;
  sharedUnderstanding: string | null;
  /**
   * What the learner decided to DO (Slice 3.2R-R1.1). null when the published journey asked for
   * no decision — then the section is ABSENT, never an empty box. Never BTY's proposed sentence.
   */
  decisionResponse: string | null;
  quizScore: { correctCount: number; totalCount: number; scorePercent: number } | null;
};

/**
 * A follow-up on this record that can still take a later check-in (Slice 3.2R-R3-R1).
 *
 * THE ID IS CARRIED, NOT RECONSTRUCTED. A record may hold both a 7- and a 30-day obligation, and
 * matching one by event, title or checkpoint would eventually open the wrong question. The server
 * sends the durable `followupId` and this surface passes exactly that back.
 */
type CheckInAgainTarget = {
  followupId: string;
  followUpDays: number;
  outcome: string;
};

/**
 * A follow-up on this record that has NO answer yet (Slice 3.2R-R3-R2).
 *
 * A SEPARATE LIST, NOT A FLAG ON THE ONE ABOVE. Today now stops asking about an unanswered
 * follow-up after its 7-day attention window, so this is the route that keeps it reachable — and
 * it must never borrow the other CTA's words. "Check in again" and "You reported earlier" are
 * both false for someone who has not reported at all. Keeping them as two typed lists means this
 * component cannot conflate them even by accident: there is no status string here to branch on.
 *
 * The SERVER decides membership (it owns the clock, the reader timezone and the BTY-day frame).
 * This surface renders what it was handed and infers nothing.
 */
type OpenFollowUpTarget = {
  followupId: string;
  followUpDays: number;
};


const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  decisionLabel: string;
  noShared: string;
  viewInCenter: string;
  completedOn: string;
  video: string;
  document: string;
  empty: string;
  emptyHint: string;
  backDefault: string;
  loading: string;
  reviewedOn: string;
  /** Slice 3.2R-R3-R1 — the return route to a follow-up that can still take a later report. */
  checkInAgain: string;
  checkInAgainAt: (days: number) => string;
  /** Slice 3.2R-R3-R2 — the return route to a follow-up with no answer yet. Never "again". */
  followUp: string;
  followUpAt: (days: number) => string;
  /**
   * Deferred Completion Claim V1 — the one permanent door for a training finished without an
   * account. It lives HERE, in the surface that owns completed learning, rather than in Me or on
   * the Learn landing: one door, in the place the result will appear.
   */
}> = {
  en: {
    title: "My Learning",
    subtitle: "What you understood, in your own words.",
    decisionLabel: "What I decided",
    // Deliberately does NOT say "nothing here is overdue": naming the anxiety in order to deny it
    // is what plants it. States what the strip is, and lets the absence of urgency speak.
    noShared: "No shared understanding was recorded for this training.",
    viewInCenter: "View my private reflection in Center",
    completedOn: "Completed",
    video: "Video",
    document: "PDF",
    empty: "No completed trainings yet.",
    emptyHint: "When you finish a training, it appears here with what you understood.",
    // Default parent = the Learn/Required-learning origin. An explicit `backLabel` overrides this
    // per origin (B3A.2D-R1) — e.g. the Me-tab origin passes "Me" so a personal-history surface
    // returns to Me, never leaking "Required learning" as its parent.
    backDefault: "Required learning",
    loading: "Loading…",
    reviewedOn: "Reviewed",
    checkInAgain: "Check in again",
    // Only used when a record carries more than one checkpoint, so the two CTAs are tellable apart.
    checkInAgainAt: (days) => `Check in again · ${days}-day follow-up`,
    // No "again", no "still", no "overdue". There is no earlier answer to refer back to and no
    // deadline to press on: the checkpoint arrived, and this is the way in — whenever the learner
    // gets to it. The parallel "· N-day follow-up" suffix is the shipped multi-checkpoint pattern.
    followUp: "Follow up",
    followUpAt: (days) => `Follow up · ${days}-day follow-up`,
  },
  ko: {
    title: "내 학습",
    subtitle: "내가 이해한 내용을 나의 말로.",
    decisionLabel: "내가 결정한 것",
    noShared: "이 교육에는 공유 이해 답변이 없습니다.",
    viewInCenter: "Center에서 나의 비공개 성찰 보기",
    completedOn: "완료",
    video: "영상",
    document: "PDF",
    empty: "아직 완료한 교육이 없습니다.",
    emptyHint: "교육을 마치면 여기에서 이해한 내용을 볼 수 있습니다.",
    backDefault: "필수 학습",
    loading: "불러오는 중…",
    reviewedOn: "검토됨",
    checkInAgain: "다시 확인하기",
    checkInAgainAt: (days) => `다시 확인하기 · ${days}일 후 확인`,
    // "다시"(again) is deliberately absent — there is no earlier answer.
    followUp: "확인하기",
    followUpAt: (days) => `확인하기 · ${days}일 후 확인`,
  },
};

function formatDate(iso: string, loc: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function FoundryMyLearning({
  locale,
  onBack,
  backLabel,
  focusEntryId = null,
  onOpenFollowUp,
}: {
  locale: string;
  onBack: () => void;
  /** Origin-aware parent name (B3A.2D-R1). Me-origin passes "Me"; Learn-origin omits it → the
   *  measured "Required learning" default. Explicit per call — never inferred from tab/history. */
  backLabel?: string;
  /**
   * THE RECORD TODAY POINTED AT (Slice R4-R5C1). An Apply this week card names the learner's own
   * commitment sentence; this is the `foundry_event_training_progress.id` behind it, which is the
   * same id these rows key on (`entryId`). Brought into view and outlined so the learner lands on
   * their sentence instead of a list. Presentation only — no state, no write — and an unknown or
   * stale id focuses nothing. Same prop shape as `CenterRealityFeed`'s `focusEntryId`.
   */
  focusEntryId?: string | null;
  /**
   * Slice 3.2R-R3-R1 — open THIS follow-up's response surface IN-SHELL. A button + callback, never
   * an `<a href>`: a row already inside the app is an app-shell command, and the raw-href form is
   * what 3.2G-R2 had to replace after the cold first tap was swallowed by the WKWebView navigation
   * policy. Absent → the CTA does not render at all, rather than rendering a dead control.
   */
  onOpenFollowUp?: (followupId: string) => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const backText = `← ${backLabel ?? t.backDefault}`;
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [items, setItems] = useState<MyLearningItem[] | null>(null);
  /*
    THE DOOR BACK IN (Deferred Completion Claim V1). A learner who finished without signing in was
    given a code and nothing else; this is the only place in the app that spends it. The raw code
    is held for the length of one submit and never stored.
  */
  const focusRef = useRef<HTMLLIElement | null>(null);

  /*
    Bring the named record into view once the list exists — `block: "center"`, no smooth behaviour,
    matching `CenterRealityFeed`. A stale id matches no row, so `focusRef` stays null and nothing
    scrolls; the list is still perfectly usable.
  */
  useEffect(() => {
    if (!focusEntryId || !items) return;
    const el = focusRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
  }, [focusEntryId, items]);
  // entryId → established rungs. Absent = not loaded / unavailable → the strip simply does not
  // render for that row. Evidence is secondary; its absence must never blank a completion.
  // entryId → follow-ups the SERVER says can still take a later check-in (Slice 3.2R-R3-R1).
  // Absent/empty = no CTA. This surface never decides eligibility; it renders what it was told.
  const [checkInAgain, setCheckInAgain] = useState<Map<string, CheckInAgainTarget[]>>(new Map());
  // entryId → follow-ups the SERVER says are still awaiting a FIRST answer (Slice 3.2R-R3-R2).
  // Kept apart from the map above so the two CTAs can never be rendered with each other's words.
  const [openFollowUp, setOpenFollowUp] = useState<Map<string, OpenFollowUpTarget[]>>(new Map());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/history", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = (await res.json()) as {
        history?: Array<{ entryId?: string; eventId?: string; eventTitle?: string; contentType?: string; completedAt?: string; sharedUnderstanding?: string | null; decisionResponse?: string | null; quizScore?: { correctCount?: number; totalCount?: number; scorePercent?: number } | null }>;
      };
      // Allow-list mapping — responseText (Private Reflection) is intentionally NOT read here.
      const mapped: MyLearningItem[] = (data?.history ?? []).map((h) => ({
        entryId: String(h.entryId ?? ""),
        eventId: String(h.eventId ?? ""),
        eventTitle: String(h.eventTitle ?? "Foundry training"),
        contentType: readContentType(h.contentType),
        completedAt: String(h.completedAt ?? ""),
        sharedUnderstanding: h.sharedUnderstanding ? String(h.sharedUnderstanding) : null,
        decisionResponse: h.decisionResponse ? String(h.decisionResponse) : null,
        quizScore: h.quizScore && typeof h.quizScore.correctCount === "number" && typeof h.quizScore.totalCount === "number" && typeof h.quizScore.scorePercent === "number" ? { correctCount: h.quizScore.correctCount, totalCount: h.quizScore.totalCount, scorePercent: h.quizScore.scorePercent } : null,
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    }
  }, []);


  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    const onFocus = () => {
      void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  /*
    LEVEL 2 REPLACES LEVEL 1 IN PLACE. This surface lives inside the app shell, so opening a
    training is shell state — never a navigation, and never a link out of the product.
  */
  if (openEntryId) {
    return (
      <FoundryTrainingDetail
        entryId={openEntryId}
        locale={loc}
        onBack={() => setOpenEntryId(null)}
        reflectionHref={`/${loc}/app?tab=center&view=reflections&entry=${encodeURIComponent(openEntryId)}`}
        onOpenFollowUp={onOpenFollowUp}
        /*
          NO "Since this training" SECTION, ANYWHERE. The only datum available for one is
          `completionState`, a raw `pass | review | incomplete` enum, and turning that into a
          sentence would be BTY deciding what a learner's follow-up meant. What IS actionable —
          an unanswered follow-up, or one still open to a later check-in — is passed through
          below and shown only when there is genuinely something to do.
        */
      />
    );
  }

  return (
    <section data-testid="foundry-my-learning" className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-white/90">{t.title}</h2>
          <p className="text-xs text-white/50">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          data-testid="my-learning-back"
          className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70"
        >
          {backText}
        </button>
      </div>

      {/*
        THE COMPLETION-CODE DOOR IS GONE (Slice No-Browser-Escape V1, Founder decision).

        It existed for someone who finished a training without signing in and then wanted it on
        their account. Every production learner now arrives with an authenticated BTY account, so
        the surface was asking a real person to solve a problem they do not have — and a code
        field is a thing to get wrong, not a feature.

        The SERVER path is deliberately left in place: `/api/bty/foundry/completion-claim` and its
        minting still work, and two unexpired codes exist in production against two anonymous
        completions. Removing redemption as well would strand them, which is a separate decision
        about historical records rather than a consequence of taking a field off a screen.
      */}

      {items === null ? (
        <p className="text-sm text-white/40" role="status">{t.loading}</p>
      ) : items.length === 0 ? (
        <div data-testid="my-learning-empty" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-sm text-white/70">{t.empty}</p>
          <p className="mt-1 text-xs text-white/45">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => {
            const focused = !!focusEntryId && it.entryId === focusEntryId;
            return (
            <li
              key={it.entryId}
              ref={focused ? (el) => { focusRef.current = el; } : undefined}
              data-testid="my-learning-item"
              data-entry-id={it.entryId}
              data-focused={focused ? "1" : undefined}
              className={
                "rounded-2xl border bg-white/[0.03] " +
                (focused ? "border-[#C9A66B]/60 ring-1 ring-[#C9A66B]/40" : "border-white/[0.08]")
              }
            >
              {/*
                THE WHOLE ROW IS THE DOOR, AND THE ROW IS ALL THERE IS.

                A learning history is read by someone scanning for one training among a hundred.
                Everything that used to sit here — the content-type badge, what they understood,
                the score, the follow-up state, the reflection link — answered a question they had
                not asked yet, and answering it in the list meant the list could never be scanned.
                Each of those now lives one tap in, where it is the thing being looked at.
              */}
              <button
                type="button"
                onClick={() => setOpenEntryId(it.entryId)}
                data-testid="my-learning-open-detail"
                data-entry-id={it.entryId}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[0.95rem] font-medium text-white/90">{it.eventTitle}</span>
                  <span className="text-xs text-white/45">
                    {t.completedOn} · {formatDate(it.completedAt, loc)}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-white/30">›</span>
              </button>
            </li>
            );
          })}
        </ul>
      )}

      {/*
        REVIEWED ACTION PLANS REMOVED from the learner history (Founder decision).

        It was a Host-workflow artefact — "Reviewed action plans", with module versions and
        who/what/how/when rows — sitting under a list whose job is to answer "what have I
        completed". Reviewing is something that happens TO a plan, and naming that state here
        made the learner read an internal workflow label to find their own learning.

        Deliberately NOT renamed into a learner-facing section: there is no measured need for a
        distinct concept here, and inventing one would be a new product idea rather than the
        removal that was asked for. The reviewed-plans API is untouched.
      */}
    </section>
  );
}
