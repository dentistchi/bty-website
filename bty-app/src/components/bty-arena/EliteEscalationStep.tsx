"use client";

import React from "react";

export type EliteEscalationStepProps = {
  escalationText: string;
  /** 0.0–1.0 — subtle visual intensity only (not displayed as a number). */
  pressureIncrease: number;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  headerLabel: string;
  continueLabel: string;
  onContinue: () => void | Promise<void>;
  continueDisabled?: boolean;
};

/**
 * Step 3 — Escalation: situation update only; single Continue (UX_FLOW_LOCK_V1 §2).
 * No reference to the user’s prior choice; factual, present-tense copy comes from the server.
 */
export function EliteEscalationStep({
  escalationText,
  pressureIncrease,
  difficultyLevel,
  headerLabel,
  continueLabel,
  onContinue,
  continueDisabled = false,
}: EliteEscalationStepProps) {
  const p = Math.min(1, Math.max(0, pressureIncrease));
  const tierBoost = (difficultyLevel - 1) / 16;
  const borderAlpha = 0.22 + p * 0.38 + tierBoost;
  const bgAlpha = 0.06 + p * 0.12 + tierBoost * 0.5;

  const handleContinue = async () => {
    if (continueDisabled) return;
    try {
      await Promise.resolve(onContinue());
    } catch {
      /* Hook shows toast */
    }
  };

  return (
    <div
      data-testid="elite-escalation-step"
      className="mt-4 space-y-4 border-t border-bty-border/60 pt-4"
      role="region"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bty-navy/70">{headerLabel}</p>
      <div
        className="rounded-2xl border px-4 py-4 text-sm leading-relaxed text-bty-navy/95 shadow-sm transition-[border-color,background-color] duration-300"
        style={{
          borderColor: `rgb(15 23 42 / ${borderAlpha})`,
          backgroundColor: `rgb(15 23 42 / ${bgAlpha})`,
        }}
      >
        <p className="m-0 whitespace-pre-wrap">{escalationText}</p>
      </div>
      <button
        type="button"
        data-testid="elite-escalation-continue"
        onClick={() => void handleContinue()}
        disabled={continueDisabled}
        className="rounded-xl border border-bty-navy bg-bty-navy px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {continueLabel}
      </button>
    </div>
  );
}
