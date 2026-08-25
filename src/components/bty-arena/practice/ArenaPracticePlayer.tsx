"use client";

import { useCallback, useRef, useState } from "react";
import { isBranchAware, type ArenaScenarioDraft, type ScenarioDraftChoice, type SelectedPath } from "@/domain/foundry/arena-draft/types";
import type { PathInput } from "@/domain/foundry/arena-draft/path";
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
    whatHappened: "What happened",
    itGetsHarder: "It gets harder",
    yourChoice: "Your choice",
    completeTitle: "Practice complete",
    completeBody: "You worked through the full decision. Nothing here counts against you — it's practice.",
    done: "Done",
    exitTest: "Back to editor",
    from: "From",
  },
  ko: {
    testBanner: "테스트 · 미리보기 — 저장되지 않고 점수도 없습니다",
    begin: "시작",
    continue: "계속",
    decide: "결정",
    whatHappened: "그 결과",
    itGetsHarder: "상황이 더 어려워집니다",
    yourChoice: "당신의 선택",
    completeTitle: "연습 완료",
    completeBody: "결정 과정을 끝까지 진행했습니다. 이건 연습이니 불이익은 없습니다.",
    done: "완료",
    exitTest: "편집기로 돌아가기",
    from: "원본",
  },
};

/**
 * A learner-facing choice card — label only, identical structure for every option in
 * every phase. It carries NO badge/pill/capsule: the only prior marker rendered the
 * internal `isActionCommitment` classification, which leaked which option the design
 * treats as the "real action" (a preferred-answer / hidden-direction signal the
 * learner must not see) and, being present on just the commitment option, made that
 * card look preselected. Selection is expressed only by advancing the phase — there is
 * no lingering per-choice selected state. (Slice 2.4A.4.)
 */
function ChoiceCard({
  label,
  onSelect,
  disabled,
}: {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-2xl border border-bty-border/70 bg-white px-4 py-3.5 text-left transition-colors hover:border-bty-navy/40 hover:bg-bty-soft/40 disabled:opacity-50"
    >
      <span className="min-w-0 text-[0.98rem] leading-6 text-bty-navy">{label}</span>
    </button>
  );
}

/*
  WHY THE DIMMED NAVY IS WRITTEN AS A HEX AND NOT THE TOKEN (Slice R4-R5A-R1).

  `text-bty-navy/NN` COMPILES TO NOTHING. The Tailwind token is `navy: "var(--bty-brand-navy)"`
  (tailwind.config.ts) — a bare `var()` with no `<alpha-value>` placeholder — so Tailwind v3 cannot
  apply an opacity modifier and DROPS THE UTILITY ENTIRELY. Measured in the shipped stylesheet: the
  only rule that exists is `.text-bty-navy{color:var(--bty-brand-navy)}`; `/50`, `/60`, `/65`, `/70`
  and `/90` produce ZERO rules.

  An element with no `color` declaration inherits one, and that is why this was invisible for a year
  and then appeared overnight. On the legacy `/bty-arena` page `.bty-arena-area` sets
  `color: var(--arena-text)` = #2D2A36, so the text inherited DARK and looked correct. Inside
  `BtyDailyAppShell` the root is `bg-[#0B1F3A] text-white`, so the very same class inherited WHITE —
  white prose on the cream practice surface. The Founder found it on the completion screen; the
  measurement then found it on three more elements with the identical cause.

  It is also why R4-R5A's contrast table was wrong about these four: it computed navy-at-alpha
  against cream, and no navy was ever being painted. The opaque tokens next door
  (`text-bty-navy` on the title and choices, `bg-bty-navy` on Done) always compiled, which is
  exactly the set the Founder reported as already readable.

  The hex IS `--bty-brand-navy`, asserted against globals.css in the regression test so it cannot
  drift, and arbitrary-hex-with-alpha is the established idiom on this shell (`text-[#E5B769]`,
  `bg-[#C9A66B]`). Alphas are preserved where they already cleared AA on cream and raised to the
  measured minimum (/65 = 4.95:1) where they did not — /50 was 3.15:1 and /60 was 4.22:1.
  Styling only: no phase logic, no copy, no layout, no state.
*/
function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B1F3A]/65">{children}</h3>;
}

/**
 * Restore the phase + selected primary from a stored path (Slice 3.2I). A path whose
 * primary no longer exists in the scenario is treated as corrupt → safe restart at the
 * opening (never guess another branch).
 */
function restoreFrom(scenario: ArenaScenarioDraft, path: SelectedPath | null | undefined): { phase: Phase; primaryId: string | null } {
  if (!path) return { phase: "opening", primaryId: null };
  const known = scenario.primary.choices.some((c) => c.id === path.primaryChoiceId);
  const branchOk = !isBranchAware(scenario) || !!scenario.branches[path.primaryChoiceId];
  if (!known || !branchOk) return { phase: "opening", primaryId: null };
  if (path.actionChoiceId) return { phase: "complete", primaryId: path.primaryChoiceId };
  if (path.tradeoffChoiceId) return { phase: "action", primaryId: path.primaryChoiceId };
  return { phase: "tradeoff", primaryId: path.primaryChoiceId };
}

