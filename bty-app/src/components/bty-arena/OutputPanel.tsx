"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import { ResultBlock, type SystemMsg } from "./ResultBlock";
import { ReflectionBlock } from "./ReflectionBlock";
import { FollowUpBlock } from "./FollowUpBlock";
import { ConsolidationBlock } from "./ConsolidationBlock";
import { CompleteBlock } from "./CompleteBlock";

export type OutputPanelProps = {
  step: 3 | 4 | 5 | 6 | 7;
  choice: ScenarioChoice;
  systemMessage: SystemMsg | null;
  lastXp: number;
  reflectionOptions: string[];
  followUpPrompt: string;
  followUpOptions: string[];
  hasFollowUp: boolean;
  followUpIndex: number | null;
  onNextToReflection: () => void;
  onSubmitReflection: (index: number) => void;
  onSubmitFollowUp: (index: number) => void;
  onSkipFollowUp: () => void;
  onComplete: () => void;
  onContinue: () => void;
};

export function OutputPanel({
  step,
  choice,
  systemMessage,
  lastXp,
  reflectionOptions,
  followUpPrompt,
  followUpOptions,
  hasFollowUp,
  followUpIndex,
  onNextToReflection,
  onSubmitReflection,
  onSubmitFollowUp,
  onSkipFollowUp,
  onComplete,
  onContinue,
}: OutputPanelProps) {
  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 16 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SYSTEM OUTPUT</div>

      {step === 3 && (
        <ResultBlock
          systemMessage={systemMessage}
          lastXp={lastXp}
          microInsight={choice.microInsight}
          result={choice.result}
          onNext={onNextToReflection}
        />
      )}

      {step === 4 && (
        <ReflectionBlock options={reflectionOptions} onSubmit={onSubmitReflection} />
      )}

      {step === 5 && hasFollowUp && choice.followUp && (
        <FollowUpBlock
          prompt={followUpPrompt}
          options={followUpOptions}
          onSubmit={onSubmitFollowUp}
          onSkip={onSkipFollowUp}
        />
      )}

      {step === 5 && !hasFollowUp && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={onSkipFollowUp}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #999",
              background: "white",
              color: "#555",
              cursor: "pointer",
            }}
          >
            보완 선택 건너뛰고 Continue
          </button>
        </div>
      )}

      {step === 6 && (
        <ConsolidationBlock
          choiceId={choice.choiceId}
          intent={choice.intent}
          microInsight={choice.microInsight}
          onComplete={onComplete}
        />
      )}

      {step === 7 && (
        <CompleteBlock
          followUpSelectedLabel={
            hasFollowUp && typeof followUpIndex === "number" ? followUpOptions[followUpIndex] ?? null : null
          }
          onContinue={onContinue}
        />
      )}
    </div>
  );
}
