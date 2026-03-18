import { RunDetailView } from "@/components/bty-arena/RunDetailView";
import { CardScreenShell } from "@/components/bty/layout/CardScreenShell";
import BottomNav from "@/components/bty/navigation/BottomNav";
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
      className="mx-auto max-w-md bg-bty-bg px-4 py-6 pb-28"
      role="region"
      aria-label={t.runDetailRegionAria}
    >
      <CardScreenShell
        title={t.runDetailPageTitle}
        subtitle={t.runDetailPageSubtitle}
        menuLabel="Menu"
      >
        <RunDetailView locale={locale} runId={runId} />
      </CardScreenShell>
      <BottomNav locale={locale} />
    </div>
  );
}
