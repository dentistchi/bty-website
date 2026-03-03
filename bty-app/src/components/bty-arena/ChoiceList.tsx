"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";

export type ChoiceListProps = {
  locale: string;
  choices: ScenarioChoice[];
  selectedChoiceId: string | null;
  onSelect: (choiceId: string) => void;
};

export function ChoiceList({ locale, choices, selectedChoiceId, onSelect }: ChoiceListProps) {
  const isKo = locale === "ko";
  return (
    <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
      {choices.map((c) => {
        const active = selectedChoiceId === c.choiceId;
        const disabled = false;
        const displayLabel = isKo && c.labelKo ? c.labelKo : c.label;
        return (
          <button
            key={c.choiceId}
            disabled={disabled}
            onClick={() => onSelect(c.choiceId)}
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
              {isKo ? "선택" : "Choice"} {c.choiceId} · {c.intent}
            </div>
            <div style={{ fontSize: 15 }}>{displayLabel}</div>
          </button>
        );
      })}
    </div>
  );
}
