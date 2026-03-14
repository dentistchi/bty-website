"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import { ResultBlock, type SystemMsg } from "./ResultBlock";
import { ReflectionBlock } from "./ReflectionBlock";
import { FollowUpBlock } from "./FollowUpBlock";
import { ConsolidationBlock } from "./ConsolidationBlock";
import { CompleteBlock } from "./CompleteBlock";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { ReflectResult } from "./ConsolidationBlock";

export type OutputPanelProps = {
  locale: Locale | string;
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
  /** When true, ReflectionBlock shows loading skeleton (reflection submit in flight). */
  reflectionSubmitting?: boolean;
  onNextToReflection: () => void;
  onSubmitReflection: (index: number, reflectionText?: string) => void;
  onSubmitFollowUp: (index: number) => void;
  onSkipFollowUp: () => void;
  /** When true, FollowUpBlock shows loading skeleton (follow-up submit in flight). */
  followUpSubmitting?: boolean;
  onComplete: () => void;
  onContinue: () => void;
  /** When true, CompleteBlock shows loading skeleton (next scenario in flight). */
  continueLoading?: boolean;
};

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
  reflectionSubmitting = false,
  onNextToReflection,
  onSubmitReflection,
  onSubmitFollowUp,
  onSkipFollowUp,
  followUpSubmitting = false,
  onComplete,
  onContinue,
  continueLoading = false,
}: OutputPanelProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const sysLabel = t.systemOutput;
  const skipLabel = t.skipFollowUp;
  const followUpSelected = t.followUpSelected;
  const isKo = lang === "ko";
  const displayResult = isKo && choice.resultKo ? choice.resultKo : choice.result;
  const displayMicroInsight = isKo && choice.microInsightKo ? choice.microInsightKo : choice.microInsight;

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 16 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{sysLabel}</div>

      {step === 3 && (
        <ResultBlock
          locale={locale}
          systemMessage={systemMessage}
          lastXp={lastXp}
          microInsight={displayMicroInsight}
          result={displayResult}
          onNext={onNextToReflection}
        />
      )}

      {step === 4 && (
        <ReflectionBlock
          title={t.reflectionTitle}
          reflectionPrompt={reflectionPrompt}
          options={reflectionOptions}
          locale={locale}
          onSubmit={onSubmitReflection}
          submitting={reflectionSubmitting}
        />
      )}

      {step === 5 && hasFollowUp && choice.followUp && (
        <FollowUpBlock
          skipLabel={skipLabel}
          prompt={followUpPrompt}
          options={followUpOptions}
          onSubmit={onSubmitFollowUp}
          onSkip={onSkipFollowUp}
          loading={followUpSubmitting}
          loadingAriaLabel={lang === "ko" ? "따라하기 제출 중…" : "Submitting follow-up…"}
        />
      )}

      {step === 5 && !hasFollowUp && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={onSkipFollowUp}
            aria-label={skipLabel}
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
          microInsight={displayMicroInsight}
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
          loading={continueLoading}
        />
      )}
    </div>
  );
}
