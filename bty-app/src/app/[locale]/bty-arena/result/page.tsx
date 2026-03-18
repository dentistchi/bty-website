import Link from "next/link";
import { ResultShareStub } from "@/components/bty-arena/ResultShareStub";
import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { BtyArenaBottomNav } from "@/components/bty/navigation/BtyArenaBottomNav";
import { PrimaryButton } from "@/components/bty/ui/PrimaryButton";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** Arena 결과 와이어 — PIXEL_WIREFRAMES §7 + 244 다음 행동 CTA */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = locale as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const base = `/${locale}`;
  const arena = `${base}/bty-arena`;
  const wireframe = `${base}/bty-arena/wireframe`;

  return (
    <div className="mx-auto max-w-md bg-bty-bg px-4 py-6">
      <ScreenShell
        title={t.resultTitle}
        subtitle={t.resultSubtitle}
        footer={<BtyArenaBottomNav locale={locale} active="arena" />}
      >
        <div className="space-y-1 rounded-2xl border border-bty-border bg-bty-soft p-4">
          <p className="text-lg font-semibold tabular-nums text-bty-text">{t.resultCoreXpSample}</p>
          <p className="text-lg font-semibold tabular-nums text-bty-text">{t.resultWeeklyXpSample}</p>
          <p className="mt-2 text-xs text-bty-secondary">{t.resultSampleNote}</p>
        </div>

        <div className="rounded-2xl border border-bty-border bg-bty-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-bty-secondary">
            {t.resultSystemTitle}
          </p>
          <p className="mt-2 text-sm text-bty-text">{t.resultSystemBody}</p>
        </div>

        <ResultShareStub locale={locale} />

        <div
          className="rounded-2xl border border-bty-gold/30 bg-bty-soft/80 p-4"
          role="region"
          aria-label={t.resultNextActionsRegionAria}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-bty-bronze">
            {t.resultNextScenarioSectionLabel}
          </p>
          <div className="mt-3">
            <PrimaryButton href={arena}>
              <span className="block font-semibold">{t.resultNextScenarioCta}</span>
              <span className="mt-1 block text-xs font-normal text-white/80">{t.resultNextScenarioSub}</span>
            </PrimaryButton>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <SecondaryButton href={wireframe}>
            <span className="block font-medium text-bty-text">{t.resultContinueCta}</span>
            <span className="mt-0.5 block text-xs text-bty-secondary">{t.resultWireHubLink}</span>
          </SecondaryButton>
          <SecondaryButton href={arena}>{t.resultReturnArenaCta}</SecondaryButton>
        </div>

        <p className="text-center text-xs text-bty-muted">{t.resultRunCompleteHint}</p>

        <p className="text-center text-xs text-bty-secondary">
          <Link
            href={wireframe}
            className="underline underline-offset-2 hover:text-bty-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.resultWireHubLink}
          </Link>
        </p>
      </ScreenShell>
    </div>
  );
}
