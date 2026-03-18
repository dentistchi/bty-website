import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** Leader — 준비도·인증 상태형 표현 (LRI raw 비노출). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const m = getMessages(loc).myPageStub;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={m.leaderTitle}
      title={m.myPageShellLeaderTitle}
      subtitle={m.myPageShellLeaderSubtitle}
    >
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.leaderCardStatus}</span>
            <span className="font-semibold text-[#1E2A38]">{m.leaderBuilding}</span>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.leaderCardReadiness}</span>
            <span className="font-semibold text-[#1E2A38]">{m.leaderReadinessVal}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.leaderCardCert}</span>
            <span className="font-semibold text-[#1E2A38]">{m.leaderCertVal}</span>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.leaderSystem}</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{m.leaderSystemLine}</p>
        </div>

        <p className="px-1 text-xs leading-relaxed text-[#98A2B3]">{m.leaderFootnote}</p>
      </div>
    </ScreenShell>
  );
}
