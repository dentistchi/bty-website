"use client";

/**
 * Healing 인덱스 — GET /api/bty/healing: phase·ringType·awakeningProgress 표시만.
 */
import React from "react";
import Link from "next/link";
import { AwakeningActsTrack } from "@/components/bty/healing/AwakeningActsTrack";
import { clampHealingAwakeningActProgressDisplayPercent } from "@/domain/healing";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: string };

type AwakeningProgressApi = {
  progressPercent?: number;
  nextActId?: number | null;
  nextActName?: string | null;
  allActsComplete?: boolean;
};

type HealingApiRes = {
  ok?: boolean;
  phase?: string | null;
  content?: { ringType?: string | null } | null;
  awakeningProgress?: AwakeningProgressApi | null;
};

export default function HealingPageClient({ locale }: Props) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).healing;
  const [phase, setPhase] = React.useState<string | null>(null);
  const [ringType, setRingType] = React.useState<string | null>(null);
  const [awakeningProgress, setAwakeningProgress] = React.useState<AwakeningProgressApi | null>(null);
  const [healingLoading, setHealingLoading] = React.useState(true);
  const [healingError, setHealingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setHealingLoading(true);
    setHealingError(null);
    fetch("/api/bty/healing", { credentials: "include" })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as HealingApiRes;
        if (!alive) return;
        if (!r.ok) {
          setHealingError(t.loadError);
          setPhase(null);
          setRingType(null);
          setAwakeningProgress(null);
        } else {
          setPhase(data?.phase ?? null);
          setRingType(data?.content?.ringType ?? null);
          setAwakeningProgress(data?.awakeningProgress ?? null);
        }
        setHealingLoading(false);
      })
      .catch(() => {
        if (alive) {
          setHealingError(t.loadError);
          setPhase(null);
          setRingType(null);
          setAwakeningProgress(null);
          setHealingLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [lang, t.loadError]);

  const hasApiValues = phase != null || ringType != null;
  const pct =
    typeof awakeningProgress?.progressPercent === "number"
      ? clampHealingAwakeningActProgressDisplayPercent(awakeningProgress.progressPercent)
      : null;

  const progressAriaValuetext =
    pct != null && awakeningProgress != null
      ? (() => {
          const detail = awakeningProgress.allActsComplete
            ? t.healingProgressbarDetailAllDone
            : awakeningProgress.nextActName
              ? t.healingProgressbarDetailNext.replace("{name}", String(awakeningProgress.nextActName))
              : t.healingProgressbarDetailSync;
          return t.healingProgressbarValuetext.replace("{pct}", String(pct)).replace("{detail}", detail);
        })()
      : undefined;

  return (
    <main
      style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}
      aria-label={t.mainLandmarkAria}
      aria-labelledby="healing-heading"
    >
      <section
        role="region"
        aria-labelledby="healing-heading"
        aria-label={t.navLabel}
      >
        <h1 id="healing-heading" style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          {t.title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          {t.intro}
        </p>
      </section>

      <AwakeningActsTrack locale={locale} />

      <section
        role="region"
        aria-labelledby="healing-api-heading"
        aria-label={t.phaseProgressRegionAria}
        style={{ marginBottom: 24 }}
      >
        <h2 id="healing-api-heading" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          {t.stubApiSectionTitle}
        </h2>
        {healingLoading && (
          <div role="status" aria-busy="true" aria-live="polite">
            <p style={{ fontSize: 13, opacity: 0.7 }}>{t.loading}</p>
          </div>
        )}
        {!healingLoading && healingError && (
          <p style={{ fontSize: 13, color: "#b91c1c", marginBottom: 0 }} role="alert">
            {healingError}
          </p>
        )}
        {!healingLoading && !healingError && awakeningProgress != null && pct != null && (
          <div
            style={{ marginBottom: 20 }}
            role="group"
            aria-label={t.healingAwakeningProgressHeading}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {t.healingAwakeningProgressHeading}
            </h3>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={progressAriaValuetext}
              aria-label={t.healingAwakeningProgressPct.replace("{n}", String(pct))}
              style={{
                height: 10,
                borderRadius: 6,
                background: "rgba(0,0,0,0.08)",
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "var(--arena-accent, #7c6b9a)",
                  borderRadius: 6,
                }}
              />
            </div>
            <p style={{ fontSize: 13, opacity: 0.85, margin: "0 0 8px 0" }}>
              {t.healingAwakeningProgressPct.replace("{n}", String(pct))}
            </p>
            {awakeningProgress.allActsComplete ? (
              <p style={{ fontSize: 13, margin: 0 }}>{t.healingAwakeningAllActsDone}</p>
            ) : awakeningProgress.nextActName ? (
              <p style={{ fontSize: 13, margin: 0 }}>
                {t.healingNextActFromApi.replace("{name}", String(awakeningProgress.nextActName))}
              </p>
            ) : (
              <p style={{ fontSize: 13, margin: 0, opacity: 0.85 }}>{t.healingNextActSyncHint}</p>
            )}
          </div>
        )}
        {!healingLoading && !healingError && hasApiValues && (
          <dl style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {phase != null && (
              <>
                <dt style={{ fontWeight: 600, marginTop: 8 }}>{t.phaseFieldLabel}</dt>
                <dd style={{ margin: "4px 0 0 0", opacity: 0.9 }}>{phase}</dd>
              </>
            )}
            {ringType != null && (
              <>
                <dt style={{ fontWeight: 600, marginTop: 12 }}>{t.ringTypeFieldLabel}</dt>
                <dd style={{ margin: "4px 0 0 0", opacity: 0.9 }}>{ringType}</dd>
              </>
            )}
          </dl>
        )}
        {!healingLoading && !healingError && !hasApiValues && awakeningProgress == null && (
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 0 }} role="status">
            {t.emptyPhase}
          </p>
        )}
        {!healingLoading && !healingError && hasApiValues && (
          <p style={{ fontSize: 12, opacity: 0.65, marginTop: 16, marginBottom: 0 }}>
            {t.stubRenderOnlyNote}
          </p>
        )}
      </section>

      <section aria-label={t.healingBottomNavSectionAria}>
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
      </section>
    </main>
  );
}

