import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { DashboardBackLink } from "@/components/bty/navigation/DashboardBackLink";
import { ProgressXpPanel } from "@/components/bty/my-page/ProgressXpPanel";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** Progress — 코어/주간·단계·스트릭 (순위·AIR raw 비노출). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const m = getMessages(loc).myPageStub;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={m.progressTitle}
      title={m.myPageShellProgressTitle}
      subtitle={m.myPageShellProgressSubtitle}
    >
      <DashboardBackLink locale={locale} />
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <ProgressXpPanel locale={loc} />

      <p className="px-1 text-xs leading-relaxed text-[#98A2B3]">{m.progressFootnote}</p>
    </ScreenShell>
  );
}
