"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThemeBody } from "@/components/ThemeBody";
import { CardSkeleton } from "@/components/bty-arena";
import { ForcedResetUX } from "@/components/center/ForcedResetUX";
import { HealingPhaseTracker } from "@/components/center/HealingPhaseTracker";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { DEAR_ME_SUBMITTED_EVENT } from "@/lib/bty/center/dearMeEvents";

type StageState = {
  currentStage: number;
  stageName: string;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
};

type LetterItem = {
  id: string;
  body: string;
  reply: string | null;
  locale: string;
  created_at: string;
};

/** Fields match /api/assessment/submissions response shape (camelCase from service mapper). */
type AssessmentItem = {
  id: string;
  scores: Record<string, number>;
  pattern: string;
  track: string;
  createdAt: string;
};

type ResilienceEntry = {
  date: string;
  level: "high" | "mid" | "low";
  source: string;
};

function StageContextCard({ stage, isKo }: { stage: StageState; isKo: boolean }) {
  const isStage3 = stage.currentStage === 3;
  return (
    <div
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
      role="region"
      aria-label={isKo ? "현재 단계 정보" : "Current stage"}
    >
      <div className="text-xs font-medium text-dear-charcoal-soft mb-1">
        {isKo ? "현재 단계" : "Current stage"}
      </div>
      <div className="text-sm font-medium text-dear-charcoal">{stage.stageName}</div>
      {isStage3 && (
        <p className="text-xs text-dear-charcoal-soft mt-1 opacity-80 m-0">
          {isKo
            ? "재정비가 필요한 시점이에요. Center가 도와드릴게요."
            : "A good time to reflect and reset. Center is here."}
        </p>
      )}
    </div>
  );
}

function DearMeCard({
  letter,
  locale,
  isKo,
  onWrite,
}: {
  letter: LetterItem | null;
  locale: string;
  isKo: boolean;
  onWrite: () => void;
}) {
  const excerpt =
    letter
      ? letter.body.length > 80
        ? letter.body.slice(0, 80) + "…"
        : letter.body
      : null;
  const dateStr = letter
    ? new Date(letter.created_at).toLocaleDateString(isKo ? "ko-KR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
      role="region"
      aria-label={isKo ? "나에게 쓰는 편지" : "Dear Me"}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-dear-charcoal">
          {isKo ? "나에게 쓰는 편지" : "Dear Me"}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/center/letters`}
            className="text-xs font-medium text-dear-charcoal-soft hover:text-dear-charcoal transition-colors rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
            aria-label={isKo ? "보낸 편지 이력 보기" : "View letter history"}
          >
            {isKo ? "이력 보기" : "History"}
          </Link>
          <button
            type="button"
            onClick={onWrite}
            className="text-xs font-medium text-dear-sage hover:text-dear-charcoal transition-colors rounded-lg border border-dear-sage/30 bg-dear-sage/5 px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
            aria-label={isKo ? "편지 쓰기" : "Write a letter"}
          >
            {isKo ? "편지 쓰기" : "Write a letter"}
          </button>
        </div>
      </div>
      {excerpt ? (
        <>
          <p className="text-sm text-dear-charcoal leading-relaxed m-0">{excerpt}</p>
          {dateStr && (
            <time className="text-xs text-dear-charcoal-soft mt-1 block" dateTime={letter!.created_at}>
              {dateStr}
            </time>
          )}
        </>
      ) : (
        <p className="text-sm text-dear-charcoal-soft m-0">
          {isKo
            ? "아직 편지가 없어요. 마음을 적어보세요."
            : "No letters yet. Write what's on your mind."}
        </p>
      )}
    </div>
  );
}

function ResilienceCard({ entries, locale, isKo }: { entries: ResilienceEntry[]; locale: string; isKo: boolean }) {
  const last30 = entries.slice(-30);
  const last7 = last30.slice(-7);

  function dotColor(level: "high" | "mid" | "low"): string {
    if (level === "high") return "#14b8a6";
    if (level === "mid") return "#f59e0b";
    return "#ef4444";
  }

  function levelLabel(level: "high" | "mid" | "low"): string {
    if (isKo) return level === "high" ? "높음" : level === "mid" ? "보통" : "낮음";
    return level;
  }

  const avgLevel: "high" | "mid" | "low" | null = (() => {
    if (last7.length === 0) return null;
    const score = last7.reduce((s, e) => s + (e.level === "high" ? 3 : e.level === "mid" ? 2 : 1), 0) / last7.length;
    if (score >= 2.5) return "high";
    if (score >= 1.5) return "mid";
    return "low";
  })();

  const trend: "up" | "flat" | "down" | null = (() => {
    if (last7.length < 4) return null;
    const half = Math.floor(last7.length / 2);
    const firstHalf = last7.slice(0, half);
    const secondHalf = last7.slice(half);
    const avg = (arr: ResilienceEntry[]) =>
      arr.reduce((s, e) => s + (e.level === "high" ? 3 : e.level === "mid" ? 2 : 1), 0) / arr.length;
    const diff = avg(secondHalf) - avg(firstHalf);
    if (diff > 0.3) return "up";
    if (diff < -0.3) return "down";
    return "flat";
  })();

  return (
    <div
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
      role="region"
      aria-label={isKo ? "에너지 기록" : "Energy log"}
    >
      <div className="flex items-center mb-2">
        <div className="text-sm font-semibold text-dear-charcoal">
          {isKo ? "에너지 기록" : "Energy log"}
        </div>
      </div>
      {last7.length > 0 ? (
        <>
          <div
            className="flex gap-2 items-end flex-wrap mb-2"
            role="list"
            aria-label={isKo ? "최근 7일 에너지" : "Last 7 days energy"}
          >
            {last7.map((entry) => (
              <div
                key={entry.date}
                role="listitem"
                title={`${entry.date}: ${levelLabel(entry.level)}`}
                aria-label={`${entry.date}: ${levelLabel(entry.level)}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: dotColor(entry.level),
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {avgLevel && (
              <span className="text-xs text-dear-charcoal-soft">
                {isKo ? "7일 평균" : "7-day avg"}: <span style={{ color: dotColor(avgLevel), fontWeight: 600 }}>{levelLabel(avgLevel)}</span>
              </span>
            )}
            {trend && (
              <span className="text-xs text-dear-charcoal-soft">
                {trend === "up" ? (isKo ? "↑ 개선 중" : "↑ improving") : trend === "down" ? (isKo ? "↓ 주의 필요" : "↓ declining") : (isKo ? "→ 안정" : "→ stable")}
              </span>
            )}
            <span className="text-xs text-dear-charcoal-soft opacity-60">
              {isKo ? `${last30.length}일 기록` : `${last30.length} days logged`}
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm text-dear-charcoal-soft m-0">
          {isKo ? "아직 기록이 없어요." : "No entries yet."}
        </p>
      )}
      <p className="text-xs text-dear-charcoal-soft mt-2 opacity-70 m-0">
        {isKo
          ? "편지를 쓸 때 에너지(1-5)를 입력하면 기록돼요."
          : "Energy is logged when you write a letter with an energy rating."}
      </p>
    </div>
  );
}

