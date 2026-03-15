"use client";

import React from "react";
import Link from "next/link";
import { arenaFetch } from "@/lib/http/arenaFetch";

type LabUsageRes = { limit: number; attemptsUsed: number; attemptsRemaining: number };

type Props = { locale: string };

export function LabUsageStrip({ locale }: Props) {
  const [usage, setUsage] = React.useState<LabUsageRes | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const isKo = locale === "ko";

  React.useEffect(() => {
    let cancelled = false;
    arenaFetch<LabUsageRes>("/api/arena/lab/usage")
      .then((data) => { if (!cancelled) setUsage(data); })
      .catch(() => { if (!cancelled) setUsage(null); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || usage === null) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "8px 12px",
        borderRadius: 8,
        background: "var(--arena-card)",
        border: "1px solid #eee",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
      role="region"
      aria-label={isKo ? "Leadership Lab 오늘 남은 횟수" : "Leadership Lab remaining today"}
    >
      <span style={{ opacity: 0.85 }}>
        {isKo ? "Lab" : "Lab"}: {usage.attemptsRemaining}/{usage.limit}{" "}
        {isKo ? "회 남음" : "remaining"}
      </span>
      <Link
        href={`/${locale}/bty-arena/lab`}
        style={{ color: "var(--arena-accent)", textDecoration: "none", fontWeight: 500 }}
        aria-label={isKo ? "Leadership Lab 페이지로" : "Go to Leadership Lab"}
      >
        {isKo ? "자세히 →" : "Details →"}
      </Link>
    </div>
  );
}
