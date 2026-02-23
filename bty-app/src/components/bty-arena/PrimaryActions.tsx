"use client";

import React from "react";

export type PrimaryActionsProps = {
  confirmDisabled: boolean;
  continueDisabled: boolean;
  onConfirm: () => void;
  onContinue: () => void;
  /** When false, Continue button is not rendered (e.g. during CHOOSING). Default true. */
  showContinue?: boolean;
};

export function PrimaryActions({
  confirmDisabled,
  continueDisabled,
  onConfirm,
  onContinue,
  showContinue = true,
}: PrimaryActionsProps) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "white",
          opacity: confirmDisabled ? 0.5 : 1,
          cursor: confirmDisabled ? "not-allowed" : "pointer",
        }}
      >
        Confirm
      </button>

      {showContinue && (
        <button
          onClick={onContinue}
          disabled={continueDisabled}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            opacity: continueDisabled ? 0.5 : 1,
            cursor: continueDisabled ? "not-allowed" : "pointer",
          }}
        >
          Continue
        </button>
      )}
    </div>
  );
}
