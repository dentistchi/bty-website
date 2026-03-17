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
  const [healingError, setHealingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setHealingLoading(true);
    setHealingError(null);
    fetch("/api/bty/healing", { credentials: "include" })
      .then((r) => r.json().catch(() => ({})))
      .then((data: HealingApiRes) => {
        if (alive) {
          setPhase(data?.phase ?? null);
          setHealingLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setHealingError(t.loadError);
          setHealingLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  return (
    <div
      style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}
      role="main"
      aria-label={lang === "ko" ? "Healing 메뉴" : "Healing menu"}
      aria-labelledby="healing-heading"
    >
      <section role="region" aria-labelledby="healing-heading" aria-label={lang === "ko" ? "Healing 소개" : "Healing intro"}>
        <h1 id="healing-heading" style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          {t.title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          {t.intro}
        </p>
      </section>
      <section aria-label={t.phaseProgressRegionAria} style={{ marginBottom: 16 }}>
      {healingLoading && (
        <div role="region" aria-busy="true" aria-live="polite" style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 13, opacity: 0.7 }} role="status">
            {t.loading}
          </p>
        </div>
      )}
      {!healingLoading && phase != null && (
        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 0 }} role="status">
          {phase}
        </p>
      )}
      {healingError && (
        <p style={{ fontSize: 13, color: "#b91c1c", marginBottom: 0 }} role="alert">
          {healingError}
        </p>
      )}
      {!healingLoading && !healingError && phase == null && (
        <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 0 }} role="status">
          {t.emptyPhase}
        </p>
      )}
      </section>
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
