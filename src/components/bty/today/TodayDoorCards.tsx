"use client";

/**
 * TodayDoorCards — the one decision: Center (self) / Arena (others) / Foundry (world).
 * Not a menu — today's choice. Each door routes through an EXISTING route (no new routes).
 */
import React from "react";
import Link from "next/link";
import { getMessages, type Locale } from "@/lib/i18n";
import { doorHref } from "./todayRoutes";

export function TodayDoorCards({ locale }: { locale: Locale }) {
  const m = getMessages(locale);
  const doors = [
    { key: "center", title: m.today.dailyOs.doorCenterTitle, sub: m.today.dailyOs.doorCenterSub, href: doorHref.center(locale) },
    { key: "arena", title: m.today.dailyOs.doorArenaTitle, sub: m.today.dailyOs.doorArenaSub, href: doorHref.arena(locale) },
    { key: "foundry", title: m.today.dailyOs.doorFoundryTitle, sub: m.today.dailyOs.doorFoundrySub, href: doorHref.foundry(locale) },
  ] as const;

  return (
    <div>
      <p className="mb-3 px-1 text-xs uppercase tracking-[0.2em] text-white/45">
        {m.today.dailyOs.doorHeading}
      </p>
      <div className="space-y-3">
        {doors.map((d) => (
          <Link
            key={d.key}
            href={d.href}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-[var(--bty-panel,#11294A)] px-5 py-4 transition hover:border-bty-gold/40"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{d.title}</p>
              <p className="mt-0.5 text-xs text-white/60">{d.sub}</p>
            </div>
            <span className="ml-3 shrink-0 text-white/30" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
