import { ArenaHubEntryCard, ArenaHubSummary } from "@/components/bty-arena";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/**
 * Arena 허브 — 행동 우선. 시뮬 본편은 /bty-arena/play.
 */
export default async function ArenaHubPage({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.bottomNavArena}
      title={t.arenaHubShellTitle}
      subtitle={t.arenaHubSubtitle}
    >
      <div data-testid="arena-hub" className="space-y-4">
        <ArenaHubEntryCard locale={locale} />

        <ArenaHubSummary locale={locale} />
      </div>
    </ScreenShell>
  );
}
