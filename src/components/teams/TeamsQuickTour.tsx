"use client";

import { useId, useState } from "react";

const copy = {
  en: {
    welcome: "New to BTY?",
    start: "30-second tour",
    replay: "Tour BTY",
    skip: "Skip",
    back: "Back",
    next: "Next",
    done: "Done",
    steps: [
      { title: "Check Today", body: "Open Today to see what needs your attention." },
      { title: "Open assigned training", body: "Go to Learn to find and open training assigned to you." },
      { title: "Save a Teams message", body: "Open the message’s … menu and choose Save under BTY. Find it later in Today under Saved for later." },
    ],
  },
  ko: {
    welcome: "BTY가 처음이신가요?",
    start: "30초 둘러보기",
    replay: "BTY 둘러보기",
    skip: "건너뛰기",
    back: "이전",
    next: "다음",
    done: "완료",
    steps: [
      { title: "오늘 할 일 확인", body: "‘오늘’에서 확인하거나 답해야 할 일을 볼 수 있어요." },
      { title: "배정된 교육 열기", body: "‘배우기’에서 내게 배정된 교육을 찾아 열 수 있어요." },
      { title: "Teams 메시지 저장", body: "메시지의 … 메뉴에서 BTY의 ‘저장’을 선택하세요. ‘오늘’의 ‘나중에 보기’에서 다시 볼 수 있어요." },
    ],
  },
} as const;

const buttonClass = "rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A66B]";
const primaryClass = `${buttonClass} bg-[#C9A66B] !text-[#0B1F3A] hover:bg-[#d6b879]`;

export function TeamsQuickTour({
  locale,
  mode,
  onDismiss,
}: {
  locale: "en" | "ko";
  mode: "offer" | "replay";
  onDismiss: () => void;
}) {
  const t = copy[locale];
  const headingId = useId();
  const [step, setStep] = useState<number | null>(null);

  function dismiss() {
    setStep(null);
    onDismiss();
  }

  if (step === null && mode === "replay") {
    return (
      <button
        type="button"
        onClick={() => setStep(0)}
        className="mt-2 self-start rounded-lg px-3 py-2 text-sm text-white/65 hover:text-white"
      >
        {t.replay}
      </button>
    );
  }

  const lesson = step === null ? null : t.steps[step];
  const last = step === t.steps.length - 1;
  return (
    <section aria-labelledby={headingId} className="mb-4 space-y-3 rounded-xl border border-white/15 bg-white/[0.05] p-4">
      <div aria-live="polite">
        {step !== null && <p className="mb-1 text-xs text-white/65">{step + 1} / {t.steps.length}</p>}
        <h2 id={headingId} className="text-base font-semibold text-white">{lesson?.title ?? t.welcome}</h2>
        {lesson && <p className="mt-1 text-sm leading-6 text-white/80">{lesson.body}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {step === null ? (
          <button type="button" className={primaryClass} onClick={() => setStep(0)}>{t.start}</button>
        ) : (
          <>
            {step > 0 && (
              <button type="button" className={buttonClass} onClick={() => setStep(step - 1)}>{t.back}</button>
            )}
            <button type="button" className={primaryClass} onClick={last ? dismiss : () => setStep(step + 1)}>
              {last ? t.done : t.next}
            </button>
          </>
        )}
        <button type="button" className={buttonClass} onClick={dismiss}>{t.skip}</button>
      </div>
    </section>
  );
}
