"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import { ResultBlock, type SystemMsg } from "./ResultBlock";
import { ReflectionBlock } from "./ReflectionBlock";
import { FollowUpBlock } from "./FollowUpBlock";
import { ConsolidationBlock } from "./ConsolidationBlock";
import { CompleteBlock } from "./CompleteBlock";

import type { ReflectResult } from "./ConsolidationBlock";

export type OutputPanelProps = {
  locale: string;
  step: 3 | 4 | 5 | 6 | 7;
  choice: ScenarioChoice;
  systemMessage: SystemMsg | null;
  lastXp: number;
  reflectionBonusXp: number;
  /** Single takeaway prompt (one sentence per play). When set, Step 4 shows this + optional input + Next. */
  reflectionPrompt: string;
  reflectionOptions: string[];
  followUpPrompt: string;
  followUpOptions: string[];
  hasFollowUp: boolean;
  followUpIndex: number | null;
  /** Result from /api/arena/reflect; shown in ConsolidationBlock when present. */
  reflectResult?: ReflectResult | null;
  onNextToReflection: () => void;
  onSubmitReflection: (index: number, reflectionText?: string) => void;
  onSubmitFollowUp: (index: number) => void;
  onSkipFollowUp: () => void;
  onComplete: () => void;
  onContinue: () => void;
};

const SYSTEM_OUTPUT_LABEL = { en: "SYSTEM OUTPUT", ko: "시스템 출력" };
const REFLECTION_TITLE = { en: "Reflection", ko: "성찰" };
const SKIP_FOLLOW_UP_LABEL = { en: "Skip follow-up · Next scenario", ko: "따라하기 건너뛰기 · 다음 시나리오" };
const FOLLOW_UP_SELECTED_LABEL = { en: "FOLLOW-UP SELECTED", ko: "선택한 따라하기" };

export function OutputPanel({
  locale,
  step,
  choice,
  systemMessage,
  lastXp,
  reflectionBonusXp,
  reflectionPrompt,
  reflectionOptions,
  followUpPrompt,
  followUpOptions,
  hasFollowUp,
  followUpIndex,
  reflectResult = null,
  onNextToReflection,
  onSubmitReflection,
  onSubmitFollowUp,
  onSkipFollowUp,
  onComplete,
  onContinue,
}: OutputPanelProps) {
  const sysLabel = locale === "ko" ? SYSTEM_OUTPUT_LABEL.ko : SYSTEM_OUTPUT_LABEL.en;
  const skipLabel = locale === "ko" ? SKIP_FOLLOW_UP_LABEL.ko : SKIP_FOLLOW_UP_LABEL.en;
  const followUpSelected = locale === "ko" ? FOLLOW_UP_SELECTED_LABEL.ko : FOLLOW_UP_SELECTED_LABEL.en;

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 16 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{sysLabel}</div>

      {step === 3 && (
        <ResultBlock
          locale={locale}
          systemMessage={systemMessage}
          lastXp={lastXp}
          microInsight={choice.microInsight}
          result={choice.result}
          onNext={onNextToReflection}
        />
      )}

      {step === 4 && (
        <ReflectionBlock
          title={locale === "ko" ? REFLECTION_TITLE.ko : REFLECTION_TITLE.en}
          reflectionPrompt={reflectionPrompt}
          options={reflectionOptions}
          locale={locale}
          onSubmit={onSubmitReflection}
        />
      )}

      {step === 5 && hasFollowUp && choice.followUp && (
        <FollowUpBlock
          skipLabel={skipLabel}
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
            {skipLabel}
          </button>
        </div>
      )}

      {step === 6 && (
        <ConsolidationBlock
          locale={locale}
          choiceId={choice.choiceId}
          intent={choice.intent}
          microInsight={choice.microInsight}
          lastXp={lastXp}
          reflectionBonusXp={reflectionBonusXp}
          reflectResult={reflectResult}
          onComplete={onComplete}
        />
      )}

      {step === 7 && (
        <CompleteBlock
          locale={locale}
          followUpSelectedLabel={
            hasFollowUp && typeof followUpIndex === "number" ? followUpOptions[followUpIndex] ?? null : null
          }
          followUpSelectedSectionLabel={followUpSelected}
          onContinue={onContinue}
        />
      )}
    </div>
  );
}
