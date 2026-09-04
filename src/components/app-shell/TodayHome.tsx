"use client";

import { useEffect, useMemo, useState } from "react";
import NeedsYourResponse from "@/components/app-shell/NeedsYourResponse";
import TrackingSent from "@/components/app-shell/TrackingSent";
import { buildYesterdaySummary, type YesterdayCounts } from "@/domain/daily/yesterdaySummary";
import { normalizeTodayItems, todayVisible } from "@/domain/daily/todayList";
import {
  selectPrimaryAction,
  type PrimaryActionCandidate,
  type PrimaryActionResult,
} from "@/domain/daily/todayPrimaryAction";
import { parseHostDeepLink, type HostFocusSection } from "@/components/app-shell/hostDeepLink";
import { applyStateTone, applyTimingChip } from "@/components/app-shell/applyWindowCopy";

/**
 * Today — simplified hierarchy (App Shell + Today Simplification V1, Phases 3–4 + empty-state patch).
 *
 * The first viewport shows a CALM summary only:
 *   A. Better Than Yesterday header
 *   B. Yesterday summary   (measured self-return only — never fabricated progress)
 *   C. One primary next action   (deterministic domain selector; ALWAYS exactly one CTA)
 *   D. Needs your attention   (collapsed learner + Host counts, when non-zero)
 *   F. Show everything   (reveals the full, unchanged detailed projections)
 *
 * Empty-state contract: Today must ALWAYS render exactly one actionable primary CTA. When no due
 * work exists the selector falls back deterministically — continue an in-progress program → start an
 * available Arena practice → find a program in Learn — never a decorative message without a CTA.
 * Fallback signals are measured (in-progress program %, available-practice count); nothing fabricated.
 * Fallback CTAs navigate IN-SHELL via {@link onNavigate} (Practice/Learn tab), no route reload.
 *
 * This component computes only PROJECTION/priority (the selector is a pure domain function); it
 * introduces no new engine, no new ranking, and no new server data. Fail-soft throughout: if the
 * fallback reads fail, the always-valid "find a program" CTA still renders.
 */

type Locale = "en" | "ko";

type Reminder = {
  stableId: string;
  category: PrimaryActionCandidate["category"];
  title: string;
  state: PrimaryActionCandidate["state"];
  canonicalDeepLink: string;
  /** APPLY_DUE → the source training title. ACTION_REVISION → the Host's note (not rendered here). */
  note?: string | null;
};
type HostAttentionCategory = "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED" | "SHARED_REVIEW_DUE";
type FollowUpCategory = "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED";
// The brief endpoint already ships the full navigation summary (participant/training/reason/deepLink);
// earlier this type narrowed to {stableId,category} and dropped the FOLLOW_UP rows on the floor (3.2G).
type HostAttention = {
  stableId: string;
  category: HostAttentionCategory;
  eventId?: string;
  focusId?: string;
  participantDisplayName?: string;
  trainingTitle?: string;
  reason?: string;
  sourceTimestamp?: string;
  deepLink?: string;
};
type HostActionReview = { actionContractId: string };

