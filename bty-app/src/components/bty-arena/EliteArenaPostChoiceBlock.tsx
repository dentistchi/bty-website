"use client";

import React from "react";
import type { Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { EliteForcedTradeoffStep } from "./EliteForcedTradeoffStep";
import { EliteArenaRunComplete } from "./EliteArenaRunComplete";
import { resolveEliteEscalationBranch } from "./eliteArenaPostChoiceResolve";
import type { ArenaPhase } from "@/components/bty-arena/ArenaHeader";

function RuntimeError({
  kind,
  title,
  body,
}: {
  kind: string;
  title: string;
  body: string;
}) {
  return (
    <div
      role="alert"
      data-testid={`elite-v2-runtime-error-${kind}`}
      className="mt-2 space-y-1 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-900"
    >
      <p className="m-0 font-semibold">{title}</p>
      <p className="m-0 leading-snug">{body}</p>
    </div>
  );
}

export type EliteArenaPostChoiceBlockProps = {
  locale: Locale | string;
  step: number;
  /** Retained for diagnostics / child APIs; do not use as primary UI authority (snapshot + segment drive surfaces). */
  phase: ArenaPhase;
  scenario: Scenario;
  /** From parent `playUiSegment === "run_complete"` — end-of-run primary control (not `phase === "DONE"`). */
  runCompletePrimary: boolean;
  choice: ScenarioChoice | null;
  /** For diagnostics when `choice` is null but phase/step imply a primary selection */
  selectedChoiceId?: string | null;
  onSecondChoice: (secondChoiceId: string) => void | Promise<void>;
  secondChoiceSubmitting?: boolean;
  onContinueNextScenario: () => void | Promise<void>;
  continueLoading?: boolean;
};

export function EliteArenaPostChoiceBlock({
  locale,
  step,
  phase,
  runCompletePrimary,
  scenario,
  choice,
  selectedChoiceId = null,
  onSecondChoice,
  secondChoiceSubmitting = false,
  onContinueNextScenario,
  continueLoading = false,
}: EliteArenaPostChoiceBlockProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  if (runCompletePrimary && (step === 6 || step === 5)) {
    return (
      <EliteArenaRunComplete locale={lang} onContinue={onContinueNextScenario} continueLoading={continueLoading} />
    );
  }

  if (step === 4 && phase === "FORCED_TRADEOFF" && !choice) {
    const availableChoiceIds = scenario.choices.map((c) => c.choiceId);
    console.error("[arena][elite-post-choice-invalid]", {
      scenarioId: scenario.scenarioId,
      step,
      phase,
      selectedChoiceId,
      availableChoiceIds,
    });
    return (
      <RuntimeError
        kind="invalid_primary_choice"
        title={t.eliteInvalidPrimaryChoiceTitle}
        body={t.eliteInvalidPrimaryChoiceBody}
      />
    );
  }

  if (!choice) return null;

  const v2 = resolveEliteEscalationBranch(scenario, choice);
  const difficultyLevel = (scenario.difficulty_level ?? 3) as 1 | 2 | 3 | 4 | 5;

  if (step === 4 && phase === "FORCED_TRADEOFF") {
    if (v2.kind !== "ok") {
      const err =
        v2.kind === "escalation_not_configured"
          ? { title: t.eliteV2ErrorNotConfiguredTitle, body: t.eliteV2ErrorNotConfiguredBody }
          : v2.kind === "missing_escalation_branch"
            ? { title: t.eliteV2ErrorMissingBranchTitle, body: t.eliteV2ErrorMissingBranchBody }
            : { title: t.eliteV2ErrorInvalidCostTitle, body: t.eliteV2ErrorInvalidCostBody };
      return <RuntimeError kind={v2.kind} title={err.title} body={err.body} />;
    }
    return (
      <EliteForcedTradeoffStep
        situationSectionTitle={t.eliteSituationUpdateHeader}
        escalationLine={v2.branch.escalation_text}
        decisionSectionTitle={t.eliteDecisionRequiredHeader}
        secondChoices={v2.branch.second_choices}
        difficultyLevel={difficultyLevel}
        costLabel={t.eliteForcedTradeoffCostLabel}
        protectsLabel={t.eliteTradeoffProtectsLabel}
        risksLabel={t.eliteTradeoffRisksLabel}
        onChoice={(id) => Promise.resolve(onSecondChoice(id))}
        choiceDisabled={secondChoiceSubmitting}
      />
    );
  }

  return null;
}
