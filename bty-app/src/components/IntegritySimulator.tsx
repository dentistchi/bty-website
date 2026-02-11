"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Integrity Simulator (대출 심사 비유)
 * - 사용자 갈등 상황 입력 → Dr. Chi의 대출 심사 스토리로 입장 바꿔 생각하게 함.
 * - "만약 당신이 은행에서 똑같은 말을 듣는다면 기분이 어떨까요?"
 */

type Step = "input" | "story" | "question" | "reflection";

const DR_CHI_LOAN_STORY = [
  "은행에서 대출을 신청한 사람에게 직원이 이렇게 말합니다.",
  "\"당신은 그 정도도 못 지키시나요? 다른 분들은 다 잘 받아가시는데.\"",
  "\"그런 식이면 앞으로도 신용이 안 됩니다.\"",
];

const REFLECTION_QUESTION =
  "만약 당신이 은행에서 똑같은 말을 듣는다면 기분이 어떨까요?";

function SimulatorLayout({
  step,
  situation,
  setSituation,
  onNext,
  onStartOver,
}: {
  step: Step;
  situation: string;
  setSituation: (v: string) => void;
  onNext: () => void;
  onStartOver: () => void;
}) {
  return (
    <div
      role="region"
      aria-labelledby="integrity-simulator-heading"
      className={cn(
        "rounded-2xl border border-dojo-purple-muted bg-dojo-white",
        "shadow-sm overflow-hidden"
      )}
    >
      <div className="p-6 sm:p-8 border-b border-dojo-purple-muted bg-dojo-purple/5">
        <h2
          id="integrity-simulator-heading"
          className="text-xl font-semibold text-dojo-purple-dark"
        >
          Integrity Simulator
        </h2>
        <p className="text-sm text-dojo-ink-soft mt-1">
          갈등 상황을 입력하면, 다른 입장에서 생각해보는 연습을 도와드립니다.
        </p>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {step === "input" && (
          <>
            <label className="block">
              <span className="text-sm font-medium text-dojo-ink">
                겪었던 갈등 상황을 간단히 적어주세요.
              </span>
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="예: 직원에게 급여 관련해서 말했는데, 상대가 불쾌해했어요."
                rows={4}
                className={cn(
                  "mt-2 w-full rounded-xl px-4 py-3 resize-none",
                  "border border-dojo-purple-muted bg-dojo-white",
                  "placeholder:text-dojo-ink-soft/70",
                  "focus:outline-none focus:ring-2 focus:ring-dojo-purple/30 focus:border-dojo-purple"
                )}
              />
            </label>
            <button
              type="button"
              onClick={onNext}
              disabled={!situation.trim()}
              className={cn(
                "px-6 py-3 rounded-xl font-medium",
                "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            >
              다음
            </button>
          </>
        )}

        {step === "story" && (
          <>
            <p className="text-sm text-dojo-ink-soft">
              Dr. Chi: 이런 비유를 들어보세요.
            </p>
            <div className="space-y-3 pl-2 border-l-2 border-dojo-purple/30">
              {DR_CHI_LOAN_STORY.map((line, i) => (
                <p key={i} className="text-dojo-ink">
                  {line}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={onNext}
              className={cn(
                "px-6 py-3 rounded-xl font-medium",
                "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
                "transition-colors"
              )}
            >
              다음
            </button>
          </>
        )}

        {step === "question" && (
          <>
            <p className="text-dojo-ink">{REFLECTION_QUESTION}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onNext}
                className={cn(
                  "px-6 py-3 rounded-xl font-medium",
                  "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
                  "transition-colors"
                )}
              >
                생각해보기
              </button>
            </div>
          </>
        )}

        {step === "reflection" && (
          <>
            <p className="text-dojo-ink">
              당신이 겪었던 상황에서 상대방이 들었을 말과, 방금 비유에서 나온 말이
              비슷한 뉘앙스일 수 있습니다. 역지사지(己所不欲勿施于人)—내가 받기
              싫은 말은 남에게 하지 않는 것. 오늘 이 연습이 그런 통찰에 한 걸음이
              되었기를 바랍니다.
            </p>
            <button
              type="button"
              onClick={onStartOver}
              className={cn(
                "text-sm text-dojo-purple hover:underline"
              )}
            >
              처음부터 다시하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function IntegritySimulator() {
  const [step, setStep] = useState<Step>("input");
  const [situation, setSituation] = useState("");

  const next = () => {
    if (step === "input") setStep("story");
    else if (step === "story") setStep("question");
    else if (step === "question") setStep("reflection");
  };

  const startOver = () => {
    setStep("input");
    setSituation("");
  };

  return (
    <SimulatorLayout
      step={step}
      situation={situation}
      setSituation={setSituation}
      onNext={next}
      onStartOver={startOver}
    />
  );
}
