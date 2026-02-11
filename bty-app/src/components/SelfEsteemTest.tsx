"use client";

import { useState, useCallback } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  setSelfEsteemResult,
  type SelfEsteemLevel,
  type SelfEsteemResult,
} from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

function getLevel(avg: number): SelfEsteemLevel {
  if (avg >= 4) return "high";
  if (avg >= 3) return "mid";
  return "low";
}

const resultKeys = {
  high: "strengthHigh",
  mid: "strengthMid",
  low: "strengthLow",
} as const;

function getStrengthKey(
  level: SelfEsteemLevel
): (typeof resultKeys)[SelfEsteemLevel] {
  return resultKeys[level];
}

export function SelfEsteemTest({
  locale = "ko",
  theme = "sanctuary",
}: {
  locale?: Locale;
  theme?: "dear" | "sanctuary";
}) {
  const t = getMessages(locale).selfEsteem;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const currentQ = t.questions[step];
  const isLastStep = step === t.questions.length - 1;
  const isDear = theme === "dear";

  const handleChoice = useCallback(
    (value: number) => {
      const next = [...answers, value];
      setAnswers(next);
      if (isLastStep) {
        setDone(true);
        const score = next.reduce((a, b) => a + b, 0);
        const maxScore = t.questions.length * 5;
        const avg = score / t.questions.length;
        const level = getLevel(avg);
        const strengthKey = getStrengthKey(level);
        const strengthText = t.results[strengthKey];
        const weakAreaIndices = next
          .map((v, i) => (v <= 2 ? i : -1))
          .filter((i) => i >= 0);
        const result: SelfEsteemResult = {
          score,
          maxScore,
          level,
          strengthText,
          weakAreaIndices,
          completedAt: new Date().toISOString(),
        };
        setSelfEsteemResult(result);
      } else {
        setStep((s) => s + 1);
      }
    },
    [answers, isLastStep, t.questions.length, t.results]
  );

  const handleReset = () => {
    setStep(0);
    setAnswers([]);
    setDone(false);
  };

  const resultMessage = (() => {
    if (answers.length === 0) return "";
    const avg = answers.reduce((a, b) => a + b, 0) / answers.length;
    const level = getLevel(avg);
    if (level === "high") return t.results.high;
    if (level === "mid") return t.results.mid;
    return t.results.low;
  })();

  const resultLevel: SelfEsteemLevel | null = done
    ? getLevel(answers.reduce((a, b) => a + b, 0) / answers.length)
    : null;
  const strengthText =
    resultLevel != null ? t.results[getStrengthKey(resultLevel)] : "";
  const score = answers.reduce((a, b) => a + b, 0);
  const maxScore = t.questions.length * 5;
  const storyLabel =
    t.storyLabels?.[step] ?? `${step + 1}번째 이야기`;

  return (
    <section
      className={cn(
        !isDear &&
          "rounded-2xl p-6 sm:p-8 bg-sanctuary-lavender/40 border border-sanctuary-lavender/50 shadow-sm"
      )}
      aria-labelledby="self-esteem-test-heading"
    >
      <h2
        id="self-esteem-test-heading"
        className={cn(
          "text-xl font-medium mb-1",
          isDear ? "font-serif text-dear-charcoal" : "text-sanctuary-text"
        )}
      >
        {t.title}
      </h2>
      <p
        className={cn(
          "text-sm mb-6",
          isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft"
        )}
      >
        {t.subtitle}
      </p>
      {!done ? (
        <>
          <p
            className={cn(
              "text-xs mb-2",
              isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft"
            )}
          >
            {storyLabel}
          </p>
          <p
            className={cn(
              "font-medium mb-4",
              isDear ? "text-dear-charcoal" : "text-sanctuary-text"
            )}
          >
            {currentQ}
          </p>
          <div className="flex flex-wrap gap-2">
            {t.choices.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleChoice(c.value)}
                className={cn(
                  "rounded-xl py-2.5 px-4 text-sm transition-colors",
                  isDear
                    ? "bg-dear-bg border border-dear-charcoal/12 text-dear-charcoal hover:bg-dear-sage/15 hover:border-dear-sage/30"
                    : "bg-white/80 border border-sanctuary-lavender/50 text-sanctuary-text hover:bg-sanctuary-lavender/30"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* 따뜻한 리포트 카드: 강점 문구가 메인, 점수는 작게 */}
          <div
            className={cn(
              "p-5 rounded-xl",
              isDear
                ? "bg-dear-bg border border-dear-charcoal/10"
                : "bg-white/60 border border-sanctuary-lavender/40"
            )}
          >
            <p
              className={cn(
                "text-sm mb-1",
                isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft"
              )}
            >
              {score}
              {t.results.scoreSuffix} / {maxScore}
              {t.results.scoreSuffix}
            </p>
            <p
              className={cn(
                "font-medium text-lg mb-4",
                isDear ? "font-serif text-dear-charcoal" : "text-sanctuary-text"
              )}
            >
              {locale === "ko"
                ? `당신은 ${strengthText} 강점을 가진 사람이에요.`
                : `You are someone with ${strengthText} strength.`}
            </p>
            <p
              className={cn(
                "leading-relaxed",
                isDear ? "text-dear-charcoal" : "text-sanctuary-text"
              )}
            >
              {resultMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              "text-sm underline underline-offset-2",
              isDear
                ? "text-dear-charcoal-soft hover:text-dear-charcoal"
                : "text-sanctuary-text-soft hover:text-sanctuary-text"
            )}
          >
            {t.again}
          </button>
        </div>
      )}
    </section>
  );
}
