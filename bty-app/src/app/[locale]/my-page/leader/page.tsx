import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { BtyMyPageShellFooter } from "@/components/bty/navigation/BtyMyPageShellFooter";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** My Page · Leader Track (PIXEL_WIREFRAMES §6) */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = locale as Locale;
  const t = getMessages(loc).myPageStub;

  return (
    <div className="mx-auto max-w-md bg-bty-bg px-4 py-6">
      <ScreenShell
        title={t.leaderTitle}
        subtitle={t.subMyPage}
        footer={<BtyMyPageShellFooter locale={locale} />}
      >
        <InfoCard title={t.leaderCardStatus}>
          <p className="text-lg font-semibold text-bty-text">{t.leaderBuilding}</p>
        </InfoCard>

        <InfoCard title={t.leaderCardReadiness}>
          <p className="font-semibold text-bty-text">{t.leaderReadinessVal}</p>
        </InfoCard>

        <InfoCard title={t.leaderCardCert}>
          <p className="font-semibold text-bty-text">{t.leaderCertVal}</p>
        </InfoCard>

        <InfoCard title={t.leaderSystem} tone="stable">
          <p className="text-sm text-bty-text">{t.leaderSystemLine}</p>
        </InfoCard>

        <p className="text-xs text-bty-muted">{t.leaderFootnote}</p>
      </ScreenShell>
    </div>
  );
}
