"use client";

import React from "react";
import type { SecondChoice } from "@/lib/bty/scenario/types";

export type EliteForcedTradeoffStepProps = {
  /** Only `second_choices` from `escalationBranches[primaryChoiceId]` — no reinforcement row, no scenario context. */
  secondChoices: SecondChoice[];
  costLabel: string;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  headerLabel: string;
  onChoice: (id: string) => void;
  choiceDisabled?: boolean;
};

/**
 * Step 4 — Forced trade-off: options are decisions under **explicit cost** (v2 `second_choices` only).
 * `cost` is required; parent must validate before render — otherwise this throws in development.
 */
export function EliteForcedTradeoffStep({
  secondChoices,
  costLabel,
  difficultyLevel,
  headerLabel,
  onChoice,
  choiceDisabled = false,
}: EliteForcedTradeoffStepProps) {
  const [lockedId, setLockedId] = React.useState<string | null>(null);
  const tierAlpha = 0.04 + (difficultyLevel - 1) * 0.02;

  if (
    secondChoices.some((c) => typeof c.cost !== "string" || c.cost.trim() === "")
  ) {
    const msg = "invalid_second_choice_cost";
    console.error("[arena][EliteForcedTradeoffStep]", msg, { secondChoices });
    if (process.env.NODE_ENV !== "production") {
      throw new Error(msg);
    }
  }

  const handlePick = async (id: string) => {
    if (choiceDisabled || lockedId != null) return;
    setLockedId(id);
    try {
      await Promise.resolve(onChoice(id));
    } catch {
      setLockedId(null);
    }
  };

  return (
    <div
      data-testid="elite-forced-tradeoff-step"
      className="mt-4 space-y-4 border-t border-bty-border/60 pt-4"
      role="region"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bty-navy">{headerLabel}</p>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-1">
        {secondChoices.map((c) => {
          const isSelected = lockedId === c.id;
          const isDimmed = lockedId != null && !isSelected;
          return (
            <li key={c.id}>
              <button
                type="button"
                data-testid={`elite-forced-tradeoff-${c.id}`}
                onClick={() => handlePick(c.id)}
                disabled={choiceDisabled || (lockedId != null && !isSelected)}
                className={[
                  "w-full rounded-2xl border-2 px-4 py-4 text-left transition-[opacity,box-shadow] duration-200",
                  "border-bty-navy/35 bg-bty-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bty-navy/40",
                  "hover:border-bty-navy/55",
                  isDimmed ? "opacity-45" : "opacity-100",
                  isSelected ? "ring-2 ring-bty-navy/40" : "",
                ].join(" ")}
                style={{ backgroundColor: `rgb(255 255 255 / ${1 - tierAlpha * 0.25})` }}
              >
                <span className="block text-base font-semibold leading-snug text-bty-navy">{c.label}</span>
                <span className="mt-3 block text-[11px] font-bold uppercase tracking-[0.14em] text-bty-navy">
                  {costLabel}
                </span>
                <span className="mt-1 block text-sm font-semibold leading-relaxed text-bty-navy">{c.cost}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
