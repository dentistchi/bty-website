"use client";

/**
 * Active scenario card: title + description, selectable choices, locale KO/EN toggle
 * (same id via {@link getScenarioById}), pattern narrative banner fed from {@link buildArenaContext}
 * results passed in by the parent.
 */

import React from "react";
import type { ArenaMissionContentLocale, ArenaScenario, PrimaryChoice, ReinforcementChoice } from "@/domain/arena/scenarios";
import { getScenarioById } from "@/domain/arena/scenarios";
import { PatternNarrativeBanner } from "@/components/arena/PatternNarrativeBanner";
import { getContextForUser } from "@/lib/bty/scenario/engine";
import type { Scenario as CatalogScenario } from "@/lib/bty/scenario/types";

/** Matches `arena_events.event_type` and engine constants. */
export const CHOICE_CONFIRMED_EVENT = "CHOICE_CONFIRMED" as const;

export type ChoiceConfirmedDetail = {
  scenarioId: string;
  choiceId: string;
  flag_type: string | null;
  scenario_type: string;
};

export type ScenarioCardProps = {
  /** Active scenario id — same id is refetched in the opposite locale via getScenarioById (domain). */
  scenarioId: string;
  /**
   * When set (e.g. from {@link selectNextScenario}), renders lib catalog copy + `choices[]`.
   * Domain `getScenarioById` is not used for body/title in this mode.
   */
  catalogScenario?: CatalogScenario;
  /** Hide KO/EN row when the parent shell owns locale + persistence. */
  showLocaleToggle?: boolean;
  /** Initial content locale; toggle switches and reloads scenario copy. */
  contentLocale?: ArenaMissionContentLocale;
  /**
   * From {@link buildArenaContext} `patternNarrative` — pass from parent after server injection.
   * Displayed in {@link PatternNarrativeBanner} above the card.
   */
  patternNarrative?: string;
  /** Pattern banner — scenario tag line (e.g. le_activation scenario_type). */
  scenarioType?: string | null;
  /** Pattern banner — previous AIR / activation flag. */
  previousFlagType?: string | null;
  /**
   * Sent as `scenario_type` on CHOICE_CONFIRMED. Defaults to loaded scenario `caseTag` when omitted.
   */
  scenarioTypeForEvent?: string;
  /** Sent as `flag_type` on CHOICE_CONFIRMED. */
  flagType?: string | null;
  /** Which list is exposed as selectable `choices[]` (primary = A/B/C, reinforcement = X/Y). */
  choiceList?: "primary" | "reinforcement";
  className?: string;
  onChoiceConfirmed?: (detail: ChoiceConfirmedDetail) => void;
};

function choicesFromScenario(
  scenario: ArenaScenario,
  choiceList: "primary" | "reinforcement",
): (PrimaryChoice | ReinforcementChoice)[] {
  return choiceList === "primary" ? scenario.primaryChoices : scenario.reinforcementChoices;
}

