"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { ThemeBody } from "@/components/ThemeBody";
import { CardSkeleton } from "@/components/bty-arena";
import { ForcedResetUX } from "@/components/center/ForcedResetUX";
import { HealingPhaseTracker } from "@/components/center/HealingPhaseTracker";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

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

type AssessmentItem = {
  pattern_key: string | null;
  recommended_track: string | null;
  created_at: string;
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
        <p className="text-xs text-dear-charcoal-soft mt-1 opacity-80">
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
}: {
  letter: LetterItem | null;
  locale: string;
  isKo: boolean;
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
        <Link
          href={`/${locale}/dear-me`}
          className="text-xs font-medium text-dear-sage hover:text-dear-charcoal transition-colors rounded-lg border border-dear-sage/30 bg-dear-sage/5 px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
          aria-label={isKo ? "편지 쓰기" : "Write a letter"}
        >
          {isKo ? "편지 쓰기" : "Write a letter"}
        </Link>
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

function ResilienceCard({ entries, isKo }: { entries: ResilienceEntry[]; isKo: boolean }) {
  const last7 = entries.slice(-7);

  function dotColor(level: "high" | "mid" | "low"): string {
    if (level === "high") return "#14b8a6";
    if (level === "mid") return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3"
      role="region"
      aria-label={isKo ? "에너지 기록" : "Energy log"}
    >
      <div className="text-sm font-semibold text-dear-charcoal mb-2">
        {isKo ? "에너지 기록" : "Energy log"}
      </div>
      {last7.length > 0 ? (
        <div
          className="flex gap-2 items-center flex-wrap"
          role="list"
          aria-label={isKo ? "최근 7일 에너지" : "Last 7 days energy"}
        >
          {last7.map((entry) => (
            <div
              key={entry.date}
              role="listitem"
              title={`${entry.date}: ${entry.level}`}
              aria-label={`${entry.date}: ${entry.level}`}
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
      ) : (
        <p className="text-sm text-dear-charcoal-soft m-0">
          {isKo ? "아직 기록이 없어요." : "No entries yet."}
        </p>
      )}
      <p className="text-xs text-dear-charcoal-soft mt-2 opacity-70 m-0">
        {isKo
          ? "편지를 쓰면 에너지가 기록돼요."
          : "Energy is logged when you write a letter."}
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
  const result = assessment
    ? (assessment.recommended_track ?? assessment.pattern_key ?? null)
    : null;
  const dateStr = assessment
    ? new Date(assessment.created_at).toLocaleDateString(isKo ? "ko-KR" : "en-US", {
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
          {isKo ? "자존감 진단" : "Self-esteem assessment"}
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
        <>
          <p className="text-sm text-dear-charcoal font-medium m-0">{result}</p>
          {dateStr && (
            <time
              className="text-xs text-dear-charcoal-soft mt-1 block"
              dateTime={assessment!.created_at}
            >
              {dateStr}
            </time>
          )}
        </>
      ) : (
        <p className="text-sm text-dear-charcoal-soft m-0">
          {isKo ? "아직 진단 기록이 없어요." : "No assessment yet."}
        </p>
      )}
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
    ])
      .then(([stageData, lettersData, assessmentData, resilienceData]) => {
        if (cancelled) return;
        if (stageData) setStage(stageData as StageState);
        if (Array.isArray(lettersData?.letters)) setLetters(lettersData.letters as LetterItem[]);
        if (Array.isArray(assessmentData?.submissions))
          setSubmissions(assessmentData.submissions as AssessmentItem[]);
        if (Array.isArray(resilienceData?.entries))
          setResilience(resilienceData.entries as ResilienceEntry[]);
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
    <AuthGate loadingMessage={t.loading}>
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
                <h1 className="text-2xl font-medium text-dear-charcoal mb-2">BTY Center</h1>
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
                <h1 className="text-2xl font-medium text-dear-charcoal">BTY Center</h1>
                <p className="text-dear-charcoal-soft text-sm mt-1">
                  {isKo
                    ? "회복과 재정비의 공간이에요."
                    : "Your space for reflection and reset."}
                </p>
              </header>
              {stage && <StageContextCard stage={stage} isKo={isKo} />}
              <HealingPhaseTracker locale={lang} />
              <DearMeCard letter={letters[0] ?? null} locale={locale} isKo={isKo} />
              <ResilienceCard entries={resilience} isKo={isKo} />
              <AssessmentCard assessment={submissions[0] ?? null} locale={locale} isKo={isKo} />
            </div>
          )}
        </div>
      </main>
    </AuthGate>
  );
}