function AssessmentCard({
  assessment,
  locale,
  isKo,
}: {
  assessment: AssessmentItem | null;
  locale: string;
  isKo: boolean;
}) {
  const result = assessment ? (assessment.track ?? assessment.pattern ?? null) : null;
  const dateStr = assessment
    ? new Date(assessment.createdAt).toLocaleDateString(isKo ? "ko-KR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
      role="region"
      aria-label={isKo ? "자존감 진단" : "Self-esteem assessment"}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-dear-charcoal">
          {isKo ? "자존감 진단 (50문항)" : "Self-esteem assessment (50)"}
        </div>
        <Link
          href={`/${locale}/assessment`}
          className="text-xs font-medium text-dear-sage hover:text-dear-charcoal transition-colors rounded-lg border border-dear-sage/30 bg-dear-sage/5 px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
          aria-label={isKo ? "진단하기" : "Take assessment"}
        >
          {isKo ? "진단하기" : "Take assessment"}
        </Link>
      </div>
      {result ? (
        <div className="space-y-1">
          <p className="text-sm text-dear-charcoal font-medium m-0">{result}</p>
          {dateStr && (
            <time className="text-xs text-dear-charcoal-soft block" dateTime={assessment!.createdAt}>
              {dateStr}
            </time>
          )}
          <Link
            href={`/${locale}/assessment/result`}
            className="text-xs text-dear-sage hover:underline block mt-1"
            aria-label={isKo ? "상세 결과 보기" : "View detailed results"}
          >
            {isKo ? "상세 결과 보기 →" : "View detailed results →"}
          </Link>
        </div>
      ) : (
        <p className="text-sm text-dear-charcoal-soft m-0">
          {isKo
            ? "아직 진단 기록이 없어요. 진단을 완료하면 결과가 여기에 표시됩니다."
            : "No assessment yet. Complete one to see your results here."}
        </p>
      )}
    </div>
  );
}

