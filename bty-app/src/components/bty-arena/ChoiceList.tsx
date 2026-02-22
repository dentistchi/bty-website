"use client";

import React from "react";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";

export type ChoiceListProps = {
  choices: ScenarioChoice[];
  selectedChoiceId: string | null;
  onSelect: (choiceId: string) => void;
};

export function ChoiceList({ choices, selectedChoiceId, onSelect }: ChoiceListProps) {
  return (
    <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
      {choices.map((c) => {
        const active = selectedChoiceId === c.choiceId;
        const disabled = false;
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
              Choice {c.choiceId} · {c.intent}
            </div>
            <div style={{ fontSize: 15 }}>{c.label}</div>
          </button>
        );
      })}
    </div>
  );
}
