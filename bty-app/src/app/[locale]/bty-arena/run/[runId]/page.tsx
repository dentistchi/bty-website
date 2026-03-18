import { RunDetailView } from "@/components/bty-arena/RunDetailView";
import { BtyArenaBottomNav } from "@/components/bty/navigation/BtyArenaBottomNav";
import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; runId: string }> };

/**
 * 단일 런 스텁 — GET /api/arena/run/[runId] render-only.
 */
export default async function Page({ params }: Props) {
  const { locale, runId } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).myPageStub;

  return (
    <div
      className="mx-auto max-w-md bg-bty-bg px-4 py-6"
      role="region"
      aria-label={t.runDetailRegionAria}
    >
      <ScreenShell
        title={t.runDetailPageTitle}
        subtitle={t.runDetailPageSubtitle}
        menuLabel="Menu"
        footer={<BtyArenaBottomNav locale={locale} active="arena" />}
      >
        <RunDetailView locale={locale} runId={runId} />
      </ScreenShell>
    </div>
  );
}
