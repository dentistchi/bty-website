"use client";

/**
 * Me — entry list (App Shell + Today Simplification V1, Phase 7).
 *
 * The "Me" tab is identity + everything the person owns: account & settings (AccountBlock),
 * the self mirror + weekly rhythm (CenterMeCard + WeeklyOrb), and these navigable entries:
 *   • My Learning     → the learner's own private reflection history (in-shell)
 *   • Recovery / Center → the self-owned Center surface (in-shell). The deterministic forced-reset
 *     redirect (middleware) is UNTOUCHED; this is only the VOLUNTARY entry into Center.
 *   • My Experiences  → calm "Coming next" placeholder (no scheduled-experience contract yet)
 *
 * Presentational only — the shell owns the sub-view state and reads.
 */

type Locale = "en" | "ko";

const COPY: Record<Locale, {
  myLearning: string;
  myLearningSub: string;
  recovery: string;
  recoverySub: string;
  experiences: string;
  experiencesSub: string;
  comingNext: string;
}> = {
  en: {
    myLearning: "My Learning",
    myLearningSub: "What you're learning and becoming.",
    recovery: "Recovery / Center",
    recoverySub: "A quiet place to return to yourself.",
    experiences: "My Experiences",
    experiencesSub: "Live sessions you've joined.",
    comingNext: "Coming next",
  },
  ko: {
    myLearning: "나의 학습",
    myLearningSub: "당신이 배우고 되어가는 것.",
    recovery: "회복 / 센터",
    recoverySub: "나에게로 돌아오는 조용한 자리.",
    experiences: "나의 경험",
    experiencesSub: "참여한 라이브 세션.",
    comingNext: "곧 제공됩니다",
  },
};

function Row({
  title,
  sub,
  badge,
  onClick,
  testId,
  disabled,
}: {
  title: string;
  sub: string;
  badge?: string;
  onClick?: () => void;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={
        "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left" +
        (disabled ? " opacity-60" : "")
      }
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[0.95rem] font-medium text-white/90">{title}</span>
        <span className="truncate text-[0.78rem] text-white/50">{sub}</span>
      </div>
      {badge ? (
        <span className="shrink-0 rounded-md border border-white/[0.12] px-2 py-0.5 text-[0.66rem] text-white/45">{badge}</span>
      ) : (
        <span aria-hidden className="shrink-0 text-white/30">›</span>
      )}
    </button>
  );
}

export default function MeEntries({
  locale,
  onOpenMyLearning,
  onOpenRecovery,
}: {
  locale: string;
  onOpenMyLearning: () => void;
  onOpenRecovery: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  return (
    <div className="flex flex-col gap-2" data-testid="me-entries">
      <Row testId="me-my-learning" title={t.myLearning} sub={t.myLearningSub} onClick={onOpenMyLearning} />
      <Row testId="me-recovery" title={t.recovery} sub={t.recoverySub} onClick={onOpenRecovery} />
      <Row testId="me-experiences" title={t.experiences} sub={t.experiencesSub} badge={t.comingNext} disabled />
    </div>
  );
}
