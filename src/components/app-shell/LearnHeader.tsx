"use client";

/**
 * Learn — identity header (App Shell + Today Simplification V1, Phase 5).
 *
 * A calm learner-facing header shown ABOVE the existing Foundry surface (Event Rooms, Required
 * Learning, Program discovery/progress, and — for authorized hosts — the creation tools). The point
 * is that a learner can continue or open training WITHOUT first understanding "Foundry": the primary
 * language is "Learn / What do you want to get better at?", and Foundry appears only as a quiet
 * secondary attribution. No canonical name, route, or engine is renamed — this is UI translation only.
 *
 * A "My learning" quick entry is offered when the surface can open the learner's own history.
 */

type Locale = "en" | "ko";

const COPY: Record<Locale, { eyebrow: string; title: string; poweredBy: string; myLearning: string }> = {
  en: {
    eyebrow: "Learn",
    title: "What do you want to get better at?",
    poweredBy: "Powered by BTY Foundry",
    myLearning: "My learning",
  },
  ko: {
    eyebrow: "배움",
    title: "무엇을 더 잘하고 싶으신가요?",
    poweredBy: "BTY Foundry 제공",
    myLearning: "나의 학습",
  },
};

export default function LearnHeader({
  locale,
  onOpenMyLearning,
}: {
  locale: string;
  onOpenMyLearning?: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  return (
    <header className="mb-5 flex flex-col gap-1" data-testid="learn-header">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/80">{t.eyebrow}</span>
      <h1 className="text-[1.4rem] font-semibold leading-tight tracking-tight text-white">{t.title}</h1>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-[0.7rem] tracking-wide text-white/35">{t.poweredBy}</span>
        {onOpenMyLearning ? (
          <button
            type="button"
            data-testid="learn-my-learning"
            onClick={onOpenMyLearning}
            className="rounded-full border border-white/12 px-3 py-1 text-[0.72rem] text-white/70 hover:text-white/90"
          >
            {t.myLearning}
          </button>
        ) : null}
      </div>
    </header>
  );
}
