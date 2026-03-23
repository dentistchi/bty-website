"use client";

import React from "react";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { CardSkeleton } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getMessages } from "@/lib/i18n";

type LabUsageRes = {
  limit: number;
  attemptsUsed: number;
  attemptsRemaining: number;
};

export default function LabPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const loc = locale === "ko" ? "ko" : "en";
  const m = getMessages(loc);
  const t = m.uxPhase1Stub;

  const [usage, setUsage] = React.useState<LabUsageRes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const stub = getMessages(loc).uxPhase1Stub;

    function loadUsage(silent: boolean) {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      arenaFetch<LabUsageRes>("/api/arena/lab/usage")
        .then((data) => {
          if (!cancelled) setUsage(data);
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message.trim() : "";
          if (!cancelled && !silent) setError(msg || stub.arenaLabUsageLoadError);
        })
        .finally(() => {
          if (!cancelled && !silent) setLoading(false);
        });
    }

    loadUsage(false);

    const onVisibility = () => {
      if (document.visibilityState === "visible") loadUsage(true);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) loadUsage(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [loc]);

  const arenaEntry = `/${locale}/bty-arena`;

  return (
    <ScreenShell
      locale={locale}
      title={t.arenaLabTitle}
      subtitle={t.arenaLabLead}
      fullWidth
      contentClassName="pb-28 px-4"
      mainAriaLabel={t.arenaLabUsageRegionAria}
    >
      <div className="mx-auto max-w-md space-y-4">
        <InfoCard title={t.arenaLabRemainingTodayLabel}>
          <div
            role="status"
            aria-live="polite"
            aria-busy={loading}
            aria-label={loading ? m.loading.message : undefined}
          >
            {loading && (
              <div>
                <CardSkeleton showLabel={false} lines={1} style={{ padding: "16px 20px" }} />
              </div>
            )}
            {error && <p className="text-sm text-bty-risk">{error}</p>}
            {!loading && !error && usage !== null && (
              <div className="py-1">
                <p className="m-0 text-lg font-semibold">
                  {usage.attemptsRemaining} / {usage.limit}
                  <span className="ml-1 text-sm font-normal text-bty-secondary">
                    {t.arenaLabRemainingSuffix}
                  </span>
                </p>
                <p className="mt-2 text-sm text-bty-secondary">
                  {t.arenaLabUsedPrefix}
                  {usage.attemptsUsed}
                </p>
              </div>
            )}
          </div>
        </InfoCard>

        <nav aria-label={t.arenaLabBackNavAria}>
          <SecondaryButton href={arenaEntry} className="max-w-xs">
            {t.arenaLabBackToArena}
          </SecondaryButton>
        </nav>
      </div>
    </ScreenShell>
  );
}