const COPY: Record<Locale, {
  eyebrow: string;
  yesterday: string;
  yesterdayReturned: string;
  yesterdayQuiet: string;
  nextStep: string;
  attention: string;
  corrections: (n: number) => string;
  reviews: (n: number) => string;
  followups: (n: number) => string;
  leadershipSub: string;
  hostTags: Record<FollowUpCategory, string>;
  showEverything: string;
  showLess: string;
  todayHeader: string;
  showMore: string;
  /** A destination, not an obligation — no count, no urgency. */
  savedForLater: string;
  savedForLaterSub: string;
  todayEmpty: string;
  catEyebrow: Record<PrimaryActionCandidate["category"], string>;
  // Deterministic empty-day fallbacks (tiers 6–8).
  fallbackHeader: string;
  continueBody: string;
  continueCta: string;
  practiceBody: string;
  practiceCta: string;
  findBody: string;
  findCta: string;
}> = {
  en: {
    eyebrow: "BETTER THAN YESTERDAY",
    yesterday: "Yesterday",
    yesterdayReturned: "You showed up yesterday.",
    yesterdayQuiet: "Yesterday was quiet. Begin with one small step today.",
    nextStep: "Your next step",
    attention: "Your team needs you",
    corrections: (n) => `${n} action${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} your correction`,
    reviews: (n) => `${n} action plan${n === 1 ? "" : "s"} awaiting your review`,
    followups: (n) => `${n} follow-up${n === 1 ? "" : "s"} due`,
    leadershipSub: "People who may need your attention today",
    hostTags: { FOLLOW_UP_OVERDUE: "Follow-up overdue", FOLLOW_UP_NEEDED: "Needs follow-up" },
    showEverything: "Show everything",
    showLess: "Show less",
    todayHeader: "Today",
    showMore: "Show more",
    savedForLater: "Saved for later",
    savedForLaterSub: "Things you chose not to lose.",
    todayEmpty: "You're all caught up for today.",
    catEyebrow: {
      ACTION_REVISION: "Needs revision",
      ACTION_DUE: "Action due",
      REQUIRED_LEARNING: "Required learning",
      PRACTICE_DUE: "Practice due",
      // Slice 3.2R-R2. Not "Action due" — that is the Arena contract above, and this is the
      // learner's own sentence coming back to them. Not a deadline word, because the window is
      // not a deadline: nothing fails when it closes.
      APPLY_DUE: "Apply this week",
      FOLLOW_UP_DUE: "Follow-up due",
    },
    fallbackHeader: "Your next step",
    continueBody: "Continue what you started.",
    continueCta: "Continue learning",
    practiceBody: "Practice one real-world decision.",
    practiceCta: "Start practice",
    findBody: "Choose one thing to get better at today.",
    findCta: "Find a program",
  },
  ko: {
    eyebrow: "어제보다 나은 나",
    yesterday: "어제",
    yesterdayReturned: "어제 당신은 이 자리에 왔습니다.",
    yesterdayQuiet: "어제는 조용했습니다. 오늘 작은 한 걸음으로 시작하세요.",
    nextStep: "오늘의 다음 걸음",
    attention: "당신의 손길이 필요합니다",
    corrections: (n) => `${n}개의 행동에 수정이 필요합니다`,
    reviews: (n) => `${n}개의 행동 계획이 검토를 기다리고 있습니다`,
    followups: (n) => `${n}개의 후속 확인이 예정되어 있습니다`,
    leadershipSub: "오늘 관심을 기울여야 할 사람",
    hostTags: { FOLLOW_UP_OVERDUE: "후속 확인 지연", FOLLOW_UP_NEEDED: "후속 확인 필요" },
    showEverything: "모두 보기",
    showLess: "접기",
    todayHeader: "오늘",
    showMore: "더 보기",
    savedForLater: "나중에 보기",
    savedForLaterSub: "잃어버리고 싶지 않아 담아둔 것들.",
    todayEmpty: "오늘 할 일을 모두 마쳤습니다.",
    catEyebrow: {
      ACTION_REVISION: "수정 필요",
      ACTION_DUE: "행동 마감",
      REQUIRED_LEARNING: "필수 학습",
      PRACTICE_DUE: "연습 예정",
      APPLY_DUE: "이번 주에 적용하기",
      FOLLOW_UP_DUE: "후속 확인",
    },
    fallbackHeader: "오늘의 다음 단계",
    continueBody: "시작한 학습을 이어가세요.",
    continueCta: "학습 계속하기",
    practiceBody: "현실에서 필요한 판단 하나를 연습하세요.",
    practiceCta: "연습 시작",
    findBody: "오늘 더 나아질 한 가지를 선택하세요.",
    findCta: "프로그램 찾기",
  },
};

const HOST_PREVIEW = 3;