function TrainProgressCard({
  data,
  hasAssessment,
  locale,
  isKo,
}: {
  data: { lastCompletedDay: number; hasSession: boolean } | null;
  hasAssessment: boolean;
  locale: string;
  isKo: boolean;
}) {
  if (!data || !data.hasSession) return null;
  // Bug 1 gate: the 28-day program requires a completed 50-question assessment.
  // No submission yet → prompt the assessment instead of the "program ready" card.
  if (!hasAssessment) {
    return (
      <div
        role="region"
        aria-label={isKo ? "진단 먼저 완료" : "Complete assessment first"}
        className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
      >
        <p className="text-sm text-dear-charcoal m-0">
          {isKo
            ? "28일 프로그램을 시작하려면 먼저 50문항 진단을 완료하세요."
            : "Complete the 50-question assessment first to begin your 28-day program."}
        </p>
        <div className="mt-2">
          <a
            href={`/${locale}/assessment`}
            className="text-sm font-medium text-dear-sage underline"
          >
            {isKo ? "50문항 진단 하러 가기" : "Take the 50-question assessment"}
          </a>
        </div>
      </div>
    );
  }
  const lcd = Math.max(0, Math.min(28, data.lastCompletedDay || 0));
  const done = lcd >= 28;
  const n = Math.max(1, Math.min(28, lcd + 1));
  const href = `/${locale}/train/day/${n}`;
  const allHref = `/${locale}/train/28days`;
  const title =
    lcd === 0
      ? isKo
        ? "28일 프로그램이 기다리고 있어요. 오늘 Day 1부터 시작해볼까요?"
        : "Your 28-day program is ready. Shall we begin with Day 1 today?"
      : done
      ? isKo
        ? "28일, 끝까지 해냈어요. 축하해요 🎉"
        : "You completed all 28 days. Congratulations 🎉"
      : isKo
      ? `28일 프로그램 진행 중이에요 · 오늘은 Day ${n}, 준비됐나요?`
      : `You're on your 28-day program · Today is Day ${n}. Ready?`;
  return (
    <div
      role="region"
      aria-label={isKo ? "28일 프로그램 진행" : "28-day program progress"}
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
    >
      <p className="text-sm text-dear-charcoal m-0">{title}</p>
      {!done && (
        <div className="mt-2 flex items-center gap-3">
          <a href={href} className="text-sm font-medium text-dear-sage underline">
            {isKo ? `Day ${n} 하러 가기` : `Go to Day ${n}`}
          </a>
          <a href={allHref} className="text-xs text-dear-charcoal-soft underline">
            {isKo ? "전체 보기" : "View all"}
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Inline Dear Me letter composer (modal). Core lifted from the retired
 * /[locale]/dear-me route (deleted 05140389): textarea → POST /api/dear-me/letter
 * → reply display. Reply text is template-generated server-side
 * (letterService.getDearMeReplyTemplate); no phantom llm dependency. Page chrome
 * (AuthGate/ThemeBody) intentionally omitted — already applied by CenterPageClient.
 */
function DearMeComposerModal({
  lang,
  isKo,
  onClose,
  onSubmitted,
}: {
  lang: Locale;
  isKo: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const t = getMessages(lang).center;
  const [letterBody, setLetterBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = letterBody.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/dear-me/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterText: trimmed, lang }),
        credentials: "include",
      });
      const data: { replyMessage?: string; reply?: string; replyText?: string; error?: string } =
        await r.json().catch(() => ({}));
      if (data.error) {
        setError(data.error);
        return;
      }
      setReply(data.replyMessage ?? data.reply ?? data.replyText ?? null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(DEAR_ME_SUBMITTED_EVENT));
      }
      onSubmitted();
    } catch {
      setError(isKo ? "연결에 실패했어요. 잠시 후 다시 시도해 주세요." : "Connection failed. Please resubmit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isKo ? "나에게 쓰는 편지" : "Dear Me"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-dear-charcoal m-0">
            {isKo ? "나에게 쓰는 편지" : "Dear Me"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={isKo ? "닫기" : "Close"}
            className="text-dear-charcoal-soft hover:text-dear-charcoal rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
          >
            ✕
          </button>
        </div>

        {!reply ? (
          <div className="space-y-4">
            <p className="text-sm text-dear-charcoal-soft m-0">{t.letterPrompt}</p>
            <textarea
              value={letterBody}
              onChange={(e) => setLetterBody(e.target.value)}
              placeholder={t.letterPlaceholder}
              rows={6}
              className="w-full rounded-xl border border-dear-sage/30 bg-white/80 px-4 py-3 text-dear-charcoal placeholder:text-dear-charcoal-soft/60 resize-y"
              aria-label={t.letterPlaceholder}
            />
            {error && (
              <p className="text-red-600 text-sm m-0" role="alert">{error}</p>
            )}
            <button
              type="button"
              disabled={!letterBody.trim() || submitting}
              onClick={handleSubmit}
              className="w-full rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-3 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
              aria-busy={submitting}
              aria-label={t.submitLetter}
            >
              {submitting ? t.sendingLetter : t.submitLetter}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3 text-center">
              <p className="font-medium text-dear-charcoal m-0">{t.completedTitle}</p>
              <p className="mt-1 text-sm text-dear-charcoal-soft m-0">{t.completedSub}</p>
            </div>
            <div className="rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-4 text-dear-charcoal whitespace-pre-wrap">
              {reply}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setReply(null);
                  setLetterBody("");
                  setError(null);
                }}
                className="flex-1 rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-3 px-5 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
                aria-label={isKo ? "편지 다시 쓰기" : "Write letter again"}
              >
                {isKo ? "다시 쓰기" : "Write again"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-3 px-5 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
                aria-label={isKo ? "닫기" : "Close"}
              >
                {isKo ? "닫기" : "Close"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CenterPageClient({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).center;
  const isKo = lang === "ko";

  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<StageState | null>(null);
  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [submissions, setSubmissions] = useState<AssessmentItem[]>([]);
  const [resilience, setResilience] = useState<ResilienceEntry[]>([]);
  const [trainProgress, setTrainProgress] = useState<{ lastCompletedDay: number; hasSession: boolean } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const refreshLetters = useCallback(async () => {
    try {
      const r = await fetch("/api/dear-me/letters", { credentials: "include" });
      const data = r.ok ? await r.json().catch(() => null) : null;
      if (Array.isArray(data?.letters)) setLetters(data.letters as LetterItem[]);
    } catch {
      /* keep existing letters on failure */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/arena/leadership-engine/state", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/dear-me/letters", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/assessment/submissions", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/center/resilience?period=30", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/train/progress", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([stageData, lettersData, assessmentData, resilienceData, trainData]) => {
        if (cancelled) return;
        if (stageData) setStage(stageData as StageState);
        if (Array.isArray(lettersData?.letters)) setLetters(lettersData.letters as LetterItem[]);
        if (Array.isArray(assessmentData?.submissions))
          setSubmissions(assessmentData.submissions as AssessmentItem[]);
        if (Array.isArray(resilienceData?.entries))
          setResilience(resilienceData.entries as ResilienceEntry[]);
        setTrainProgress(
          trainData
            ? { lastCompletedDay: Number(trainData.lastCompletedDay ?? 0), hasSession: !!trainData.hasSession }
            : null
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isForcedReset =
    stage != null && (stage.currentStage === 4 || stage.forcedResetTriggeredAt != null);

  return (
    <>
      <ThemeBody theme="dear" />
      <main className="min-h-screen" aria-label={t.centerSuspenseMainRegionAria}>
        <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
          {loading ? (
            <div aria-busy="true" aria-label={t.loading} className="space-y-4">
              <CardSkeleton lines={2} showLabel />
              <CardSkeleton lines={3} showLabel={false} />
            </div>
          ) : isForcedReset ? (
            <div className="space-y-6">
              <header className="text-center">
                <h1 className="text-2xl font-medium text-dear-charcoal mb-2">bty Center</h1>
                <p className="text-dear-charcoal-soft text-sm leading-relaxed max-w-sm mx-auto">
                  {isKo
                    ? "지금은 잠시 쉬어가는 시간이 필요해요. 아래 과정을 마치면 다시 Arena로 돌아갈 수 있어요."
                    : "Take some time here. Complete the steps below to return to Arena."}
                </p>
              </header>
              <ForcedResetUX locale={locale} arenaHref={`/${locale}/bty-arena`} />
            </div>
          ) : (
            <div className="space-y-6">
              <header>
                <h1 className="text-2xl font-medium text-dear-charcoal">bty Center</h1>
                <p className="text-dear-charcoal-soft text-sm mt-1">
                  {isKo
                    ? "회복과 재정비의 공간이에요."
                    : "Your space for reflection and reset."}
                </p>
              </header>
              <TrainProgressCard
                data={trainProgress}
                hasAssessment={submissions.length > 0}
                locale={locale}
                isKo={isKo}
              />
              <section
                role="region"
                aria-label={t.currentStateTitle}
                className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3 space-y-3"
              >
                <h2 className="text-sm font-semibold text-dear-charcoal m-0">
                  {t.currentStateTitle}
                </h2>
                {stage && <StageContextCard stage={stage} isKo={isKo} />}
                <HealingPhaseTracker locale={lang} embedded />
              </section>
              <DearMeCard
                letter={letters[0] ?? null}
                locale={locale}
                isKo={isKo}
                onWrite={() => setComposerOpen(true)}
              />
              <ResilienceCard entries={resilience} locale={locale} isKo={isKo} />
              <AssessmentCard assessment={submissions[0] ?? null} locale={locale} isKo={isKo} />
            </div>
          )}
        </div>
      </main>
      {composerOpen && (
        <DearMeComposerModal
          lang={lang}
          isKo={isKo}
          onClose={() => setComposerOpen(false)}
          onSubmitted={refreshLetters}
        />
      )}
    </>
  );
}
