"use client";

import { useCallback, useRef, useState } from "react";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { EliteArenaStep2Context } from "@/components/bty-arena/EliteArenaStep2Context";

/**
 * Foundry-authored practice player — the learner-facing three-phase surface.
 *
 * Reuses the Arena presentation (EliteArenaStep2Context + Arena theme tokens) and
 * preserves the canonical phase SEMANTICS: PRIMARY → TRADEOFF → ACTION DECISION →
 * completion. It is driven by a practice-local reducer (NOT the canonical fixed-id
 * A/D·X/Y·AD1/AD2 flow machine, which cannot represent a variable-count draft, and
 * NOT the postArenaChoice binding, which would fire XP/pattern/leadership). So a
 * practice writes no per-choice server state; the only optional persistence is a
 * single completion callback in play mode.
 *
 * Two modes:
 *  - "test": host preview of the exact current draft. Ephemeral — NO run, NO XP, NO
 *    completion record. Visibly labeled TEST. `onExit` returns to the editor.
 *  - "play": a published practice from the Arena tab. `onComplete` fires once when
 *    the learner reaches the end (the caller records completion; still zero XP).
 */

type Phase = "opening" | "primary" | "tradeoff" | "action" | "complete";

const COPY = {
  en: {
    testBanner: "TEST · Preview — nothing is saved and no points are earned",
    begin: "Begin",
    continue: "Continue",
    decide: "Decide",
    itGetsHarder: "It gets harder",
    yourChoice: "Your choice",
    completeTitle: "Practice complete",
    completeBody: "You worked through the full decision. Nothing here counts against you — it's practice.",
    done: "Done",
    exitTest: "Back to editor",
    actionTag: "action",
    from: "From",
  },
  ko: {
    testBanner: "테스트 · 미리보기 — 저장되지 않고 점수도 없습니다",
    begin: "시작",
    continue: "계속",
    decide: "결정",
    itGetsHarder: "상황이 더 어려워집니다",
    yourChoice: "당신의 선택",
    completeTitle: "연습 완료",
    completeBody: "결정 과정을 끝까지 진행했습니다. 이건 연습이니 불이익은 없습니다.",
    done: "완료",
    exitTest: "편집기로 돌아가기",
    actionTag: "행동",
    from: "원본",
  },
};

function ChoiceCard({
  label,
  tag,
  onSelect,
  disabled,
}: {
  label: string;
  tag?: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-bty-border/70 bg-white px-4 py-3.5 text-left transition-colors hover:border-bty-navy/40 hover:bg-bty-soft/40 disabled:opacity-50"
    >
      <span className="min-w-0 text-[0.98rem] leading-6 text-bty-navy">{label}</span>
      {tag ? (
        <span className="shrink-0 rounded-full border border-bty-navy/30 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-bty-navy/70">
          {tag}
        </span>
      ) : null}
    </button>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bty-navy/60">{children}</h3>;
}

export function ArenaPracticePlayer({
  scenario,
  locale,
  mode,
  sourceTrainingTitle,
  onExit,
  onComplete,
}: {
  scenario: ArenaScenarioDraft;
  locale: string;
  mode: "test" | "play";
  sourceTrainingTitle?: string;
  onExit: () => void;
  onComplete?: () => void;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [phase, setPhase] = useState<Phase>("opening");
  const completedRef = useRef(false);

  const goComplete = useCallback(() => {
    setPhase("complete");
    if (mode === "play" && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [mode, onComplete]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-1 pb-8">
      {mode === "test" ? (
        <p className="rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
          {t.testBanner}
        </p>
      ) : null}
      {sourceTrainingTitle ? (
        <p className="text-xs text-bty-navy/50">
          {t.from}: {sourceTrainingTitle}
        </p>
      ) : null}

      {phase === "opening" ? (
        <div className="flex flex-col gap-5">
          <EliteArenaStep2Context title={scenario.title} contextBody={scenario.opening} locale={loc} />
          <button
            type="button"
            onClick={() => setPhase("primary")}
            className="rounded-2xl bg-bty-navy px-6 py-3.5 text-base font-semibold text-white"
          >
            {t.begin}
          </button>
        </div>
      ) : null}

      {phase === "primary" ? (
        <div className="flex flex-col gap-3">
          <EliteArenaStep2Context title={scenario.title} contextBody={scenario.opening} locale={loc} />
          <SectionHeading>{t.yourChoice}</SectionHeading>
          {scenario.primary.choices.map((c) => (
            <ChoiceCard key={c.id} label={c.label} onSelect={() => setPhase("tradeoff")} />
          ))}
        </div>
      ) : null}

      {phase === "tradeoff" ? (
        <div className="flex flex-col gap-3">
          <SectionHeading>{t.itGetsHarder}</SectionHeading>
          <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-bty-navy/90">
            {scenario.tradeoff.escalationText}
          </p>
          <div className="mt-1 flex flex-col gap-2.5">
            {scenario.tradeoff.choices.map((c) => (
              <ChoiceCard key={c.id} label={c.label} onSelect={() => setPhase("action")} />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "action" ? (
        <div className="flex flex-col gap-3">
          <SectionHeading>{t.decide}</SectionHeading>
          <p className="text-[0.98rem] leading-7 text-bty-navy">{scenario.actionDecision.prompt}</p>
          <div className="mt-1 flex flex-col gap-2.5">
            {scenario.actionDecision.choices.map((c) => (
              <ChoiceCard
                key={c.id}
                label={c.label}
                tag={c.isActionCommitment ? t.actionTag : undefined}
                onSelect={goComplete}
              />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "complete" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <h2 className="text-xl font-semibold text-bty-navy">{t.completeTitle}</h2>
          <p className="max-w-sm text-sm leading-6 text-bty-navy/70">{t.completeBody}</p>
          <button
            type="button"
            onClick={onExit}
            className="rounded-2xl bg-bty-navy px-6 py-3 text-base font-semibold text-white"
          >
            {mode === "test" ? t.exitTest : t.done}
          </button>
        </div>
      ) : null}
    </div>
  );
}
