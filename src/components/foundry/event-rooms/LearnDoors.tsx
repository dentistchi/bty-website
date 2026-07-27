"use client";

import type { Locale } from "./copy";

/**
 * Two-door first-time entry (Slice 3.2C-B3A.1). A first-time user must grasp, in
 * seconds and without any product vocabulary, that BTY does two things:
 *   • MY LEARNING   — receive/continue/review training (every authenticated user)
 *   • CREATE TRAINING — turn a real workplace issue into training (creators only)
 *
 * No Host/Learner mode switch — both doors coexist in the one shell; the create
 * door simply appears only when the user has the existing creation capability.
 * Internal terms (Foundry / Program / Run / Module / Journey / lineage) never
 * surface here.
 */

const COPY: Record<
  Locale,
  {
    learnTitle: string;
    learnBody: string;
    learnCta: string;
    createTitle: string;
    createBody: string;
    createCta: string;
  }
> = {
  en: {
    learnTitle: "My learning",
    learnBody: "Open required training or continue where you left off.",
    learnCta: "Open my learning",
    createTitle: "Create training",
    createBody: "Turn a real workplace issue into clear training for your team.",
    createCta: "Create training",
  },
  ko: {
    learnTitle: "나의 학습",
    learnBody: "배정된 트레이닝을 열거나 이어서 진행하세요.",
    learnCta: "나의 학습 열기",
    createTitle: "트레이닝 만들기",
    createBody: "현장의 실제 문제를 팀을 위한 명확한 트레이닝으로 만드세요.",
    createCta: "트레이닝 만들기",
  },
};

export function LearnDoors({
  locale,
  canCreate,
  onOpenLearning,
  onCreate,
}: {
  locale: Locale;
  /** True only when the user holds the existing training-creation capability. */
  canCreate: boolean;
  onOpenLearning: () => void;
  onCreate: () => void;
}) {
  const t = COPY[locale];
  return (
    <section className="flex flex-col gap-3" data-testid="learn-doors">
      <button
        type="button"
        onClick={onOpenLearning}
        data-testid="door-my-learning"
        className="flex flex-col items-start gap-1 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-4 text-left transition-colors hover:bg-white/[0.06]"
      >
        <span className="text-lg font-semibold text-white">{t.learnTitle}</span>
        <span className="text-sm leading-6 text-white/60">{t.learnBody}</span>
        <span className="mt-1 text-sm font-semibold text-[#C9A66B]">{t.learnCta} →</span>
      </button>

      {canCreate ? (
        <button
          type="button"
          onClick={onCreate}
          data-testid="door-create-training"
          className="flex flex-col items-start gap-1 rounded-2xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-5 py-4 text-left transition-colors hover:bg-[#C9A66B]/[0.14]"
        >
          <span className="text-lg font-semibold text-[#E5B769]">{t.createTitle}</span>
          <span className="text-sm leading-6 text-white/65">{t.createBody}</span>
        </button>
      ) : null}
    </section>
  );
}
