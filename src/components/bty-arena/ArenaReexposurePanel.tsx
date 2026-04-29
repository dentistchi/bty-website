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
  onEnterScenario: (params?: { pendingOutcomeId?: string | null; scenarioId?: string | null }) => void | Promise<void>;
  enterLoading: boolean;
};

function parseScenarioIdFromOutcomeBody(rawBody: string | null | undefined): string | null {
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (!body.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(body) as { scenario_id?: unknown };
    return typeof parsed.scenario_id === "string" && parsed.scenario_id.trim() !== ""
      ? parsed.scenario_id.trim()
      : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function parseScenarioIdFromUnknownPayload(raw: unknown): string | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  return readString(rec.scenario_id ?? null);
}

function extractOutcomePendingId(outcome: unknown): string | null {
  const rec = asRecord(outcome);
  if (!rec) return null;
  return readString(rec.pendingOutcomeId ?? rec.pending_outcome_id ?? rec.id ?? null);
}

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
  const [outcomeLoading, setOutcomeLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setOutcomeLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/arena/session/delayed-outcomes?locale=${encodeURIComponent(locale)}`, {
          credentials: "include",
        });
        const json = (await r.json().catch(() => ({}))) as { ok?: boolean; outcomes?: DelayedOutcome[] };
        console.info("[BTY REEXPOSURE] delayed outcomes", json.outcomes ?? []);
        if (!cancelled && r.ok && json.ok && Array.isArray(json.outcomes) && json.outcomes.length > 0) {
          const selected =
            json.outcomes.find((o) => o.choiceTypeKey === "no_change_reexposure") ?? json.outcomes[0] ?? null;
          setOutcome(selected);
        }
      } catch {
        if (!cancelled) setOutcome(null);
      } finally {
        if (!cancelled) setOutcomeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const titleExtra = outcome != null ? (locale === "ko" ? outcome.titleKo : outcome.titleEn) : null;
  const outcomePendingId = extractOutcomePendingId(outcome);
  const resolvedPendingId =
    typeof pendingOutcomeId === "string" && pendingOutcomeId.trim() !== ""
      ? pendingOutcomeId.trim()
      : outcomePendingId;
  const outcomeScenarioId =
    parseScenarioIdFromOutcomeBody(outcome?.body ?? null) ??
    parseScenarioIdFromUnknownPayload(asRecord(outcome)?.validation_payload ?? null) ??
    readString(asRecord(outcome)?.scenarioId ?? null) ??
    readString(asRecord(outcome)?.scenario_id ?? null);
  const resolvedScenarioId =
    typeof reexposureScenarioId === "string" && reexposureScenarioId.trim() !== ""
      ? reexposureScenarioId.trim()
      : outcomeScenarioId;
  const canEnter = resolvedPendingId != null && resolvedScenarioId != null;
  const disabledReason = enterLoading || outcomeLoading
    ? "loading"
    : resolvedPendingId == null
      ? "missing_pending_outcome_id"
      : resolvedScenarioId == null
        ? "no_outcome_selected"
        : null;

  console.info("[BTY REEXPOSURE] panel resolved context", {
    snapshotPendingOutcomeId: pendingOutcomeId ?? null,
    outcomePendingOutcomeId: outcomePendingId,
    resolvedPendingOutcomeId: resolvedPendingId,
    snapshotScenarioId: reexposureScenarioId ?? null,
    outcomeScenarioId,
    resolvedScenarioId,
    canEnter,
  });

  const pendingAttr =
    resolvedPendingId ?? undefined;

  return (
    <div
      data-testid="arena-reexposure-panel"
      data-arena-pending-outcome-id={pendingAttr}
      className="rounded-3xl border border-bty-border/80 bg-bty-surface/95 p-6 shadow-sm ring-1 ring-bty-border/40"
      role="region"
      aria-label={t.arenaReexposurePanelTitle}
    >
      <h2 className="m-0 text-lg font-semibold text-bty-navy">{t.arenaReexposurePanelTitle}</h2>
      <p className="mt-2 m-0 text-sm leading-relaxed text-bty-navy/85">{t.arenaReexposurePanelDescription}</p>
      {titleExtra ? (
        <p className="mt-3 m-0 text-sm leading-relaxed text-bty-secondary">{titleExtra}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canEnter || enterLoading}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onEnterScenario({
              pendingOutcomeId: resolvedPendingId,
              scenarioId: resolvedScenarioId,
            });
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--arena-accent, #5b8fa8)" }}
        >
          {enterLoading ? "…" : t.arenaReexposurePanelBeginButton}
        </button>
      </div>
      {!canEnter ? (
        <p className="mt-3 m-0 text-xs text-bty-secondary">{t.arenaSnapshotReexposurePlaceholder}</p>
      ) : null}
      {disabledReason ? (
        <p data-testid="reexposure-disabled-reason" className="mt-2 m-0 text-xs text-bty-secondary">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
