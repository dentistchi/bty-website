"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CardSkeleton, ProgressCard } from "@/components/bty-arena";
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
    setLoading(true);
    setError(null);
    const stub = getMessages(loc).uxPhase1Stub;
    arenaFetch<LabUsageRes>("/api/arena/lab/usage")
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message.trim() : "";
        if (!cancelled) setError(msg || stub.arenaLabUsageLoadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loc]);

  return (
    <main
      data-testid="arena-lab-main"
      aria-label={t.arenaLabMainRegionAria}
      style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}
    >
      <div style={{ marginTop: 0 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700 }}>{t.arenaLabTitle}</h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{t.arenaLabLead}</p>
      </div>

      <div style={{ marginTop: 20 }}>
        <ProgressCard label={t.arenaLabRemainingTodayLabel}>
          {loading && (
            <div aria-busy="true" aria-label={m.loading.message}>
              <CardSkeleton showLabel={false} lines={1} style={{ padding: "16px 20px" }} />
            </div>
          )}
          {error && <p style={{ margin: 0, fontSize: 14, color: "#8b2e2e" }}>{error}</p>}
          {!loading && !error && usage !== null && (
            <div style={{ padding: "4px 0" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {usage.attemptsRemaining} / {usage.limit}
                <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.85 }}>
                  {" "}
                  {t.arenaLabRemainingSuffix}
                </span>
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.8 }}>
                {t.arenaLabUsedPrefix}
                {usage.attemptsUsed}
              </p>
            </div>
          )}
        </ProgressCard>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/${locale}/bty-arena/run`}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            fontSize: 14,
            fontWeight: 500,
          }}
          aria-label={t.arenaLabBackToArena}
        >
          {t.arenaLabBackToArena}
        </Link>
      </div>
    </main>
  );
}
