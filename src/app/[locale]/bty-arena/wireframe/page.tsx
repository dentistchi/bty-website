import Link from "next/link";
import { CardScreenShell } from "@/components/bty/layout/CardScreenShell";
import BottomNav from "@/components/bty/navigation/BottomNav";
import { PrimaryButton } from "@/components/bty/ui/PrimaryButton";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/**
 * Arena 첫 화면 와이어 — PIXEL_WIREFRAMES §1 (Continue → or → Play Game 순).
 */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const base = `/${locale}`;
  const arenaEntry = `${base}/bty-arena`;

  return (
    <main className="mx-auto max-w-md bg-bty-bg px-4 py-6 pb-28" aria-label={t.wireframeLandmarkAria}>
      <CardScreenShell
        title={t.wireframeScreenTitle}
        subtitle={t.wireframeScreenSubtitle}
        menuLabel="Menu"
      >
        <div>
          <p className="text-base font-medium text-bty-text">{t.wireframeSystemReady}</p>
        </div>

        <section className="space-y-3" role="region" aria-label={t.wireframeCtaRegionAria}>
          <SecondaryButton href={arenaEntry}>
            <span className="block font-semibold text-bty-text">{t.wireframeContinue}</span>
            <span className="mt-1 block text-xs font-normal text-bty-secondary">
              {t.wireframeResumeLast}
            </span>
          </SecondaryButton>
          <div className="flex items-center gap-2 py-0.5 text-center text-xs text-bty-muted">
            <span className="h-px flex-1 bg-bty-border" aria-hidden />
            <span>{t.wireframeOr}</span>
            <span className="h-px flex-1 bg-bty-border" aria-hidden />
          </div>
          <PrimaryButton href={arenaEntry}>
            <span className="block">{t.wireframePlayGame}</span>
            <span className="mt-1 block text-xs font-normal text-white/75">{t.wireframeStartScenario}</span>
          </PrimaryButton>
        </section>

        <nav
          className="flex flex-wrap gap-2 border-b border-bty-border pb-4"
          aria-label={t.wireframeFoundryEliteAria}
        >
          <Link
            href={`${base}/bty/dashboard`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-text underline-offset-2 hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.growthFoundryLink} →
          </Link>
          <Link
            href={`${base}/bty/elite`}
            className="rounded-xl border border-bty-gold/40 bg-bty-soft px-3 py-2 text-xs font-medium text-bty-bronze hover:bg-bty-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-gold focus-visible:ring-offset-2"
          >
            {t.growthElitePageLink} →
          </Link>
        </nav>

        <nav
          className="flex flex-wrap gap-2 border-b border-bty-border pb-4 pt-2"
          aria-label={t.wireframeArenaPracticeNavAria}
        >
          <Link
            href={`${base}/bty/dojo`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-navy transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.wireframeDojoLink} →
          </Link>
          <Link
            href={`${base}/bty/integrity`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-text transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.wireframeIntegrityLink} →
          </Link>
        </nav>

        <div
          className="rounded-2xl border border-bty-border bg-bty-soft p-4"
          role="region"
          aria-label={t.weeklySnapshotRegionAria}
        >
          <p className="text-sm text-bty-text">{t.wireframeWeeklyRankLine}</p>
          <p className="mt-1 text-xs text-bty-secondary">{t.wireframeSeasonLine}</p>
          <p className="mt-2 text-xs text-bty-muted">{t.wireframeWireRuleNote}</p>
          <p className="mt-3 text-xs">
            <Link
              href={`${base}/bty/leaderboard`}
              className="font-medium text-bty-steel underline underline-offset-2 hover:text-bty-navy"
            >
              {t.growthWeeklyRankingLink} →
            </Link>
          </p>
          <p className="mt-2 text-xs text-bty-muted">{t.wireframeRunsDashboardHint}</p>
        </div>

        <p className="text-xs text-bty-secondary">
          {t.wireframeResultStubPrefix}{" "}
          <Link
            href={`${base}/bty-arena/record`}
            className="font-medium text-bty-text underline underline-offset-2"
          >
            /bty-arena/record
          </Link>
        </p>
      </CardScreenShell>
      <BottomNav locale={locale} aria-label={t.wireframeBottomNavAria} />
    </main>
  );
}
