"use client";

/**
 * Healing 인덱스 — Q4 콘텐츠·플로우. i18n + GET /api/bty/healing 연동(phase 표시).
 * Render-only; no business logic.
 */
import React from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: string };

type HealingApiRes = { ok?: boolean; phase?: string | null };

export default function HealingPageClient({ locale }: Props) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).healing;
  const [phase, setPhase] = React.useState<string | null>(null);
  const [healingLoading, setHealingLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setHealingLoading(true);
    fetch("/api/bty/healing", { credentials: "include" })
      .then((r) => r.json().catch(() => ({})))
      .then((data: HealingApiRes) => {
        if (alive) {
          setPhase(data?.phase ?? null);
          setHealingLoading(false);
        }
      })
      .catch(() => {
        if (alive) setHealingLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}
      role="main"
      aria-label={lang === "ko" ? "Healing 메뉴" : "Healing menu"}
      aria-labelledby="healing-heading"
    >
      <h1 id="healing-heading" style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        {t.title}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
        {t.intro}
      </p>
      {healingLoading && (
        <div role="region" aria-label={lang === "ko" ? "Healing 상태" : "Healing status"} aria-busy="true" aria-live="polite" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, opacity: 0.7 }} role="status">
            {t.loading}
          </p>
        </div>
      )}
      {!healingLoading && phase != null && (
        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 16 }} role="status">
          {phase}
        </p>
      )}
      {!healingLoading && phase == null && (
        <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }} role="status">
          {t.emptyPhase}
        </p>
      )}
      <nav aria-label={t.navLabel} style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link
          href={`/${locale}/bty/healing/awakening`}
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: 12,
            background: "var(--arena-accent, #7c6b9a)",
            color: "white",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
          aria-label={t.ariaAwakening}
        >
          {t.awakeningCta}
        </Link>
        <Link
          href={`/${locale}/bty/dashboard`}
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: 12,
            border: "1px solid var(--arena-accent, #7c6b9a)",
            color: "var(--arena-text, #1a1a1a)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
          aria-label={t.ariaDashboard}
        >
          {t.dashboardCta}
        </Link>
      </nav>
    </div>
  );
}
