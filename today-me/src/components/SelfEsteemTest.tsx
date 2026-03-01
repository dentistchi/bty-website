"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Self-esteem check (Dear Me)
 * - No score/grade; sanctuary-toned acceptance messages only.
 * - Supports locale: ko (default) and en.
 */

const CONTENT = {
  ko: {
    title: "자존감 알아보기",
    subtitle: "맞는 말에 가깝다고 느끼는 칸을 골라주세요. 정답은 없어요.",
    questions: [
      "나는 내가 해낸 일에 대해 만족하는 편이다.",
      "나는 대체로 나 자신에 대해 괜찮다고 느낀다.",
      "나는 내 단점도 받아들이려 노력한다.",
      "실패해도 나는 나 자신을 존중할 수 있다.",
      "나는 나에게 친절하게 말하려 노력한다.",
    ],
    choices: [
      { value: 1, label: "거의 그렇지 않다" },
      { value: 2, label: "그렇지 않은 편이다" },
      { value: 3, label: "보통이다" },
      { value: 4, label: "그런 편이다" },
      { value: 5, label: "매우 그렇다" },
    ],
    again: "다시 알아보기",
    resultHigh:
      "지금 이 순간에도 스스로를 괜찮다고 느끼려 한 걸음씩 내딛고 있어요. 그 마음이 여기까지 와 있다는 것만으로도 충분히 의미 있어요.",
    resultMid:
      "가끔은 나 자신이 불안하거나 부족하게 느껴질 수 있어요. 그런 날에도 여기선 그냥 그대로 있어도 괜찮아요.",
    resultLow:
      "자신에 대해 엄하게 느껴지는 날이 있을 수 있어요. 그런 마음이 드는 건 당신이 부족해서가 아니라, 스스로를 소중히 여기고 싶어하기 때문이에요. 여기는 그 마음을 그대로 두어도 되는 곳이에요.",
  },
  en: {
    title: "Self-esteem check",
    subtitle: "Choose the option that feels closest to you. There are no right or wrong answers.",
    questions: [
      "I am generally satisfied with what I have accomplished.",
      "I generally feel okay about myself.",
      "I try to accept my shortcomings as well.",
      "I can respect myself even when I fail.",
      "I try to speak to myself kindly.",
    ],
    choices: [
      { value: 1, label: "Almost never" },
      { value: 2, label: "Rarely" },
      { value: 3, label: "Sometimes" },
      { value: 4, label: "Often" },
      { value: 5, label: "Almost always" },
    ],
    again: "Take it again",
    resultHigh:
      "Even in this moment you are taking small steps to feel okay with yourself. That your heart has brought you this far is already meaningful.",
    resultMid:
      "Some days we feel anxious or not enough. On those days too, it's okay to simply be here as you are.",
    resultLow:
      "Some days we're hard on ourselves. That doesn't mean you're lacking—it means you care about treating yourself with care. This is a place where that feeling can stay as it is.",
  },
} as const;

export type SelfEsteemLocale = "ko" | "en";

export interface SelfEsteemTestProps {
  /** Default "ko". When not provided, uses "ko". */
  locale?: SelfEsteemLocale;
}

export function SelfEsteemTest({ locale: localeProp = "ko" }: SelfEsteemTestProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const t = CONTENT[localeProp];
  const questions = t.questions;
  const currentQ = questions[step];
  const isLastStep = step === questions.length - 1;

  const handleChoice = (value: number) => {
    const next = [...answers, value];
    setAnswers(next);
    if (isLastStep) {
      setDone(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleReset = () => {
    setStep(0);
    setAnswers([]);
    setDone(false);
  };

  const resultMessage = getResultMessage(answers, localeProp);

  return (
    <section
      className={cn(
        "rounded-2xl p-6 sm:p-8",
        "bg-sanctuary-lavender/40 border border-sanctuary-lavender/50",
        "shadow-sm"
      )}
      aria-labelledby="self-esteem-test-heading"
    >
      <h2
        id="self-esteem-test-heading"
        className="text-xl font-medium text-sanctuary-text mb-1"
      >
        {t.title}
      </h2>
      <p className="text-sm text-sanctuary-text-soft mb-6">
        {t.subtitle}
      </p>

      {!done ? (
        <>
          <p className="text-sanctuary-text font-medium mb-4">{currentQ}</p>
          <div className="flex flex-wrap gap-2">
            {t.choices.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleChoice(c.value)}
                className={cn(
                  "rounded-xl py-2.5 px-4 text-sm",
                  "bg-white/80 border border-sanctuary-lavender/50",
                  "text-sanctuary-text hover:bg-sanctuary-lavender/30",
                  "transition-colors"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-sanctuary-text-soft">
            {step + 1} / {questions.length}
          </p>
        </>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "p-5 rounded-xl",
              "bg-white/60 border border-sanctuary-lavender/40"
            )}
          >
            <p className="text-sanctuary-text leading-relaxed">
              {resultMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              "text-sm text-sanctuary-text-soft hover:text-sanctuary-text",
              "underline underline-offset-2"
            )}
          >
            {t.again}
          </button>
        </div>
      )}
    </section>
  );
}

function getResultMessage(answers: number[], locale: SelfEsteemLocale): string {
  if (answers.length === 0) return "";
  const avg = answers.reduce((a, b) => a + b, 0) / answers.length;
  const t = CONTENT[locale];
  if (avg >= 4) return t.resultHigh;
  if (avg >= 3) return t.resultMid;
  return t.resultLow;
}
