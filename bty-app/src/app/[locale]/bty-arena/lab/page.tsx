"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CardSkeleton, ProgressCard } from "@/components/bty-arena";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { arenaFetch } from "@/lib/http/arenaFetch";

type LabUsageRes = {
  limit: number;
  attemptsUsed: number;
  attemptsRemaining: number;
};

export default function LabPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const isKo = locale === "ko";

  const [usage, setUsage] = React.useState<LabUsageRes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    arenaFetch<LabUsageRes>("/api/arena/lab/usage")
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <BtyTopNav />
      <div style={{ marginTop: 24 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700 }}>
          {isKo ? "Leadership Lab" : "Leadership Lab"}
        </h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>
          {isKo ? "오늘 하루 3회까지 시나리오를 완료하면 Core XP를 얻을 수 있습니다." : "Complete up to 3 scenarios per day to earn Core XP."}
        </p>
      </div>

      <div style={{ marginTop: 20 }}>
        <ProgressCard label={isKo ? "오늘 남은 횟수" : "Remaining today"}>
          {loading && (
            <CardSkeleton showLabel={false} lines={1} style={{ padding: "16px 20px" }} />
          )}
          {error && (
            <p style={{ margin: 0, fontSize: 14, color: "#8b2e2e" }}>{error}</p>
          )}
          {!loading && !error && usage !== null && (
            <div style={{ padding: "4px 0" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {usage.attemptsRemaining} / {usage.limit}
                <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.85 }}>
                  {" "}{isKo ? "회 남음" : "remaining"}
                </span>
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.8 }}>
                {isKo ? "사용한 횟수: " : "Used: "}{usage.attemptsUsed}
              </p>
            </div>
          )}
        </ProgressCard>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/${locale}/bty-arena`}
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
          aria-label={isKo ? "Arena로 돌아가기" : "Back to Arena"}
        >
          {isKo ? "← Arena로 돌아가기" : "← Back to Arena"}
        </Link>
      </div>
    </div>
  );
}
