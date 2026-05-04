"use client";

import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: Locale };

export function ProgressXpPanel({ locale }: Props) {
  const m = getMessages(locale).myPageStub;
  const [coreXp, setCoreXp] = useState<number | null>(null);
  const [weeklyXp, setWeeklyXp] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const locParam = locale === "ko" ? "ko" : "en";

    Promise.all([
      fetch(`/api/bty/my-page/state?locale=${encodeURIComponent(locParam)}`, {
        method: "GET",
        cache: "no-store",
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ core_xp?: number }>) : null))
        .catch(() => null),
      fetch("/api/arena/weekly-xp", { method: "GET", cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ xpTotal?: number }>) : null))
        .catch(() => null),
    ]).then(([state, weekly]) => {
      if (cancelled) return;
      setCoreXp(state?.core_xp ?? 0);
      setWeeklyXp(weekly?.xpTotal ?? 0);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div data-testid="my-page-progress-screen" className="space-y-4">
      <div data-testid="my-page-core-xp" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-[#1E2A38]">{m.coreXp}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[#667085]">{m.coreXp}</span>
          {loaded ? (
            <span className="font-semibold tabular-nums text-[#1E2A38]">{coreXp ?? 0}</span>
          ) : (
            <span className="inline-block h-4 w-10 animate-pulse rounded bg-[#E8E3D8]" />
          )}
        </div>
        <div className="mt-3 border-t border-[#EEE7DA] pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">
            {m.myPageProgressMovement}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#1E2A38]">{m.progressStage}</p>
        </div>
      </div>

      <div data-testid="my-page-weekly-xp" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-[#1E2A38]">{m.weeklyXp}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[#667085]">{m.weeklyXp}</span>
          {loaded ? (
            <span className="font-semibold tabular-nums text-[#1E2A38]">{weeklyXp ?? 0}</span>
          ) : (
            <span className="inline-block h-4 w-10 animate-pulse rounded bg-[#E8E3D8]" />
          )}
        </div>
      </div>

      <div data-testid="my-page-streak" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-[#1E2A38]">{m.streak}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[#667085]">{m.streak}</span>
          <span className="font-semibold text-[#1E2A38]">{m.progressStreakVal}</span>
        </div>
      </div>

      <div data-testid="my-page-system-note" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-[#1E2A38]">{m.systemMsg}</p>
        <p className="mt-2 text-sm leading-6 text-[#667085]">{m.progressSystemLine}</p>
      </div>
    </div>
  );
}
