"use client";

/**
 * TodayRelationshipBrief — Today Intelligence v1 ritual brief (STEP 7B).
 *
 * Render-only. The relationship focus is decided server-side by the deterministic deriver
 * ({@link deriveTodayIntelligence}); this component only renders the pre-derived focus. It
 * shows a Self/Others/World focus with one short evidence-based line and ONE focused action.
 *
 * Contract with the deriver: a relationship is a CLAIM only when the brief carries a real
 * focus (Self/Others/World). `CleanStart`/`ContinuePending` render as neutral copy with no
 * action button (their action lives in the doors below / the blocking gate cards). Raw
 * metrics, enum labels, and internal fallback modes NEVER appear here.
 */
import React from "react";
import Link from "next/link";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages, type Locale } from "@/lib/i18n";
import type { TodayRelationshipFocus } from "@/domain/daily/todayIntelligence";
import { doorHref } from "./todayRoutes";

type FocusKey = "Self" | "Others" | "World" | "CleanStart" | "ContinuePending";

function focusAction(
  focus: FocusKey,
  locale: Locale,
  m: ReturnType<typeof getMessages>,
): { label: string; href: string } | null {
  switch (focus) {
    case "Self":
      return { label: m.today.dailyOs.intel.ctaSelf, href: doorHref.center(locale) };
    case "Others":
      return { label: m.today.dailyOs.intel.ctaOthers, href: doorHref.arena(locale) };
    case "World":
      return { label: m.today.dailyOs.intel.ctaWorld, href: doorHref.foundry(locale) };
    default:
      return null; // CleanStart / ContinuePending → no forced action here
  }
}

export function TodayRelationshipBrief({
  focus,
  locale,
}: {
  focus: TodayRelationshipFocus;
  locale: Locale;
}) {
  const m = getMessages(locale);
  const copy = m.today.dailyOs.intel.focus[focus];
  const action = focusAction(focus, locale, m);

  return (
    <InfoCard title={m.today.dailyOs.intel.focusLabel} tone="panel" className="shadow-lg">
      <p className="text-base font-medium text-white">{copy.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-white/80">{copy.line}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-bty-gold px-5 py-2 text-sm font-semibold text-bty-navy transition hover:opacity-90"
        >
          {action.label}
        </Link>
      ) : null}
    </InfoCard>
  );
}
