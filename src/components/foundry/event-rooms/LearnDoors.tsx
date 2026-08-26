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

/*
  THE DOOR NAMES WHAT IS BEHIND IT (Slice R4-R5C6).

  This card used to read "My learning — Open required training or continue where you left off",
  which is a description of the REQUIRED LEARNING section, not of this destination. Rendered
  above that section and styled larger, it gave a learner with assigned work two plausible taps
  and made the wrong one the obvious one.

  MEASURED before rewriting: `onOpenLearning` opens `FoundryMyLearning`, which fetches
  `/api/bty/foundry/history`, labels every row "Completed · <date>", and shows "No completed
  trainings yet." when there is none. It is history, so the card now says so.

  The words "required", "continue", "start" and "assigned" are deliberately absent here — those
  belong to the section that actually offers the work, and a guard test keeps them out.
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
    eventTitle: string;
    eventBody: string;
    myEventsTitle: string;
    myEventsBody: string;
  }
> = {
  en: {
    learnTitle: "Learning history",
    learnBody: "See what you've completed and learned.",
    learnCta: "View history",
    createTitle: "Create training",
    createBody: "Turn a real workplace issue into clear training for your team.",
    createCta: "Create training",
    eventTitle: "Open an event",
    eventBody: "Open a real moment for your team to participate in.",
    myEventsTitle: "My events",
    myEventsBody: "See participation in the Reality Events you opened.",
  },
  /*
    WRITTEN AS KOREAN, NOT TRANSLATED INTO IT.

    Each line names the job the door actually opens, measured rather than inferred from its
    label: the create door POSTs a module draft and lands in the Builder; the next two open and
    then review a REAL GATHERING where people scan a QR. "이벤트" was carrying both that
    gathering and the quick training room three taps below, so it is gone from both.
  */
  ko: {
    learnTitle: "학습 기록",
    learnBody: "지금까지 마친 학습을 다시 보세요.",
    learnCta: "기록 보기",
    createTitle: "훈련 만들기",
    createBody: "팀에서 반복되는 문제를 하나 골라 훈련으로 만드세요.",
    createCta: "훈련 만들기",
    eventTitle: "팀 모으기",
    eventBody: "팀이 직접 모이는 자리를 여세요.",
    myEventsTitle: "내가 연 자리",
    myEventsBody: "내가 열었던 자리에 누가 참여했는지 확인하세요.",
  },
};

export function LearnDoors({
  locale,
  canCreate,
  onOpenLearning,
  onCreate,
  onOpenEvent,
  onOpenMyEvents,
}: {
  locale: Locale;
  /** True only when the user holds the existing training-creation capability. */
  canCreate: boolean;
  onOpenLearning: () => void;
  onCreate: () => void;
  /** Opens the in-shell Event-create view (Slice 3.2D-EVENT-R1). Omitted → the door is hidden. */
  onOpenEvent?: () => void;
  /** Opens the in-shell Host "My events" participation view (Slice 3.2E-EVENT-HOST). */
  onOpenMyEvents?: () => void;
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
        {/*
          SECONDARY BY WEIGHT, NOT BY A NEW SYSTEM (R4-R5C6 §8). Measured: the assigned training
          card's own title is `text-[0.98rem] font-medium text-white/90`, so a `text-lg
          font-semibold text-white` history title stayed the heaviest text on the learner's Learn
          surface even after the reorder — current work would have been first but still quieter
          than the archive. This drops to the SAME scale the card above already uses. No new
          colour, no new primitive, and the CTA below is unchanged: it was already gold TEXT,
          never a filled gold button like Start/Continue learning.
        */}
        <span className="text-[0.98rem] font-medium text-white/90">{t.learnTitle}</span>
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

      {/* Reality Event Host entry (Slice 3.2D-EVENT-R1). IN-SHELL callback (not a route
          link) so it never leaves the installed app webview; visibility mirrors the creator
          capability, and the leader-track authority is enforced by POST /api/bty/events. */}
      {canCreate && onOpenEvent ? (
        <button
          type="button"
          onClick={onOpenEvent}
          data-testid="door-open-event"
          className="flex flex-col items-start gap-1 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-4 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="text-lg font-semibold text-white">{t.eventTitle}</span>
          <span className="text-sm leading-6 text-white/60">{t.eventBody}</span>
        </button>
      ) : null}

      {/* Reality Event Host results (Slice 3.2E-EVENT-HOST). In-shell callback; same creator gate. */}
      {canCreate && onOpenMyEvents ? (
        <button
          type="button"
          onClick={onOpenMyEvents}
          data-testid="door-my-events"
          className="flex flex-col items-start gap-1 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-4 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="text-lg font-semibold text-white">{t.myEventsTitle}</span>
          <span className="text-sm leading-6 text-white/60">{t.myEventsBody}</span>
        </button>
      ) : null}
    </section>
  );
}
