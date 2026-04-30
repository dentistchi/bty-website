"use client";

import React from "react";
import type { SecondChoice } from "@/lib/bty/scenario/types";

export type EliteForcedTradeoffStepProps = {
  /** Section label above worsened situation copy (i18n). */
  situationSectionTitle: string;
  /** One line from canonical `escalation_text` — worsened situation before second choices. */
  escalationLine?: string;
  /** Section label above the second-choice list (i18n). */
  decisionSectionTitle: string;
  /** Only `second_choices` from `escalationBranches[primaryChoiceId]`. */
  secondChoices: SecondChoice[];
  costLabel: string;
  /** Label for optional `protects` line (merged from JSON `stage_2_escalation`). */
  protectsLabel: string;
  /** Label for optional `risks` line. */
  risksLabel: string;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  onChoice: (id: string) => void;
  choiceDisabled?: boolean;
};

/**
 * Step 4 — Forced trade-off: options are decisions under **explicit cost** (v2 `second_choices` only).
 * `cost` is required; parent must validate before render — otherwise this throws in development.
 */
export function EliteForcedTradeoffStep({
  situationSectionTitle,
  escalationLine,
  decisionSectionTitle,
  secondChoices,
  costLabel,
  protectsLabel,
  risksLabel,
  difficultyLevel,
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

  const line = typeof escalationLine === "string" ? escalationLine.trim() : "";

  return (
    <div data-testid="elite-forced-tradeoff-step" className="mt-2 space-y-5" role="region">
      <div className="rounded-2xl border border-bty-border/80 bg-bty-soft/70 p-4 shadow-sm">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-bty-navy/75">
          {situationSectionTitle}
        </p>
        {line !== "" ? (
          <p className="mt-3 m-0 text-base leading-relaxed text-bty-navy whitespace-pre-wrap">{line}</p>
        ) : null}
      </div>

      <div>
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-bty-navy/75">{decisionSectionTitle}</p>
        <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-1">
        {secondChoices.map((c) => {
          const isSelected = lockedId === c.id;
          const isDimmed = lockedId != null && !isSelected;
          const protects = typeof c.protects === "string" ? c.protects.trim() : "";
          const risks = typeof c.risks === "string" ? c.risks.trim() : "";
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
                <div
                  className="mt-3 rounded-xl border-l-4 border-amber-500/90 bg-amber-50/80 px-3 py-2.5 shadow-inner"
                  data-testid={`elite-tradeoff-cost-block-${c.id}`}
                >
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-amber-950/80">
                    {costLabel}
                  </span>
                  <span
                    className="mt-1 block text-sm font-semibold leading-relaxed text-amber-950"
                    data-testid={`elite-tradeoff-cost-${c.id}`}
                  >
                    {c.cost}
                  </span>
                </div>
                {protects !== "" ? (
                  <div className="mt-3 rounded-lg border border-emerald-200/90 bg-emerald-50/70 px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-900/75">
                      {protectsLabel}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-emerald-950/90">{protects}</span>
                  </div>
                ) : null}
                {risks !== "" ? (
                  <div className="mt-2 rounded-lg border border-rose-200/90 bg-rose-50/70 px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-rose-900/75">
                      {risksLabel}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-rose-950/90">{risks}</span>
                  </div>
                ) : null}
              </button>
            </li>
          );
        })}
        </ul>
      </div>
    </div>
  );
}
