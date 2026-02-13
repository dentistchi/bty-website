"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 자존감 테스트 (기존 유지)
 * - 결과 표시 방식만 개편: 점수/등급/비교 없음. 안식처 톤의 '받아들임' 메시지.
 */

const QUESTIONS = [
  "나는 내가 해낸 일에 대해 만족하는 편이다.",
  "나는 대체로 나 자신에 대해 괜찮다고 느낀다.",
  "나는 내 단점도 받아들이려 노력한다.",
  "실패해도 나는 나 자신을 존중할 수 있다.",
  "나는 나에게 친절하게 말하려 노력한다.",
];

const CHOICES = [
  { value: 1, label: "거의 그렇지 않다" },
  { value: 2, label: "그렇지 않은 편이다" },
  { value: 3, label: "보통이다" },
  { value: 4, label: "그런 편이다" },
  { value: 5, label: "매우 그렇다" },
];

export function SelfEsteemTest() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const currentQ = QUESTIONS[step];
  const isLastStep = step === QUESTIONS.length - 1;

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

  // 결과는 점수/등급 없이 '받아들임' 메시지만 (평가·비교 금지)
  const resultMessage = getResultMessage(answers);

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
        자존감 알아보기
      </h2>
      <p className="text-sm text-sanctuary-text-soft mb-6">
        맞는 말에 가깝다고 느끼는 칸을 골라주세요. 정답은 없어요.
      </p>

      {!done ? (
        <>
          <p className="text-sanctuary-text font-medium mb-4">{currentQ}</p>
          <div className="flex flex-wrap gap-2">
            {CHOICES.map((c) => (
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
            {step + 1} / {QUESTIONS.length}
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
            다시 알아보기
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * 점수/등급 없이, 안식처 톤의 받아들임 메시지만 반환.
 */
function getResultMessage(answers: number[]): string {
  if (answers.length === 0) return "";
  const avg = answers.reduce((a, b) => a + b, 0) / answers.length;
  // 비교·평가 금지. "당신은 ~점이에요" 같은 문구 사용 금지.
  if (avg >= 4) {
    return "지금 이 순간에도 스스로를 괜찮다고 느끼려 한 걸음씩 내딛고 있어요. 그 마음이 여기까지 와 있다는 것만으로도 충분히 의미 있어요.";
  }
  if (avg >= 3) {
    return "가끔은 나 자신이 불안하거나 부족하게 느껴질 수 있어요. 그런 날에도 여기선 그냥 그대로 있어도 괜찮아요.";
  }
  return "자신에 대해 엄하게 느껴지는 날이 있을 수 있어요. 그런 마음이 드는 건 당신이 부족해서가 아니라, 스스로를 소중히 여기고 싶어하기 때문이에요. 여기는 그 마음을 그대로 두어도 되는 곳이에요.";
}
