"use client";

/**
 * CriticalGateCheckHost — renders the Today Shell from the server gate snapshot + pulse.
 *
 * The server gate is authoritative: this host only render-switches on it (no client-side
 * gate re-ordering, no `statePriorityForRuntime` import, no evidence interpretation).
 *
 * Blocking gates (destination.kind !== "today") → one decision card + a quiet pulse — the
 * decision IS the card. Ritual gates (kind === "today") → mirror line → pulse → Orb
 * (presence only, sealed) → the three Today Doors → exit line. First viewport is
 * ritual-first, never dashboard/score-first (Scope Lock §1/§2/§10).
 */
import React from "react";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages, type Locale } from "@/lib/i18n";
import type { DailyGateSnapshot } from "@/lib/bty/daily/dailyGateCheck";
import type { RelationshipPulse } from "@/lib/bty/daily/relationshipPulse";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";
import { RelationshipPulseSummary } from "./RelationshipPulseSummary";
import { YesterdayMirrorLine } from "./YesterdayMirrorLine";
import { TodayRelationshipBrief } from "./TodayRelationshipBrief";
import { GateActionCard, OpenLoopCard } from "./OpenLoopCard";
import { TodayDoorCards } from "./TodayDoorCards";
import { ExitLine } from "./ExitLine";
import { destinationHref } from "./todayRoutes";

export function CriticalGateCheckHost({
  snapshot,
  pulse,
  locale,
  intel,
}: {
  snapshot: DailyGateSnapshot;
  pulse: RelationshipPulse;
  locale: Locale;
  intel?: TodayIntelligence;
}) {
  const m = getMessages(locale);
  const { gate, destination } = snapshot;

  // ── Blocking gates — a single decision card, then a quiet pulse. ──────────────
  if (gate === "FORCED_RESET") {
    return (
      <div className="space-y-6">
        <GateActionCard
          title={m.today.dailyOs.centerFirstTitle}
          body={m.today.dailyOs.centerFirstBody}
          ctaLabel={m.today.dailyOs.centerFirstCta}
          href={destinationHref(destination.kind, locale)}
        />
        <RelationshipPulseSummary pulse={pulse} locale={locale} />
      </div>
    );
  }
  if (gate === "ACTION_REQUIRED") {
    return (
      <div className="space-y-6">
        <OpenLoopCard href={destinationHref(destination.kind, locale)} locale={locale} />
        <RelationshipPulseSummary pulse={pulse} locale={locale} />
      </div>
    );
  }
  if (gate === "REEXPOSURE_DUE") {
    return (
      <div className="space-y-6">
        <GateActionCard
          title={m.today.dailyOs.reexposureTitle}
          body={m.today.dailyOs.reexposureBody}
          ctaLabel={m.today.dailyOs.reexposureCta}
          href={destinationHref(destination.kind, locale)}
        />
        <RelationshipPulseSummary pulse={pulse} locale={locale} />
      </div>
    );
  }

  // ── Ritual gates (destination.kind === "today"). ─────────────────────────────
  // Today Intelligence v1: a derived relationship focus is a CLAIM only when the deriver
  // asserted it (confidence !== "none" + a Self/Others/World focus). Otherwise fall back to
  // the first-day card or the neutral mirror line — never a guessed relationship.
  const focus = intel?.relationshipFocus;
  const hasRelationshipFocus =
    !!intel &&
    intel.confidence !== "none" &&
    (focus === "Self" || focus === "Others" || focus === "World");

  const top = hasRelationshipFocus ? (
    <TodayRelationshipBrief focus={intel.relationshipFocus} locale={locale} />
  ) : gate === "FIRST_DAY" ? (
    <InfoCard title={m.today.dailyOs.firstDayTitle} tone="panel" className="shadow-lg">
      <p className="text-sm text-white/80">{m.today.dailyOs.firstDayBody}</p>
    </InfoCard>
  ) : (
    <YesterdayMirrorLine hasEvidence={gate === "YESTERDAY_MIRROR"} locale={locale} />
  );

  return (
    <div className="space-y-6">
      {top}
      <RelationshipPulseSummary pulse={pulse} locale={locale} />
      {/* Reveal-only (§G): the Orb is the /start door, not decoration here. Navigation is
          the Today Door cards below. */}
      <TodayDoorCards locale={locale} />
      <ExitLine locale={locale} />
    </div>
  );
}