export function ScenarioCard({
  scenarioId,
  catalogScenario,
  showLocaleToggle = true,
  contentLocale: initialLocale = "en",
  patternNarrative = "",
  scenarioType = null,
  previousFlagType = null,
  scenarioTypeForEvent,
  flagType = null,
  choiceList = "primary",
  className,
  onChoiceConfirmed,
}: ScenarioCardProps) {
  const [contentLocale, setContentLocale] = React.useState<ArenaMissionContentLocale>(initialLocale);

  React.useEffect(() => {
    setContentLocale(initialLocale);
  }, [initialLocale]);

  const scenario = React.useMemo(
    () => (catalogScenario ? null : getScenarioById(scenarioId, contentLocale)),
    [catalogScenario, scenarioId, contentLocale],
  );

  const domainChoices = React.useMemo(
    () => (scenario ? choicesFromScenario(scenario, choiceList) : []),
    [scenario, choiceList],
  );

  const emitChoice = React.useCallback(
    (choiceId: string) => {
      if (catalogScenario) {
        const scenario_type =
          typeof scenarioTypeForEvent === "string" && scenarioTypeForEvent.trim() !== ""
            ? scenarioTypeForEvent.trim()
            : catalogScenario.scenarioId;
        const ft =
          flagType ??
          (catalogScenario.coachNotes?.whatThisTrains?.[0] != null
            ? String(catalogScenario.coachNotes.whatThisTrains[0])
            : null);
        const detail: ChoiceConfirmedDetail = {
          scenarioId: catalogScenario.scenarioId,
          choiceId,
          flag_type: ft,
          scenario_type,
        };
        onChoiceConfirmed?.(detail);
        window.dispatchEvent(new CustomEvent(CHOICE_CONFIRMED_EVENT, { detail }));
        return;
      }
      if (!scenario) return;
      const scenario_type =
        typeof scenarioTypeForEvent === "string" && scenarioTypeForEvent.trim() !== ""
          ? scenarioTypeForEvent.trim()
          : scenario.caseTag.trim();
      const detail: ChoiceConfirmedDetail = {
        scenarioId: scenario.id,
        choiceId,
        flag_type: flagType ?? null,
        scenario_type,
      };
      onChoiceConfirmed?.(detail);
      window.dispatchEvent(new CustomEvent(CHOICE_CONFIRMED_EVENT, { detail }));
    },
    [catalogScenario, scenario, scenarioTypeForEvent, flagType, onChoiceConfirmed],
  );

  const narrativeForBanner = typeof patternNarrative === "string" ? patternNarrative.trim() : "";
  const confirmLabel = contentLocale === "ko" ? "확인" : "OK";

  const catalogTitle =
    catalogScenario &&
    (contentLocale === "ko" && catalogScenario.titleKo ? catalogScenario.titleKo : catalogScenario.title);

  const catalogBody =
    catalogScenario &&
    (contentLocale === "ko" && catalogScenario.contextKo
      ? catalogScenario.contextKo
      : getContextForUser(catalogScenario.context));

  return (
    <div className={className}>
      <PatternNarrativeBanner
        patternNarrativeKo={narrativeForBanner}
        scenarioType={scenarioType}
        previousFlagType={previousFlagType}
        confirmLabel={confirmLabel}
      />

      <div
        className="mt-4 rounded-2xl border border-[var(--arena-text-soft,#94a3b8)]/25 bg-[var(--arena-card,#faf8f5)] p-4 shadow-sm"
        role="region"
        aria-label={contentLocale === "ko" ? "활성 시나리오" : "Active scenario"}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arena-text-soft)]/20 pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--arena-accent,#0ea5e9)]">
            {contentLocale === "ko" ? "시나리오" : "Scenario"}
          </span>
          {showLocaleToggle ? (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--arena-text-soft)]/30 p-0.5">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  contentLocale === "ko"
                    ? "bg-[var(--arena-accent)]/15 text-[var(--arena-accent)]"
                    : "text-[var(--arena-text-soft,#64748b)]"
                }`}
                onClick={() => setContentLocale("ko")}
                aria-pressed={contentLocale === "ko"}
              >
                KO
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  contentLocale === "en"
                    ? "bg-[var(--arena-accent)]/15 text-[var(--arena-accent)]"
                    : "text-[var(--arena-text-soft,#64748b)]"
                }`}
                onClick={() => setContentLocale("en")}
                aria-pressed={contentLocale === "en"}
              >
                EN
              </button>
            </div>
          ) : null}
        </div>

        {catalogScenario && catalogTitle != null && catalogBody != null ? (
          <>
            <h2 className="mt-3 text-lg font-semibold text-[var(--arena-text,#1e2a38)]">{catalogTitle}</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--arena-text,#1e2a38)]">
              {catalogBody.split(/\n+/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="m-0">
                    {line}
                  </p>
                ))}
            </div>
            <div className="mt-4 border-t border-[var(--arena-text-soft)]/20 pt-3">
              <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--arena-text-soft)]">
                {contentLocale === "ko" ? "선택" : "Choices"}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0" role="list">
                {catalogScenario.choices.map((c) => {
                  const label =
                    contentLocale === "ko" && c.labelKo ? c.labelKo : c.label;
                  return (
                    <li key={c.choiceId}>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-[var(--arena-text-soft)]/25 bg-[var(--arena-bg,#fff)] px-4 py-3 text-left text-sm text-[var(--arena-text)] shadow-sm transition hover:border-[var(--arena-accent)]/40 hover:shadow-md"
                        onClick={() => emitChoice(c.choiceId)}
                      >
                        <span className="mr-2 font-bold text-[var(--arena-accent)]">{label}</span>
                        <span className="font-medium">{c.intent}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : !scenario ? (
          <p className="mt-3 text-sm text-[var(--arena-text-soft)]">
            {contentLocale === "ko"
              ? "시나리오를 찾을 수 없습니다."
              : "Scenario not found for this id/locale."}
          </p>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-semibold text-[var(--arena-text,#1e2a38)]">{scenario.title}</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--arena-text,#1e2a38)]">
              {scenario.description.map((line) => (
                <p key={line} className="m-0">
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-4 border-t border-[var(--arena-text-soft)]/20 pt-3">
              <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--arena-text-soft)]">
                {choiceList === "primary"
                  ? contentLocale === "ko"
                    ? "선택"
                    : "Choices"
                  : contentLocale === "ko"
                    ? "보강 선택"
                    : "Reinforcement"}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0" role="list">
                {domainChoices.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-[var(--arena-text-soft)]/25 bg-[var(--arena-bg,#fff)] px-4 py-3 text-left text-sm text-[var(--arena-text)] shadow-sm transition hover:border-[var(--arena-accent)]/40 hover:shadow-md"
                      onClick={() => emitChoice(c.id)}
                    >
                      <span className="mr-2 font-bold text-[var(--arena-accent)]">{c.label}</span>
                      <span className="font-medium">{c.title}</span>
                      {"subtitle" in c && c.subtitle ? (
                        <span className="mt-1 block text-xs text-[var(--arena-text-soft)]">{c.subtitle}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