// Row-tag tone: overdue reads as urgent (warm red), needed as the standard gold cue. Pure presentation.
function followUpTagTone(c: FollowUpCategory): string {
  return c === "FOLLOW_UP_OVERDUE" ? "text-red-300/80 border-red-400/30" : "text-[#E5B769] border-[#C9A66B]/35";
}

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function TodayHome({
  locale,
  refreshKey,
  onNavigate,
  onOpenItem,
  onOpenLeadershipFollowUp,
  onOpenSaved,
}: {
  locale: string;
  /**
   * Bumped when the Today tab is selected. Only the two lanes that reflect what OTHER PEOPLE did
   * read it: what someone asked of you, and how the people you asked have answered. Everything
   * else on Today is derived from the viewer's own state and does not go stale behind their back.
   */
  refreshKey?: number;
  /** In-shell tab navigation for the deterministic fallback CTAs (no route reload). */
  onNavigate?: (tab: "learn" | "practice") => void;
  /**
   * OPEN A TODAY ITEM INSIDE THE SHELL (Slice R4-R5C1). Given the item's SERVER-AUTHORED canonical
   * deep link, the shell applies the destination in state and returns true. Returning FALSE means
   * it could not resolve the link, and the card's anchor is then allowed to navigate natively — so
   * an unrecognised shape degrades to the previous behaviour rather than to a dead control.
   *
   * The card stays an `<a href>` either way: the address is real, copy-paste and long-press work,
   * and the durable URL is what a reload resolves. This only removes the document reload — and with
   * it the "Opening BTY…" shell reboot — for links the shell already understands.
   */
  onOpenItem?: (href: string) => boolean;
  /** 3.2G-R2: open a leadership follow-up's control room IN-SHELL (no href, no document reload). The
   *  shell sets the canonical Event/section/focus state + Today return origin directly. The structured
   *  target is derived from the SERVER's canonical deepLink via the shared sanitizer — never from
   *  display text — so the UI carries no routing/authorization logic of its own. */
  onOpenLeadershipFollowUp?: (target: { eventId: string; section: HostFocusSection; focusId: string }) => void;
  /**
   * SAVED FOR LATER (Slice R1B-C2-R1) — opens the shell-owned focused capture lane.
   *
   * Today renders only the ENTRY; the shell owns the destination, matching the two focused views
   * this tab already has. TodayHome deliberately fetches NOTHING for it: the capture list is read
   * by the focused view itself, so Today's own data semantics are untouched and no capture can
   * reach a reminder, an actionStatus item, or any Today count.
   */
  onOpenSaved?: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  /*
    UNKNOWN IS NOT EMPTY (Slice R4-R5A).

    `reminders` initialised to `[]` meant the very first paint of every cold open took the empty
    branch and asserted "You're all caught up for today." — with a CTA leading AWAY from the
    required learning that was still in flight. Measured: the first synchronous render of this
    component with one REQUIRED_LEARNING reminder pending read

      "Yesterday was quiet. Begin with one small step today. … You're all caught up for today."

    and then replaced itself with the training. Two factual claims made before the data that
    supports them existed.

    `null` is the third state the component always needed: NOT YET KNOWN. It is the same sentinel
    `FoundryRequiredLearning` already uses (`assignments === null` → render nothing), and it also
    carries the read FAILURE honestly — `setReminders` is only called on `res.ok && d.ok`, so a
    failed brief now stays unknown and says nothing, instead of claiming emptiness it never
    measured. Fetch and error semantics are otherwise unchanged; no new error surface, no spinner.
  */
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [hostAttention, setHostAttention] = useState<HostAttention[]>([]);
  const [hostActionReviews, setHostActionReviews] = useState<HostActionReview[]>([]);
  const [yesterdayReturned, setYesterdayReturned] = useState<boolean | null>(null);
  const [yesterdayCounts, setYesterdayCounts] = useState<YesterdayCounts | null>(null);
  const [hasActiveProgram, setHasActiveProgram] = useState(false);
  const [hasAvailablePractice, setHasAvailablePractice] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAllHost, setShowAllHost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tz = deviceTz();
    void (async () => {
      const qs = new URLSearchParams({ locale: loc });
      if (tz) qs.set("tz", tz);
      try {
        const res = await fetch(`/api/me/today/brief?${qs.toString()}`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { ok?: boolean; reminders?: Reminder[]; hostAttention?: HostAttention[] };
          if (!cancelled && d?.ok) {
            setReminders(Array.isArray(d.reminders) ? d.reminders : []);
            setHostAttention(Array.isArray(d.hostAttention) ? d.hostAttention : []);
          }
        }
      } catch {
        /* fail-soft */
      }
      try {
        const tz = deviceTz();
        const resY = await fetch(`/api/me/today/yesterday-activity${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, { credentials: "include", cache: "no-store" });
        if (resY.ok) {
          const dY = (await resY.json()) as { counts?: YesterdayCounts | null };
          if (!cancelled) setYesterdayCounts(dY.counts ?? null);
        }
      } catch {
        /* fail-soft → falls back to the self-return line */
      }
      try {
        const res2 = await fetch(`/api/arena/action-review-queue?locale=${loc}`, { credentials: "include", cache: "no-store" });
        if (res2.ok) {
          const d2 = (await res2.json()) as { items?: HostActionReview[] };
          if (!cancelled) setHostActionReviews(Array.isArray(d2.items) ? d2.items : []);
        }
      } catch {
        /* fail-soft */
      }
      try {
        const res3 = await fetch(`/api/me/daily-trace`, { credentials: "include", cache: "no-store" });
        if (res3.ok) {
          const d3 = (await res3.json()) as { dailyTrace?: { date: string; intensity: 0 | 1 }[] };
          const series = Array.isArray(d3.dailyTrace) ? d3.dailyTrace : [];
          const y = series.length >= 2 ? series[series.length - 2] : null;
          if (!cancelled) setYesterdayReturned(y ? y.intensity === 1 : false);
        }
      } catch {
        /* fail-soft — quiet fallback */
      }
      // Fallback signal: an available Arena practice (tier 7). Any listed practice is startable.
      try {
        const res4 = await fetch(`/api/arena/practice`, { credentials: "include", cache: "no-store" });
        if (res4.ok) {
          const d4 = (await res4.json()) as { practices?: unknown[] };
          if (!cancelled) setHasAvailablePractice(Array.isArray(d4.practices) && d4.practices.length > 0);
        }
      } catch {
        /* fail-soft → no practice signal (falls through to Find a program) */
      }
      // Fallback signal: an in-progress program (tier 6) — started but not complete (measured %).
      try {
        const res5 = await fetch(`/api/bty/foundry/learning-path`, { credentials: "include", cache: "no-store" });
        if (res5.ok) {
          const d5 = (await res5.json()) as { ok?: boolean; programs?: { completion_pct?: number }[] };
          const programs = Array.isArray(d5.programs) ? d5.programs : [];
          const active = programs.some(
            (p) => typeof p.completion_pct === "number" && p.completion_pct > 0 && p.completion_pct < 100,
          );
          if (!cancelled) setHasActiveProgram(active);
        }
      } catch {
        /* fail-soft → no active-program signal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc]);

  const primary: PrimaryActionResult = useMemo(
    () =>
      selectPrimaryAction(
        (reminders ?? []).map((r) => ({
          stableId: r.stableId,
          category: r.category,
          state: r.state,
          title: r.title,
          deepLink: r.canonicalDeepLink,
        })),
        { hasActiveProgram, hasAvailablePractice },
      ),
    [reminders, hasActiveProgram, hasAvailablePractice],
  );

  // Today = ONE canonical, ordered, deduped action list (learner actionable items:
  // required learning / needs revision / verification pending / follow-up). Host
  // "reviews" (creator reviewing others) are NOT reminders, so they stay a compact
  // separate row (never duplicated into the list).
  /*
    `note` MUST be carried (Slice 3.2R-R2.6). The server has always sent the source training title
    for APPLY_DUE; this map narrowed it away, so the card showed a decision sentence with no idea
    which training it came from — and with two apply items, no way to tell them apart. The same
    fetched-but-narrowed shape that lost the FOLLOW_UP rows in 3.2G.
  */
  const todayItems = normalizeTodayItems(
    (reminders ?? []).map((r) => ({
      stableId: r.stableId,
      category: r.category,
      state: r.state,
      title: r.title,
      deepLink: r.canonicalDeepLink,
      context: r.category === "APPLY_DUE" ? r.note ?? null : null,
    })),
  );
  const { visible: todayVisibleItems, hasMore: todayHasMore } = todayVisible(todayItems, expanded);
  const reviews =
    hostActionReviews.length + hostAttention.filter((h) => h.category === "SHARED_REVIEW_DUE").length;
  // 3.2G — the leader's overdue/needed follow-ups. `hostAttention` is already sorted by the domain
  // priority rule server-side (sortHostAttention); filtering PRESERVES that order (no UI re-ranking).
  const followUpItems = hostAttention.filter(
    (h): h is HostAttention & { category: FollowUpCategory } =>
      h.category === "FOLLOW_UP_OVERDUE" || h.category === "FOLLOW_UP_NEEDED",
  );
  const followUpVisible = showAllHost ? followUpItems : followUpItems.slice(0, HOST_PREVIEW);

  /*
    THE TWO RESOLUTION PREDICATES (Slice R4-R5A). Nothing below states a fact about the learner's
    day until the read behind that fact has come back.

    `yesterdayKnown` — the fallback line reads `yesterdayReturned === true ? returned : quiet`, and
    the initial value of `yesterdayReturned` is `null`. That collapsed UNKNOWN into "quiet", so a
    learner who was here yesterday was told they were not, every single morning, until
    /api/me/daily-trace answered. Both yesterday sources have their own `null`-means-unknown
    sentinel already; this only stops treating that null as a measurement. When BOTH reads fail the
    block stays absent — silence, which is what we actually know.
  */
  const remindersResolved = reminders !== null;
  const yesterdayKnown = yesterdayCounts !== null || yesterdayReturned !== null;

  // Yesterday = canonical counts sentence; falls back to the measured self-return line
  // only when the counts source is unavailable (never fabricated).
  const yesterdaySummary = yesterdayCounts
    ? buildYesterdaySummary(yesterdayCounts, loc)
    : { sentence: yesterdayReturned === true ? t.yesterdayReturned : t.yesterdayQuiet, compact: null as string | null };

  // Deterministic fallback presentation (tiers 6–8) — body + CTA + in-shell target.
  const fallback =
    primary.kind === "continue_program"
      ? { body: t.continueBody, cta: t.continueCta, target: "learn" as const }
      : primary.kind === "start_practice"
        ? { body: t.practiceBody, cta: t.practiceCta, target: "practice" as const }
        : { body: t.findBody, cta: t.findCta, target: "learn" as const };

  const primaryCardCls =
    "flex flex-col gap-1 rounded-2xl border border-[#C9A66B]/35 bg-[#C9A66B]/[0.06] px-4 py-3";

  return (
    <div className="flex flex-col gap-4" data-testid="today-home">
      {/* A — Better Than Yesterday header */}
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/80" data-testid="today-header">
        {t.eyebrow}
      </span>

      {/* B — YESTERDAY: one truthful sentence (canonical counts) + optional compact line.
          Rendered only once one of the two yesterday reads has answered (R4-R5A) — the LABEL goes
          with the sentence, because a heading over nothing reads as a surface that failed. */}
      {yesterdayKnown ? (
        <div className="flex flex-col gap-0.5" data-testid="today-yesterday">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.yesterday}</span>
          <p className="text-sm leading-6 text-white/80" data-testid="today-yesterday-sentence">{yesterdaySummary.sentence}</p>
          {yesterdaySummary.compact ? (
            <span className="text-[0.72rem] text-white/45" data-testid="today-yesterday-compact">{yesterdaySummary.compact}</span>
          ) : null}
        </div>
      ) : null}

      {/* TODAY: one canonical action list (top-3, Show more/less). No "Show everything".
          Held whole until the brief resolves (R4-R5A): the empty card is a CLAIM ("you're all
          caught up") and the header is its frame, so neither may precede the read. No spinner and
          no placeholder — the greeting already owns the first paint, and this fills in beneath it. */}
      {remindersResolved ? (
      <div className="flex flex-col gap-2" data-testid="today-list">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.todayHeader}</span>
        {todayItems.length === 0 ? (
          <button
            type="button"
            data-testid="today-empty"
            data-target={fallback.target}
            onClick={() => onNavigate?.(fallback.target)}
            className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
          >
            <span className="text-[0.9rem] leading-6 text-white/80">{t.todayEmpty}</span>
            <span className="text-[0.85rem] leading-6 text-white/55">{fallback.body}</span>
            <span data-testid="today-empty-cta" className="mt-1 self-start rounded-lg border border-[#C9A66B]/45 bg-[#C9A66B]/10 px-3 py-1.5 text-[0.8rem] font-medium text-[#E5B769]">
              {fallback.cta}
            </span>
          </button>
        ) : (
          <>
            {todayVisibleItems.map((it) => {
              /*
                APPLY THIS WEEK card hierarchy (Slice 3.2R-R2.6):

                  eyebrow   APPLY THIS WEEK
                  title     the learner's OWN decision sentence — always primary
                  context   which training it came from — quiet provenance

                and NOTHING ELSE while the window is open (R2.6-R1). A "This week" chip under an
                eyebrow that already says APPLY THIS WEEK repeats itself, and a status pill on a
                commitment is exactly what makes Today read like a task manager. Timing appears
                only when it adds something: "Last day", on the no-follow-up path.

                Scoped to APPLY_DUE on purpose: every other category renders exactly as before.
                No checkbox, no Done, no XP, no percent, no streak, and never red — and following
                the link only reads the learner's own record.
              */
              const isApply = it.category === "APPLY_DUE";
              const context = isApply && typeof it.context === "string" && it.context.trim() !== "" ? it.context.trim() : null;
              const timing = isApply ? applyTimingChip(it.state, loc) : null;
              return (
                <a
                  key={it.stableId}
                  href={it.deepLink}
                  data-testid="today-item"
                  data-category={it.category}
                  /*
                    STILL AN ANCHOR, NO LONGER A RELOAD (Slice R4-R5C1).

                    The href stays real — the address is copyable, long-press and middle-click keep
                    working, and it is what a cold load resolves. What changes is the ordinary tap:
                    the shell resolves the server-authored link into a destination it can render in
                    state, so the learner no longer watches "Opening BTY…" and a bounce through
                    Today to reach a surface one tab away.

                    `preventDefault` happens ONLY when the shell reports it handled the link. An
                    unrecognised shape returns false and the browser follows the href exactly as it
                    did before, so no card can become inert.
                  */
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    if (onOpenItem?.(it.deepLink)) e.preventDefault();
                  }}
                  className="flex flex-col gap-0.5 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.05] px-4 py-3"
                >
                  <span className="text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
                    {t.catEyebrow[it.category as PrimaryActionCandidate["category"]] ?? it.category}
                  </span>
                  <span className="text-[0.95rem] font-medium leading-6 text-white/90">{it.title}</span>
                  {context ? (
                    <span data-testid="today-item-context" className="text-[0.72rem] leading-5 text-white/45">
                      {context}
                    </span>
                  ) : null}
                  {timing ? (
                    <span
                      data-testid="today-item-timing"
                      className={"mt-1 self-start rounded-md border px-2 py-0.5 text-[0.66rem] " + applyStateTone(it.state)}
                    >
                      {timing}
                    </span>
                  ) : null}
                </a>
              );
            })}
            {todayHasMore ? (
              <button
                type="button"
                data-testid="today-show-more"
                onClick={() => setExpanded((v) => !v)}
                className="self-start text-xs font-medium text-white/55 hover:text-white/85"
              >
                {expanded ? t.showLess : t.showMore}
              </button>
            ) : null}
          </>
        )}
      </div>
      ) : null}

      {/* Host leadership attention (creator's obligations) — one calm section under a single header:
          the leader's overdue/needed FOLLOW-UP rows (deep-linked to the control room, 3.2G) plus the
          compact SHARED_REVIEW_DUE + arena action-review count. Rendered only when non-zero; follow-up
          rows are NEVER duplicated into the Today learner list above, and carry no private body/PII. */}
      {followUpItems.length > 0 || reviews > 0 ? (
        <div className="flex flex-col gap-2" data-testid="today-host-attention">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">{t.attention}</span>
            {followUpItems.length > 0 ? (
              <span className="text-[0.72rem] text-white/45">{t.leadershipSub}</span>
            ) : null}
          </div>

          {followUpItems.length > 0 ? (
            <ul className="flex flex-col gap-1.5" data-testid="today-followups">
              {followUpVisible.map((h) => (
                <li key={h.stableId} data-testid="today-followup-row" data-category={h.category}>
                  {/* 3.2G-R2: a row already inside the app is an APP-SHELL COMMAND, not a webpage link.
                      A <button> (never a raw href) so the cold first tap cannot be handled by the
                      WKWebView navigation policy / activate pre-hydration → no document reload, no
                      Safari, no second-tap requirement. The canonical Event/section/focus target is
                      parsed from the SERVER deepLink by the shared sanitizer (not display text). */}
                  <button
                    type="button"
                    data-testid="today-followup-open"
                    onClick={() => {
                      if (!h.deepLink) return;
                      const q = h.deepLink.slice(h.deepLink.indexOf("?"));
                      const target = parseHostDeepLink(q);
                      if (target) {
                        onOpenLeadershipFollowUp?.({
                          eventId: target.eventId,
                          section: target.section,
                          focusId: target.focusId,
                        });
                      }
                    }}
                    className="flex w-full flex-col gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{h.participantDisplayName}</span>
                      <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.66rem] " + followUpTagTone(h.category)}>
                        {t.hostTags[h.category]}
                      </span>
                    </div>
                    {h.trainingTitle ? <span className="truncate text-xs text-white/45">{h.trainingTitle}</span> : null}
                    {h.reason ? <span className="text-xs text-white/60">{h.reason}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {followUpItems.length > HOST_PREVIEW ? (
            <button
              type="button"
              data-testid="today-followups-toggle"
              onClick={() => setShowAllHost((v) => !v)}
              className="self-start text-xs font-medium text-white/55 hover:text-white/85"
            >
              {showAllHost ? t.showLess : t.showMore}
            </button>
          ) : null}

          {reviews > 0 ? (
            <button
              type="button"
              data-testid="today-attention"
              onClick={() => onNavigate?.("practice")}
              className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
            >
              <span data-testid="attention-reviews" className="text-[0.8rem] text-white/70">{t.reviews(reviews)}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/*
        SOMEBODY IS WAITING ON THIS PERSON (Slice A1).

        Placed above Saved for later and below everything owed, because it is neither: a colleague
        explicitly asked THEM something and is waiting for an answer. It renders nothing when there
        is nothing to answer — unlike Saved for later, this is not a durable destination, it is a
        queue that should be empty most days.

        It carries no count and no badge. The obligation is to the person who asked, not to a number.
      */}
      <NeedsYourResponse locale={loc} refreshKey={refreshKey} />

      {/*
        WHAT THIS PERSON ASKED OF OTHERS — placed directly after what others asked of them.

        The two are the same relationship seen from opposite ends, so they belong together: answer
        what you were asked, then see what you are still waiting on. It renders nothing unless this
        person has actually tracked something, so for everyone else Today is unchanged.

        Closes a measured gap: a real Track wrote correctly in Teams and the Host could not find it
        anywhere in BTY, because the owner-scoped route that serves this had no caller.
      */}
      <TrackingSent locale={loc} refreshKey={refreshKey} />

      {/*
        A DIFFERENT CATEGORY OF THING, PLACED LAST.

        Everything above this line is something the person owes, is due, or must attend to. This is
        not. It sits at the bottom of Today, outside every section whose semantics mean due /
        required / commitment / reminder / action-status, as its own quiet destination.

        ALWAYS VISIBLE, and never counted. It is a durable place, so it should not appear and vanish
        with its contents — but a number here would turn "things I chose not to lose" into a backlog
        to drive down, which is the one thing this object must never become. No count, no badge, no
        urgency colour: the same neutral surface as the row above, and nothing that reads as owed.
      */}
      {onOpenSaved ? (
        <button
          type="button"
          data-testid="today-saved-entry"
          onClick={onOpenSaved}
          className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
        >
          <span className="text-[0.8rem] text-white/70">{t.savedForLater}</span>
          <span className="text-[0.72rem] leading-5 text-white/40">{t.savedForLaterSub}</span>
        </button>
      ) : null}
    </div>
  );
}
