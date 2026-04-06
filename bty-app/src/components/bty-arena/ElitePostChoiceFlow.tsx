"use client";

import React from "react";
import type { EliteScenarioSetup, Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import type { EscalationBranch } from "@/domain/arena/scenarios/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { EliteActionContractStep } from "./EliteActionContractStep";
import { EliteEscalationStep } from "./EliteEscalationStep";
import { EliteExecutionGateStep } from "./EliteExecutionGateStep";
import { EliteForcedTradeoffStep } from "./EliteForcedTradeoffStep";
import { ElitePatternMirrorStep } from "./ElitePatternMirrorStep";

function hasEscalationDataset(s: Scenario): boolean {
  const eb = s.escalationBranches;
  return Boolean(eb && typeof eb === "object" && !Array.isArray(eb) && Object.keys(eb).length > 0);
}

type V2Resolution =
  | { kind: "ok"; branch: EscalationBranch }
  | { kind: "escalation_not_configured" }
  | { kind: "missing_escalation_branch" }
  | { kind: "invalid_second_choice_cost" };

/**
 * Elite steps 3–4: **only** `escalationBranches[primaryChoiceId]` — no stance copy, no scenario `context`,
 * no synthetic escalation, no reinforcement row.
 */
function resolveEliteV2Escalation(scenario: Scenario, choice: ScenarioChoice): V2Resolution {
  if (!scenario.eliteSetup || !hasEscalationDataset(scenario)) {
    return { kind: "escalation_not_configured" };
  }
  const b = scenario.escalationBranches![choice.choiceId];
  if (!b?.escalation_text?.trim()) {
    return { kind: "missing_escalation_branch" };
  }
  if (!Array.isArray(b.second_choices) || b.second_choices.length === 0) {
    return { kind: "missing_escalation_branch" };
  }
  for (const sc of b.second_choices) {
    if (typeof sc.cost !== "string" || sc.cost.trim() === "") {
      return { kind: "invalid_second_choice_cost" };
    }
  }
  return { kind: "ok", branch: b };
}

export type ElitePostChoiceFlowProps = {
  locale: Locale | string;
  step: 3 | 4 | 5 | 6 | 7;
  choice: ScenarioChoice;
  scenario: Scenario;
  /** Canonical scenario id for POST /api/action-contracts */
  scenarioId: string;
  setup: EliteScenarioSetup;
  lastXp: number;
  reflectionSubmitting: boolean;
  runId: string | null;
  /** @deprecated Legacy stance path removed for v2 elite — optional for older callers */
  onStanceConfirmNext?: () => void;
  /** @deprecated Legacy explanation path removed for v2 elite */
  onSubmitStanceExplanation?: (text: string) => void;
  /** Steps 3–4 escalation path — POST `/api/arena/run/step` step 3, then advance local step */
  onEscalationContinue: () => void | Promise<void>;
  /** Steps 3–4 escalation path — POST step 4 with `secondChoiceId` */
  onSecondChoice: (secondChoiceId: string) => void | Promise<void>;
  escalationContinueLoading?: boolean;
  secondChoiceSubmitting?: boolean;
  onMirrorAcknowledged: () => void;
  onContractCommittedToGate: () => void;
  /** Step 6: `gated: "pattern_threshold"` — advance to execution gate without a draft */
  onPatternThresholdContinueToGate: () => void;
  /** Step 7: allow next scenario when user continued past contract due to pattern threshold */
  patternContractDeferred: boolean;
  onContinueNextScenario: () => void;
  continueLoading?: boolean;
};

function EliteV2RuntimeError({
  kind,
  title,
  body,
}: {
  kind: V2Resolution["kind"];
  title: string;
  body: string;
}) {
  return (
    <div
      role="alert"
      data-testid={`elite-v2-runtime-error-${kind}`}
      className="mt-4 space-y-2 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900"
    >
      <p className="m-0 font-semibold">{title}</p>
      <p className="m-0 leading-relaxed">{body}</p>
    </div>
  );
}

export function ElitePostChoiceFlow({
  locale,
  step,
  choice,
  scenario,
  scenarioId,
  setup: _setup,
  lastXp: _lastXp,
  reflectionSubmitting,
  runId,
  onEscalationContinue,
  onSecondChoice,
  escalationContinueLoading = false,
  secondChoiceSubmitting = false,
  onMirrorAcknowledged,
  onContractCommittedToGate,
  onPatternThresholdContinueToGate,
  patternContractDeferred,
  onContinueNextScenario,
  continueLoading = false,
}: ElitePostChoiceFlowProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  const v2 = React.useMemo(() => resolveEliteV2Escalation(scenario, choice), [scenario, choice]);

  React.useEffect(() => {
    if (!scenario.eliteSetup || step < 3 || step > 4) return;
    if (v2.kind !== "ok") {
      console.debug("[arena][elite-v2]", {
        scenarioId: scenario.scenarioId,
        primaryChoiceId: choice.choiceId,
        status: v2.kind,
      });
      return;
    }
    console.debug("[arena][elite-v2]", {
      scenarioId: scenario.scenarioId,
      primaryChoiceId: choice.choiceId,
      escalationBranchKey: choice.choiceId,
      secondChoicesCount: v2.branch.second_choices.length,
    });
  }, [scenario.scenarioId, scenario.eliteSetup, choice.choiceId, step, v2]);

  const difficultyLevel = (scenario.difficulty_level ?? 3) as 1 | 2 | 3 | 4 | 5;

  if (step === 3) {
    if (v2.kind !== "ok") {
      const err =
        v2.kind === "escalation_not_configured"
          ? { title: t.eliteV2ErrorNotConfiguredTitle, body: t.eliteV2ErrorNotConfiguredBody }
          : v2.kind === "missing_escalation_branch"
            ? { title: t.eliteV2ErrorMissingBranchTitle, body: t.eliteV2ErrorMissingBranchBody }
            : { title: t.eliteV2ErrorInvalidCostTitle, body: t.eliteV2ErrorInvalidCostBody };
      return (
        <div className="mt-4" role="region" aria-label={t.elitePostFlowRegionAria}>
          <EliteV2RuntimeError kind={v2.kind} title={err.title} body={err.body} />
        </div>
      );
    }
    return (
      <div className="mt-4" role="region" aria-label={t.elitePostFlowRegionAria}>
        <EliteEscalationStep
          escalationText={v2.branch.escalation_text}
          pressureIncrease={v2.branch.pressure_increase}
          difficultyLevel={difficultyLevel}
          headerLabel={t.eliteSituationUpdateHeader}
          continueLabel={t.eliteMirrorContinue}
          onContinue={async () => {
            await onEscalationContinue();
          }}
          continueDisabled={escalationContinueLoading}
        />
      </div>
    );
  }

  if (step === 4) {
    if (v2.kind !== "ok") {
      const err =
        v2.kind === "escalation_not_configured"
          ? { title: t.eliteV2ErrorNotConfiguredTitle, body: t.eliteV2ErrorNotConfiguredBody }
          : v2.kind === "missing_escalation_branch"
            ? { title: t.eliteV2ErrorMissingBranchTitle, body: t.eliteV2ErrorMissingBranchBody }
            : { title: t.eliteV2ErrorInvalidCostTitle, body: t.eliteV2ErrorInvalidCostBody };
      return (
        <div className="mt-4" role="region" aria-label={t.elitePostFlowRegionAria}>
          <EliteV2RuntimeError kind={v2.kind} title={err.title} body={err.body} />
        </div>
      );
    }
    return (
      <div className="mt-4" role="region" aria-label={t.elitePostFlowRegionAria}>
        <EliteForcedTradeoffStep
          secondChoices={v2.branch.second_choices}
          difficultyLevel={difficultyLevel}
          headerLabel={t.eliteDecisionRequiredHeader}
          costLabel={t.eliteForcedTradeoffCostLabel}
          onChoice={async (id) => {
            await onSecondChoice(id);
          }}
          choiceDisabled={secondChoiceSubmitting}
        />
      </div>
    );
  }

  if (step === 5) {
    return (
      <ElitePatternMirrorStep
        locale={lang}
        runId={runId}
        title={t.eliteMirrorTitle}
        lead={t.eliteMirrorLead}
        emptyMirror={t.eliteMirrorEmpty}
        continueLabel={t.eliteMirrorContinue}
        loadError={t.eliteMirrorLoadError}
        onAcknowledged={onMirrorAcknowledged}
      />
    );
  }

  if (step === 6) {
    return (
      <EliteActionContractStep
        runId={runId}
        scenarioId={scenarioId}
        primaryChoice={choice.choiceId}
        title={t.eliteContractTitle}
        intro={t.eliteContractIntro}
        labels={{
          who: t.eliteContractWhoLabel,
          whoHint: t.eliteContractWhoHint,
          what: t.eliteContractWhatLabel,
          whatHint: t.eliteContractWhatHint,
          when: t.eliteContractWhenLabel,
          whenHint: t.eliteContractWhenHint,
          how: t.eliteContractHowLabel,
          howInstruction: t.eliteContractHowInstruction,
          howResponsibilityLead: t.eliteContractHowResponsibilityLead,
        }}
        placeholders={{
          who: t.eliteContractWhoPlaceholder,
          what: t.eliteContractWhatPlaceholder,
          how: t.eliteContractHowPlaceholder,
          when: t.eliteContractWhenPlaceholder,
        }}
        submitLabel={t.eliteContractSubmit}
        submittingLabel={t.eliteContractSubmitting}
        loadError={t.eliteContractLoadError}
        ensureFailed={t.eliteContractEnsureFailed}
        creatingContractLabel={t.eliteContractCreating}
        initFailedTitle={t.eliteContractInitFailedTitle}
        patternThresholdTitle={t.eliteContractPatternThresholdTitle}
        patternThresholdBody={t.eliteContractPatternThresholdBody}
        patternThresholdContinueLabel={t.eliteContractPatternThresholdContinue}
        onPatternThresholdContinue={onPatternThresholdContinueToGate}
        revisionRequired={t.eliteContractRevisionRequired}
        onContractValidated={onContractCommittedToGate}
      />
    );
  }

  if (step === 7) {
    return (
      <EliteExecutionGateStep
        runId={runId}
        locale={lang}
        deferGateVerification={patternContractDeferred}
        patternThresholdDeferLine={t.eliteExecutionPatternThresholdDeferLine}
        title={t.eliteExecutionGateTitle}
        intro={t.eliteExecutionGateIntro}
        contractRecordHeading={t.eliteExecutionContractHeading}
        verificationRecorded={t.eliteExecutionVerificationRecorded}
        awaitingVerificationOutcome={t.eliteExecutionAwaitingVerification}
        verificationNotRecorded={t.eliteExecutionVerificationNotRecorded}
        underReview={t.eliteExecutionUnderReview}
        additionalConfirmation={t.eliteExecutionAdditionalConfirmation}
        executionAbandonedLead={t.eliteExecutionAbandonedLead}
        resumeVerificationHint={t.eliteExecutionResumeHint}
        rawTextFallback={t.eliteExecutionRawTextFallback}
        nextScenarioLabel={t.nextScenario}
        nextScenarioBlocked={t.eliteExecutionNextBlocked}
        loadError={t.eliteExecutionLoadError}
        onContinueNextScenario={onContinueNextScenario}
        continueLoading={continueLoading}
      />
    );
  }

  return null;
}
