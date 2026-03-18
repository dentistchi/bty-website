import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { BtyMyPageShellFooter } from "@/components/bty/navigation/BtyMyPageShellFooter";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** My Page · Progress (PIXEL_WIREFRAMES §4) */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = locale as Locale;
  const t = getMessages(loc).myPageStub;

  return (
    <div className="mx-auto max-w-md bg-bty-bg px-4 py-6">
      <ScreenShell
        title={t.progressTitle}
        subtitle={t.subMyPage}
        footer={<BtyMyPageShellFooter locale={locale} />}
      >
        <InfoCard title={t.coreXp} tone="soft">
          <p className="text-xl font-semibold tabular-nums text-bty-text">320</p>
          <p className="text-sm text-bty-secondary">{t.progressStage}</p>
        </InfoCard>

        <InfoCard title={t.weeklyXp} tone="soft">
          <p className="text-xl font-semibold tabular-nums text-bty-text">140</p>
          <p className="text-sm text-bty-secondary">{t.progressRank}</p>
        </InfoCard>

        <InfoCard title={t.streak} tone="soft">
          <p className="font-medium text-bty-text">{t.progressStreakVal}</p>
        </InfoCard>

        <InfoCard title={t.systemMsg} tone="stable">
          <p className="text-sm text-bty-text">{t.progressSystemLine}</p>
        </InfoCard>

        <p className="text-xs text-bty-muted">{t.progressFootnote}</p>
      </ScreenShell>
    </div>
  );
}
