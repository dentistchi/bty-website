"use client";

/**
 * RelationshipPulseSummary — renders the self / others / ground pulse as a quiet living
 * map. Consumes the server band only; NO raw counts, percentages, balance scores, or
 * "low relationship" language (Scope Lock §6/§10). An empty domain is `quiet`, not weak.
 */
import React from "react";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages, type Locale } from "@/lib/i18n";
import type { RelationshipPulse, PulseDomain } from "@/lib/bty/daily/relationshipPulse";

const DOMAIN_ORDER: readonly PulseDomain[] = ["self", "others", "ground"];

// Neutral magnitude only (quiet→deepening = 0..3 gold segments). No numbers, no %, no color-morality.
const BAND_LEVEL = { quiet: 0, living: 1, connected: 2, deepening: 3 } as const;

const DOMAIN_LABEL: Record<PulseDomain, (m: ReturnType<typeof getMessages>) => string> = {
  self: (m) => m.today.dailyOs.doorCenterTitle,
  others: (m) => m.today.dailyOs.doorArenaTitle,
  ground: (m) => m.today.dailyOs.doorFoundryTitle,
};

export function RelationshipPulseSummary({
  pulse,
  locale,
}: {
  pulse: RelationshipPulse;
  locale: Locale;
}) {
  const m = getMessages(locale);
  return (
    <InfoCard title={m.today.dailyOs.pulseHeading} tone="panel" className="shadow-lg">
      <div className="space-y-3">
        {DOMAIN_ORDER.map((domain) => {
          const band = pulse.domains[domain].band;
          const level = BAND_LEVEL[band];
          const line = m.today.dailyOs.pulse[domain][band];
          return (
            <div key={domain} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{DOMAIN_LABEL[domain](m)}</p>
                <p className="mt-0.5 truncate text-xs text-white/60">{line}</p>
              </div>
              <span className="flex shrink-0 gap-1" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-5 rounded-full ${i <= level ? "bg-bty-gold" : "bg-white/10"}`}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </InfoCard>
  );
}
