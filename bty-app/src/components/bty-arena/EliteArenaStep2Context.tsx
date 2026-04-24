"use client";

import React from "react";
import type { EliteScenarioSetup } from "@/lib/bty/scenario/types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type EliteArenaStep2ContextProps = {
  /** Localized scenario title (from session `displayTitle`). */
  title: string;
  /** Narrative body — server `scenario.context` via session `contextForUser` (locale-aware). */
  contextBody: string;
  eliteSetup?: EliteScenarioSetup | null;
  locale: Locale | string;
};

/**
 * Opening Elite step: title → optional role/pressure/tradeoff → (optional) narrative only when no structured setup.
 * When `eliteSetup` is present, `scenario.context` is usually the same story in prose — omit to avoid duplication.
 */
export function EliteArenaStep2Context({ title, contextBody, eliteSetup, locale }: EliteArenaStep2ContextProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const narrative = (contextBody ?? "").trim();
  const es = eliteSetup;
  const hasSetup =
    es != null &&
    [es.role ?? "", es.pressure ?? "", es.tradeoff ?? ""].some((x) => x.trim() !== "");
  const showNarrative = narrative !== "" && !hasSetup;

  return (
    <div data-testid="elite-step2-context" className="mb-4 space-y-4">
      <h2 className="m-0 text-xl font-semibold leading-snug text-bty-navy">{title}</h2>

      {hasSetup && es != null ? (
        <dl className="m-0 grid gap-3 rounded-2xl border border-bty-border/70 bg-bty-soft/50 p-4 text-sm">
          {es.role.trim() !== "" ? (
            <div>
              <dt className="m-0 text-[11px] font-semibold uppercase tracking-wide text-bty-navy/65">
                {t.eliteSetupRoleLabel}
              </dt>
              <dd className="m-0 mt-1 whitespace-pre-wrap leading-relaxed text-bty-navy">{es.role}</dd>
            </div>
          ) : null}
          {es.pressure.trim() !== "" ? (
            <div>
              <dt className="m-0 text-[11px] font-semibold uppercase tracking-wide text-bty-navy/65">
                {t.eliteSetupPressureLabel}
              </dt>
              <dd className="m-0 mt-1 whitespace-pre-wrap leading-relaxed text-bty-navy">{es.pressure}</dd>
            </div>
          ) : null}
          {es.tradeoff.trim() !== "" ? (
            <div>
              <dt className="m-0 text-[11px] font-semibold uppercase tracking-wide text-bty-navy/65">
                {t.eliteSetupTradeoffLabel}
              </dt>
              <dd className="m-0 mt-1 whitespace-pre-wrap leading-relaxed text-bty-navy">{es.tradeoff}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {showNarrative ? (
        <section className="rounded-2xl border border-bty-border/60 bg-white/90 p-4 shadow-sm">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-bty-navy/70">
            {t.eliteOpeningNarrativeLabel}
          </h3>
          <p className="mt-3 m-0 whitespace-pre-wrap text-base leading-relaxed text-bty-navy">{narrative}</p>
        </section>
      ) : null}
    </div>
  );
}
