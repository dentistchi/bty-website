"use client";

import React from "react";

const CONFIRM_LABEL = { en: "Confirm", ko: "확인" };
const NEXT_SCENARIO_LABEL = { en: "Next scenario", ko: "다음 시나리오" };

export type PrimaryActionsProps = {
  locale: string;
  confirmDisabled: boolean;
  continueDisabled: boolean;
  onConfirm: () => Promise<void> | void;
  onContinue: () => Promise<void> | void;
  /** When false, Next scenario button is not rendered (e.g. during CHOOSING). Default true. */
  showContinue?: boolean;
};

export function PrimaryActions({
  locale,
  confirmDisabled,
  continueDisabled,
  onConfirm,
  onContinue,
  showContinue = true,
}: PrimaryActionsProps) {
  const isKo = locale === "ko";
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="bty-btn-primary"
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "none",
          background: "var(--arena-accent)",
          color: "white",
          opacity: confirmDisabled ? 0.5 : 1,
          cursor: confirmDisabled ? "not-allowed" : "pointer",
        }}
      >
        {isKo ? CONFIRM_LABEL.ko : CONFIRM_LABEL.en}
      </button>

      {showContinue !== false && (
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          className="bty-btn-outline"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--arena-text-soft)",
            background: "var(--arena-card)",
            color: "var(--arena-text)",
            opacity: continueDisabled ? 0.5 : 1,
            cursor: continueDisabled ? "not-allowed" : "pointer",
          }}
        >
          {isKo ? NEXT_SCENARIO_LABEL.ko : NEXT_SCENARIO_LABEL.en}
        </button>
      )}
    </div>
  );
}
