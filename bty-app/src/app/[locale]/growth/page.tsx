import Link from "next/link";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/**
 * Growth 허브 — Dojo · Integrity Mirror · Guidance · Journey (IA 고정).
 */
export default async function GrowthPage({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const base = `/${locale}`;

  const cards: { href: string; title: string; description: string }[] = [
    {
      href: `${base}/growth/dojo`,
      title: t.growthCardDojoTitle,
      description: t.growthCardDojoDesc,
    },
    {
      href: `${base}/growth/integrity`,
      title: t.growthCardIntegrityTitle,
      description: t.growthCardIntegrityDesc,
    },
    {
      href: `${base}/growth/guidance`,
      title: t.growthCardGuidanceTitle,
      description: t.growthCardGuidanceDesc,
    },
    {
      href: `${base}/growth/journey`,
      title: t.growthCardJourneyTitle,
      description: t.growthCardJourneyDesc,
    },
  ];

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.growthHubSectionLabel}
      title={t.growthHubHeadline}
      subtitle={t.growthHubLead}
    >
      <section role="region" aria-label={t.growthHubMainRegionAria}>
        <nav className="space-y-3" aria-label={t.growthHubCardsNavAria}>
          {cards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm transition hover:bg-[#FCFAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B08D57]/30"
            >
              <p className="text-base font-semibold text-[#1E2A38]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">{item.description}</p>
            </Link>
          ))}
        </nav>
      </section>
    </ScreenShell>
  );
}
