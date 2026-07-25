"use client";

import { useEffect, useMemo, useState } from "react";
import TodayPersonalBrief from "@/components/app-shell/TodayPersonalBrief";
import {
  selectPrimaryAction,
  type PrimaryActionCandidate,
} from "@/domain/daily/todayPrimaryAction";

/**
 * Today — simplified hierarchy (App Shell + Today Simplification V1, Phases 3–4).
 *
 * The first viewport shows a CALM summary only:
 *   A. Better Than Yesterday header
 *   B. Yesterday summary   (measured self-return only — never fabricated progress)
 *   C. One primary next action   (deterministic domain selector; routes directly to the action)
 *   D. Needs your attention   (collapsed learner + Host counts, when non-zero)
 *   F. Show everything   (reveals the full, unchanged detailed projections)
 *
 * The detailed Today projections are NOT restructured — the existing {@link TodayPersonalBrief}
 * (Action Hygiene, Leadership Attention, Field Action plans, Action Reviews, reminders, AI brief)
 * renders verbatim beneath "Show everything", so no data or operational function is removed.
 *
 * This component computes only PROJECTION/priority (the selector is a pure domain function); it
 * introduces no new engine, no new ranking, and no new server data — it reads the same canonical
 * `/api/me/today/brief` + `/api/me/action-review-queue` the detailed view already consumes, plus
 * `/api/me/daily-trace` for the measured yesterday signal. Fail-soft throughout.
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
  optional: string;
  optionalBody: string;
  attention: string;
  corrections: (n: number) => string;
  reviews: (n: number) => string;
  followups: (n: number) => string;
  showEverything: string;
  showLess: string;
  catEyebrow: Record<PrimaryActionCandidate["category"], string>;
}> = {
  en: {
    eyebrow: "BETTER THAN YESTERDAY",
    yesterday: "Yesterday",
    yesterdayReturned: "You showed up yesterday.",
    yesterdayQuiet: "Yesterday was quiet. Begin with one small step today.",
    nextStep: "Your next step",
    optional: "Your next step",
    optionalBody: "Nothing is due. When you're ready, choose one small step.",
    attention: "Your team needs you",
    corrections: (n) => `${n} action${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} your correction`,
    reviews: (n) => `${n} action plan${n === 1 ? "" : "s"} awaiting your review`,
    followups: (n) => `${n} follow-up${n === 1 ? "" : "s"} due`,
    showEverything: "Show everything",
    showLess: "Show less",
    catEyebrow: {
      ACTION_REVISION: "Needs revision",
      ACTION_DUE: "Action due",
      REQUIRED_LEARNING: "Required learning",
      PRACTICE_DUE: "Practice due",
      FOLLOW_UP_DUE: "Follow-up due",
    },
  },
  ko: {
    eyebrow: "어제보다 나은 나",
    yesterday: "어제",
    yesterdayReturned: "어제 당신은 이 자리에 왔습니다.",
    yesterdayQuiet: "어제는 조용했습니다. 오늘 작은 한 걸음으로 시작하세요.",
    nextStep: "오늘의 다음 걸음",
    optional: "오늘의 다음 걸음",
    optionalBody: "마감된 것이 없습니다. 준비되면 작은 한 걸음을 골라 보세요.",
    attention: "당신의 손길이 필요합니다",
    corrections: (n) => `${n}개의 행동에 수정이 필요합니다`,
    reviews: (n) => `${n}개의 행동 계획이 검토를 기다리고 있습니다`,
    followups: (n) => `${n}개의 후속 확인이 예정되어 있습니다`,
    showEverything: "모두 보기",
    showLess: "접기",
    catEyebrow: {
      ACTION_REVISION: "수정 필요",
      ACTION_DUE: "행동 마감",
      REQUIRED_LEARNING: "필수 학습",
      PRACTICE_DUE: "연습 예정",
      FOLLOW_UP_DUE: "후속 확인",
    },
  },
};

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function TodayHome({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hostAttention, setHostAttention] = useState<HostAttention[]>([]);
  const [hostActionReviews, setHostActionReviews] = useState<HostActionReview[]>([]);
  const [yesterdayReturned, setYesterdayReturned] = useState<boolean | null>(null);
  const [showEverything, setShowEverything] = useState(false);

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
          // Measured self-return only: the second-to-last day in the 7-day series is "yesterday".
          const y = series.length >= 2 ? series[series.length - 2] : null;
          if (!cancelled) setYesterdayReturned(y ? y.intensity === 1 : false);
        }
      } catch {
        /* fail-soft — quiet fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc]);

  const primary = useMemo(
    () =>
      selectPrimaryAction(
        reminders.map((r) => ({
          stableId: r.stableId,
          category: r.category,
          state: r.state,
          title: r.title,
          deepLink: r.canonicalDeepLink,
        })),
      ),
    [reminders],
  );

  // Calm attention summary — learner corrections + Host reviews + follow-ups collapsed into counts.
  const corrections = reminders.filter((r) => r.state === "needs_revision").length;
  const reviews =
    hostActionReviews.length + hostAttention.filter((h) => h.category === "SHARED_REVIEW_DUE").length;
  const followups =
    reminders.filter((r) => r.category === "FOLLOW_UP_DUE").length +
    hostAttention.filter((h) => h.category === "FOLLOW_UP_OVERDUE" || h.category === "FOLLOW_UP_NEEDED").length;
  const attentionTotal = corrections + reviews + followups;

  const yesterdayLine =
    yesterdayReturned === true ? t.yesterdayReturned : t.yesterdayQuiet;

  return (
    <div className="flex flex-col gap-4" data-testid="today-home">
      {/* A — Better Than Yesterday header */}
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/80" data-testid="today-header">
        {t.eyebrow}
      </span>

      {/* B — Yesterday summary (measured self-return only) */}
      <div className="flex flex-col gap-0.5" data-testid="today-yesterday">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.yesterday}</span>
        <p className="text-sm leading-6 text-white/80">{yesterdayLine}</p>
      </div>

      {/* C — One primary next action (exactly one) */}
      {primary ? (
        <a
          href={primary.deepLink}
          data-testid="today-primary-action"
          data-category={primary.category}
          className="flex flex-col gap-1 rounded-2xl border border-[#C9A66B]/35 bg-[#C9A66B]/[0.06] px-4 py-3"
        >
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#E5B769]/85">{t.nextStep}</span>
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-white/40">{t.catEyebrow[primary.category]}</span>
          <span className="text-[0.95rem] font-medium leading-6 text-white/90">{primary.title}</span>
        </a>
      ) : (
        <div
          data-testid="today-primary-action-optional"
          className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
        >
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/45">{t.optional}</span>
          <span className="text-sm leading-6 text-white/65">{t.optionalBody}</span>
        </div>
      )}

      {/* D — Needs your attention (only when non-zero) */}
      {attentionTotal > 0 ? (
        <button
          type="button"
          data-testid="today-attention"
          onClick={() => setShowEverything(true)}
          className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
        >
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">{t.attention}</span>
          <ul className="flex flex-col gap-0.5 text-[0.8rem] text-white/70">
            {corrections > 0 ? <li data-testid="attention-corrections">{t.corrections(corrections)}</li> : null}
            {reviews > 0 ? <li data-testid="attention-reviews">{t.reviews(reviews)}</li> : null}
            {followups > 0 ? <li data-testid="attention-followups">{t.followups(followups)}</li> : null}
          </ul>
        </button>
      ) : null}

      {/* F — Show everything (details collapsed by default; revealed on demand) */}
      <button
        type="button"
        data-testid="today-show-everything-toggle"
        onClick={() => setShowEverything((v) => !v)}
        className="self-start text-xs font-medium text-white/55 hover:text-white/85"
      >
        {showEverything ? t.showLess : t.showEverything}
      </button>
      {showEverything ? (
        <div data-testid="today-everything">
          <TodayPersonalBrief locale={locale} />
        </div>
      ) : null}
    </div>
  );
}
