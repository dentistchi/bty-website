"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type PrimaryActionsProps = {
  locale: Locale | string;
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
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="bty-btn-primary"
        aria-label={t.confirm}
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
        {t.confirm}
      </button>

      {showContinue !== false && (
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          className="bty-btn-outline"
          aria-label={t.nextScenario}
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
          {t.nextScenario}
        </button>
      )}
    </div>
  );
}
