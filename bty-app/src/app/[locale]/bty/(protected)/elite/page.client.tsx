"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { CardSkeleton } from "@/components/bty-arena";

export default function ElitePageClient() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as string;
  const [isElite, setIsElite] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await arenaFetch<{ isElite?: boolean }>("/api/me/elite");
        if (alive) setIsElite(Boolean(res?.isElite));
      } catch {
        if (alive) setIsElite(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "grid", gap: 28, marginTop: 24 }}>
          <CardSkeleton lines={3} showLabel={true} />
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginTop: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          {locale === "ko" ? "Elite 전용" : "Elite only"}
        </h1>
        {isElite ? (
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 16 }}>
              {locale === "ko"
                ? "주간 리더보드 상위 5%에 진입하셨습니다. 여기서는 Elite 전용 콘텐츠를 이용할 수 있습니다."
                : "You're in the top 5% on the weekly leaderboard. Here you can access Elite-only content."}
            </p>
            <ul style={{ listStyle: "disc", paddingLeft: 24, marginBottom: 20 }}>
              <li style={{ marginBottom: 8 }}>
                <Link href={`/${locale}/bty/mentor`} style={{ color: "#1a1a1a", fontWeight: 600 }}>
                  {locale === "ko" ? "Dr. Chi 멘토와 심화 대화" : "Deep conversation with Dr. Chi Mentor"}
                </Link>
              </li>
            </ul>
            <Link
              href={`/${locale}/bty/dashboard`}
              style={{
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #111",
                color: "#111",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {locale === "ko" ? "← 대시보드로" : "← Back to dashboard"}
            </Link>
          </div>
        ) : (
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 16, opacity: 0.9 }}>
              {locale === "ko"
                ? "이 페이지는 주간 리더보드 상위 5%에 있을 때만 이용할 수 있습니다."
                : "This page is available only when you're in the top 5% on the weekly leaderboard."}
            </p>
            <p style={{ marginBottom: 20, fontSize: 14, opacity: 0.8 }}>
              {locale === "ko"
                ? "Arena에서 시나리오를 완료하고 주간 XP를 쌓아 상위 5%에 도전해 보세요."
                : "Complete scenarios in Arena and earn weekly XP to reach the top 5%."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href={`/${locale}/bty/leaderboard`}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "#111",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {locale === "ko" ? "리더보드 보기" : "View leaderboard"}
              </Link>
              <Link
                href={`/${locale}/bty/dashboard`}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  color: "#111",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {locale === "ko" ? "대시보드로" : "To dashboard"}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
