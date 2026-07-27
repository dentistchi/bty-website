"use client";

import { useEffect, useMemo, useState } from "react";
import { buildYesterdaySummary, type YesterdayCounts } from "@/domain/daily/yesterdaySummary";
import { normalizeTodayItems, todayVisible } from "@/domain/daily/todayList";
import {
  selectPrimaryAction,
  type PrimaryActionCandidate,
  type PrimaryActionResult,
} from "@/domain/daily/todayPrimaryAction";

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
};
type HostAttention = { stableId: string; category: "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED" | "SHARED_REVIEW_DUE" };
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
  showEverything: string;
  showLess: string;
  todayHeader: string;
  showMore: string;
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
    showEverything: "Show everything",
    showLess: "Show less",
    todayHeader: "Today",
    showMore: "Show more",
    todayEmpty: "You're all caught up for today.",
    catEyebrow: {
      ACTION_REVISION: "Needs revision",
      ACTION_DUE: "Action due",
      REQUIRED_LEARNING: "Required learning",
      PRACTICE_DUE: "Practice due",
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
    showEverything: "모두 보기",
    showLess: "접기",
    todayHeader: "오늘",
    showMore: "더 보기",
    todayEmpty: "오늘 할 일을 모두 마쳤습니다.",
    catEyebrow: {
      ACTION_REVISION: "수정 필요",
      ACTION_DUE: "행동 마감",
      REQUIRED_LEARNING: "필수 학습",
      PRACTICE_DUE: "연습 예정",
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

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function TodayHome({
  locale,
  onNavigate,
}: {
  locale: string;
  /** In-shell tab navigation for the deterministic fallback CTAs (no route reload). */
  onNavigate?: (tab: "learn" | "practice") => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hostAttention, setHostAttention] = useState<HostAttention[]>([]);
  const [hostActionReviews, setHostActionReviews] = useState<HostActionReview[]>([]);
  const [yesterdayReturned, setYesterdayReturned] = useState<boolean | null>(null);
  const [yesterdayCounts, setYesterdayCounts] = useState<YesterdayCounts | null>(null);
  const [hasActiveProgram, setHasActiveProgram] = useState(false);
  const [hasAvailablePractice, setHasAvailablePractice] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
        reminders.map((r) => ({
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
  const todayItems = normalizeTodayItems(
    reminders.map((r) => ({ stableId: r.stableId, category: r.category, state: r.state, title: r.title, deepLink: r.canonicalDeepLink })),
  );
  const { visible: todayVisibleItems, hasMore: todayHasMore } = todayVisible(todayItems, expanded);
  const reviews =
    hostActionReviews.length + hostAttention.filter((h) => h.category === "SHARED_REVIEW_DUE").length;

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

      {/* B — YESTERDAY: one truthful sentence (canonical counts) + optional compact line */}
      <div className="flex flex-col gap-0.5" data-testid="today-yesterday">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.yesterday}</span>
        <p className="text-sm leading-6 text-white/80" data-testid="today-yesterday-sentence">{yesterdaySummary.sentence}</p>
        {yesterdaySummary.compact ? (
          <span className="text-[0.72rem] text-white/45" data-testid="today-yesterday-compact">{yesterdaySummary.compact}</span>
        ) : null}
      </div>

      {/* TODAY: one canonical action list (top-3, Show more/less). No "Show everything". */}
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
            {todayVisibleItems.map((it) => (
              <a
                key={it.stableId}
                href={it.deepLink}
                data-testid="today-item"
                data-category={it.category}
                className="flex flex-col gap-0.5 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.05] px-4 py-3"
              >
                <span className="text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
                  {t.catEyebrow[it.category as PrimaryActionCandidate["category"]] ?? it.category}
                </span>
                <span className="text-[0.95rem] font-medium leading-6 text-white/90">{it.title}</span>
              </a>
            ))}
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

      {/* Host reviews (creator reviewing others) — compact, only when non-zero; never
          duplicated into the Today list above. */}
      {reviews > 0 ? (
        <button
          type="button"
          data-testid="today-attention"
          onClick={() => onNavigate?.("practice")}
          className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
        >
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">{t.attention}</span>
          <span data-testid="attention-reviews" className="text-[0.8rem] text-white/70">{t.reviews(reviews)}</span>
        </button>
      ) : null}
    </div>
  );
}