export function ArenaPracticePlayer({
  scenario,
  locale,
  mode,
  sourceTrainingTitle,
  initialPath,
  onExit,
  onComplete,
  onPath,
}: {
  scenario: ArenaScenarioDraft;
  locale: string;
  mode: "test" | "play";
  sourceTrainingTitle?: string;
  /** Play mode — the run's stored decision path, to restore the branch after reload. */
  initialPath?: SelectedPath | null;
  onExit: () => void;
  onComplete?: () => void;
  /** Play mode — persist each cumulative decision-path write (server-authoritative). */
  onPath?: (input: PathInput) => void;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const restored = restoreFrom(scenario, initialPath);
  const [phase, setPhase] = useState<Phase>(restored.phase);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(restored.primaryId);
  const [selectedTradeoffId, setSelectedTradeoffId] = useState<string | null>(
    restored.primaryId ? (initialPath?.tradeoffChoiceId ?? null) : null,
  );
  const completedRef = useRef(false);

  // The continuation the learner is actually walking: a branch-aware scenario resolves
  // branches[selectedPrimaryId]; a legacy flat scenario uses the shared continuation.
  const active = (() => {
    if (isBranchAware(scenario) && selectedPrimaryId && scenario.branches[selectedPrimaryId]) {
      const b = scenario.branches[selectedPrimaryId];
      /*
        THE FOURTH FIELD (Arena Consequence Loop V1). `ScenarioBranch` has always carried the
        world the learner's choice produced, and this projection destructured three of its four
        properties — so the consequence was generated, stored, reviewed by the Host, and never
        shown to the person who caused it. A learner chose "delay the calls" and read "the client
        becomes increasingly frustrated" with nothing on screen joining the two.

        A legacy flat scenario has no branch and therefore no consequence; it keeps `undefined`
        and the surface below simply does not render.
      */
      return {
        resultingWorldState: b.resultingWorldState,
        escalationText: b.escalationText,
        tradeoffChoices: b.tradeoffChoices,
        actionDecision: b.actionDecision,
      };
    }
    return {
      resultingWorldState: undefined as string | undefined,
      escalationText: scenario.tradeoff.escalationText,
      tradeoffChoices: scenario.tradeoff.choices,
      actionDecision: scenario.actionDecision,
    };
  })();

  // Every write sends the FULL cumulative path so far (the server merge is monotonic).
  const writePath = useCallback(
    (path: PathInput) => {
      if (mode !== "play" || !onPath || !path.primaryChoiceId) return;
      onPath(path);
    },
    [mode, onPath],
  );

  const onPrimary = useCallback(
    (choice: ScenarioDraftChoice) => {
      setSelectedPrimaryId(choice.id);
      setSelectedTradeoffId(null);
      writePath({ primaryChoiceId: choice.id });
      setPhase("tradeoff");
    },
    [writePath],
  );

  const onTradeoff = useCallback(
    (choice: ScenarioDraftChoice) => {
      setSelectedTradeoffId(choice.id);
      if (selectedPrimaryId) writePath({ primaryChoiceId: selectedPrimaryId, tradeoffChoiceId: choice.id });
      setPhase("action");
    },
    [writePath, selectedPrimaryId],
  );

  const goComplete = useCallback(
    (actionChoiceId?: string) => {
      // Persist the full path (primary + tradeoff + action) BEFORE marking complete.
      if (selectedPrimaryId && selectedTradeoffId) {
        writePath({ primaryChoiceId: selectedPrimaryId, tradeoffChoiceId: selectedTradeoffId, actionChoiceId });
      }
      setPhase("complete");
      if (mode === "play" && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    },
    [mode, onComplete, writePath, selectedPrimaryId, selectedTradeoffId],
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-1 pb-8">
      {mode === "test" ? (
        <p className="rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
          {t.testBanner}
        </p>
      ) : null}
      {sourceTrainingTitle ? (
        <p className="text-xs text-[#0B1F3A]/65">
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
            <ChoiceCard key={c.id} label={c.label} onSelect={() => onPrimary(c)} />
          ))}
        </div>
      ) : null}

      {phase === "tradeoff" ? (
        <div className="flex flex-col gap-3">
          {/*
            WHAT CHANGED, THEN WHAT HAPPENS NEXT. Two existing SectionHeadings and two paragraphs —
            no new visual grammar, no card, no modal, and no sentence explaining the connection.
            The consequence is written in the second person and past tense, so "Because you chose
            X…" would only narrate what the reader just did. Nothing here ranks the choice: Arena
            has no correct answer, and Slice 2.4A.4 removed the one marker that leaked a preferred
            option.
          */}
          {(active.resultingWorldState ?? "").trim() ? (
            <>
              <SectionHeading>{t.whatHappened}</SectionHeading>
              <p
                data-testid="practice-consequence"
                className="whitespace-pre-wrap text-[0.98rem] leading-7 text-[#0B1F3A]/90"
              >
                {active.resultingWorldState}
              </p>
            </>
          ) : null}
          <SectionHeading>{t.itGetsHarder}</SectionHeading>
          <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-[#0B1F3A]/90">
            {active.escalationText}
          </p>
          <div className="mt-1 flex flex-col gap-2.5">
            {active.tradeoffChoices.map((c) => (
              <ChoiceCard key={c.id} label={c.label} onSelect={() => onTradeoff(c)} />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "action" ? (
        <div className="flex flex-col gap-3">
          <SectionHeading>{t.decide}</SectionHeading>
          <p className="text-[0.98rem] leading-7 text-bty-navy">{active.actionDecision.prompt}</p>
          <div className="mt-1 flex flex-col gap-2.5">
            {active.actionDecision.choices.map((c) => (
              <ChoiceCard key={c.id} label={c.label} onSelect={() => goComplete(c.id)} />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "complete" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <h2 className="text-xl font-semibold text-bty-navy">{t.completeTitle}</h2>
          <p className="max-w-sm text-sm leading-6 text-[#0B1F3A]/70">{t.completeBody}</p>
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
