"use client";

/**
 * GateActionCard — a single quiet decision card for a blocking gate (open loop, center-first,
 * re-exposure). Title + one line + one CTA routed to an EXISTING route. No shame/penalty
 * language, no scores. `OpenLoopCard` is the ACTION_REQUIRED specialization.
 */
import React from "react";
import Link from "next/link";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages, type Locale } from "@/lib/i18n";

export function GateActionCard({
  title,
  body,
  ctaLabel,
  href,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <InfoCard title={title} tone="panel" className="shadow-lg">
      <p className="text-sm text-white/90">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-full bg-bty-gold px-5 py-2 text-sm font-semibold text-bty-navy transition hover:opacity-90"
      >
        {ctaLabel}
      </Link>
    </InfoCard>
  );
}

export function OpenLoopCard({ href, locale }: { href: string; locale: Locale }) {
  const m = getMessages(locale);
  return (
    <GateActionCard
      title={m.today.dailyOs.openLoopTitle}
      body={m.today.dailyOs.openLoopBody}
      ctaLabel={m.today.dailyOs.openLoopCta}
      href={href}
    />
  );
}
