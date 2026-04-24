"use client";

import React from "react";
import type { DelayedOutcome } from "@/engine/scenario/delayed-outcome-trigger.service";
import type { Locale } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n";

export type ArenaReexposurePanelProps = {
  locale: Locale;
  /** From GET session `re_exposure.scenario_id` — required to load/play. */
  reexposureScenarioId: string | null | undefined;
  /** From GET session `re_exposure.pending_outcome_id` — carried through to `beginReexposurePlay` / validate (render-only marker). */
  pendingOutcomeId?: string | null;
  onEnterScenario: () => void | Promise<void>;
  enterLoading: boolean;
};

/**
 * Re-exposure surface — snapshot-first (`REEXPOSURE_DUE`). Optional delayed-outcome copy from GET delayed-outcomes.
 */
export function ArenaReexposurePanel({
  locale,
  reexposureScenarioId,
  pendingOutcomeId = null,
  onEnterScenario,
  enterLoading,
}: ArenaReexposurePanelProps) {
  const t = getMessages(locale).arenaRun;
  const [outcome, setOutcome] = React.useState<DelayedOutcome | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/arena/session/delayed-outcomes?locale=${encodeURIComponent(locale)}`, {
          credentials: "include",
        });
        const json = (await r.json().catch(() => ({}))) as { ok?: boolean; outcomes?: DelayedOutcome[] };
        if (!cancelled && r.ok && json.ok && Array.isArray(json.outcomes) && json.outcomes.length > 0) {
          setOutcome(json.outcomes[0]!);
        }
      } catch {
        if (!cancelled) setOutcome(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const titleExtra =
    outcome != null ? (locale === "ko" ? outcome.titleKo : outcome.titleEn) : null;
  const canEnter = typeof reexposureScenarioId === "string" && reexposureScenarioId.trim() !== "";

  const pendingAttr =
    typeof pendingOutcomeId === "string" && pendingOutcomeId.trim() !== "" ? pendingOutcomeId.trim() : undefined;

  return (
    <div
      data-testid="arena-reexposure-panel"
      data-arena-pending-outcome-id={pendingAttr}
      className="rounded-3xl border border-bty-border/80 bg-bty-surface/95 p-6 shadow-sm ring-1 ring-bty-border/40"
      role="region"
      aria-label={t.arenaReexposureTitle}
    >
      <h2 className="m-0 text-lg font-semibold text-bty-navy">{t.arenaReexposureTitle}</h2>
      <p className="mt-2 m-0 text-sm leading-relaxed text-bty-navy/85">{t.arenaReexposureLead}</p>
      {titleExtra ? (
        <p className="mt-3 m-0 text-sm leading-relaxed text-bty-secondary">{titleExtra}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canEnter || enterLoading}
          onClick={() => void onEnterScenario()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--arena-accent, #5b8fa8)" }}
        >
          {enterLoading ? "…" : t.arenaReexposureEnterCta}
        </button>
      </div>
      {!canEnter ? (
        <p className="mt-3 m-0 text-xs text-bty-secondary">{t.arenaSnapshotReexposurePlaceholder}</p>
      ) : null}
    </div>
  );
}
