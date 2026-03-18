import Link from "next/link";
import { GrowthMyRankCard } from "@/components/bty/growth/GrowthMyRankCard";
import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { BtyArenaBottomNav } from "@/components/bty/navigation/BtyArenaBottomNav";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

const OPTIONS: { href: string; title: string; line: string }[] = [
  {
    href: "dojo",
    title: "Dojo 50",
    line: "Measure your current state",
  },
  {
    href: "integrity",
    title: "Integrity Mirror",
    line: "See the situation from the other side",
  },
  {
    href: "mentor",
    title: "Guidance",
    line: "Review your decision patterns",
  },
  {
    href: "dear-me",
    title: "Reflection",
    line: "Stabilize your internal voice",
  },
];

/**
 * Growth 메인 와이어 — Foundry·Arena 진입·BTY 토큰 톤.
 */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = locale as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const base = `/${locale}`;

  return (
    <div className="mx-auto max-w-md bg-bty-bg px-4 py-6">
      <ScreenShell
        title={t.growthTitle}
        subtitle={t.growthSubtitle}
        footer={<BtyArenaBottomNav locale={locale} active="growth" />}
      >
        <p className="text-base font-medium leading-snug text-bty-text">{t.growthLead}</p>

        <GrowthMyRankCard locale={locale} />

        <nav
          className="flex flex-wrap gap-2 border-b border-bty-border pb-4"
          aria-label={t.growthShortcutsNavAria}
        >
          <Link
            href={`${base}/bty/leaderboard`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-text transition-colors hover:border-bty-steel/40 hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.growthWeeklyRankingLink}
          </Link>
          <Link
            href={`${base}/bty/dashboard`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-text transition-colors hover:border-bty-steel/40 hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.growthFoundryLink}
          </Link>
          <Link
            href={`${base}/bty-arena`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-navy transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.growthArenaPlayLink}
          </Link>
          <Link
            href={`${base}/bty-arena/wireframe`}
            className="rounded-xl border border-bty-gold/45 bg-bty-soft px-3 py-2 text-xs font-medium text-bty-bronze transition-colors hover:bg-bty-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-gold focus-visible:ring-offset-2"
          >
            {t.growthArenaWireHubLink}
          </Link>
          <Link
            href={`${base}/bty/elite`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-gold transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-gold focus-visible:ring-offset-2"
          >
            {t.growthElitePageLink}
          </Link>
          <Link
            href={`${base}/bty/healing`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-text transition-colors hover:border-bty-steel/40 hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.growthHealingLink}
          </Link>
          <Link
            href={`${base}/bty/healing/awakening`}
            className="rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-xs font-medium text-bty-text transition-colors hover:border-bty-steel/40 hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          >
            {t.growthAwakeningLink}
          </Link>
        </nav>

        <ul className="space-y-2" role="list" aria-label={t.growthOptionsRegionAria}>
          {OPTIONS.map(({ href, title, line }) => {
            const path =
              href === "dear-me" ? `${base}/dear-me` : `${base}/bty/${href}`;
            return (
              <li key={href}>
                <Link
                  href={path}
                  className="block rounded-2xl border border-bty-border bg-bty-surface px-4 py-3 transition-colors hover:border-bty-steel/30 hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
                >
                  <span className="block text-sm font-semibold text-bty-text">{title}</span>
                  <span className="mt-0.5 block text-xs text-bty-secondary">{line}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-bty-border pt-4">
          <SecondaryButton href={`${base}/bty-arena/wireframe`}>
            {t.growthReturnArena} →
          </SecondaryButton>
        </div>
      </ScreenShell>
    </div>
  );
}
