"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { EliteScenarioSetup } from "@/lib/bty/scenario/types";

export type EliteArenaSetupProps = {
  locale: Locale | string;
  title: string;
  setup: EliteScenarioSetup;
};

/**
 * Canonical elite scenario setup: role / pressure / tradeoff only.
 * Internal JSON fields (tension axis, action contract, AIR, patterns) stay out of this surface.
 */
export function EliteArenaSetup({ locale, title, setup }: EliteArenaSetupProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  return (
    <div data-testid="elite-arena-setup" className="elite-arena-setup space-y-4">
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>
      <p className="text-sm opacity-80">{t.eliteInitialDecisionHint}</p>

      <section aria-labelledby="elite-setup-role">
        <h3 id="elite-setup-role" className="mb-1 text-sm font-semibold opacity-90">
          {t.eliteSetupRoleLabel}
        </h3>
        <p style={{ margin: 0, lineHeight: 1.65, opacity: 0.92 }}>{setup.role}</p>
      </section>

      <section aria-labelledby="elite-setup-pressure">
        <h3 id="elite-setup-pressure" className="mb-1 text-sm font-semibold opacity-90">
          {t.eliteSetupPressureLabel}
        </h3>
        <p style={{ margin: 0, lineHeight: 1.65, opacity: 0.92 }}>{setup.pressure}</p>
      </section>

      <section aria-labelledby="elite-setup-tradeoff">
        <h3 id="elite-setup-tradeoff" className="mb-1 text-sm font-semibold opacity-90">
          {t.eliteSetupTradeoffLabel}
        </h3>
        <p style={{ margin: 0, lineHeight: 1.65, opacity: 0.92 }}>{setup.tradeoff}</p>
      </section>
    </div>
  );
}
