import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { BtyMyPageShellFooter } from "@/components/bty/navigation/BtyMyPageShellFooter";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** My Page · Team (PIXEL_WIREFRAMES §5) */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = locale as Locale;
  const t = getMessages(loc).myPageStub;

  return (
    <div className="mx-auto max-w-md bg-bty-bg px-4 py-6">
      <ScreenShell
        title={t.teamTitle}
        subtitle={t.subMyPage}
        footer={<BtyMyPageShellFooter locale={locale} />}
      >
        <InfoCard title={t.teamTiiCard}>
          <p className="text-3xl font-semibold tabular-nums text-bty-gold">0.72</p>
        </InfoCard>

        <InfoCard title={t.teamStatusCard}>
          <p className="text-sm text-bty-text">
            {t.teamInnerStatus}: <span className="font-semibold text-bty-stable">{t.teamStable}</span>
          </p>
          <p className="text-sm text-bty-text">
            {t.teamInnerTrend}: <span className="font-semibold text-bty-stable">{t.teamTrendVal}</span>
          </p>
        </InfoCard>

        <InfoCard title={t.teamRankCard}>
          <p className="text-sm text-bty-text">
            {t.teamRankCaption}:{" "}
            <span className="font-semibold tabular-nums">{t.teamRankLine}</span>
          </p>
        </InfoCard>

        <p className="text-xs leading-relaxed text-bty-secondary">{t.teamFooter}</p>
      </ScreenShell>
    </div>
  );
}
