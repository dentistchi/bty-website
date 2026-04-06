"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ChoiceListProps = {
  locale: Locale | string;
  choices: ScenarioChoice[];
  selectedChoiceId: string | null;
  onSelect: (choiceId: string) => void;
  /** When true, hide internal intent slug (canonical elite / cleaner labels). */
  hideIntentSlug?: boolean;
};

export function ChoiceList({
  locale,
  choices,
  selectedChoiceId,
  onSelect,
  hideIntentSlug = false,
}: ChoiceListProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const isKo = lang === "ko";
  return (
    <div
      style={{ marginTop: 16, display: "grid", gap: 10 }}
      role="group"
      aria-label={isKo ? "시나리오 선택" : "Scenario choices"}
    >
      {choices.map((c) => {
        const active = selectedChoiceId === c.choiceId;
        const disabled = false;
        const displayLabel = isKo && c.labelKo ? c.labelKo : c.label;
        return (
          <button
            key={c.choiceId}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c.choiceId)}
            aria-label={displayLabel}
            style={{
              textAlign: "left",
              padding: 14,
              borderRadius: 14,
              border: active ? "2px solid #111" : "1px solid #e5e5e5",
              background: active ? "rgba(0,0,0,0.03)" : "white",
              opacity: disabled && !active ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              {hideIntentSlug ? (
                <>
                  {t.choiceLabel} {c.choiceId}
                </>
              ) : (
                <>
                  {t.choiceLabel} {c.choiceId} · {c.intent}
                </>
              )}
            </div>
            <div style={{ fontSize: 15 }}>{displayLabel}</div>
            {c.choiceSubtext != null && c.choiceSubtext.trim() !== "" ? (
              <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.45, opacity: 0.82 }}>{c.choiceSubtext}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
