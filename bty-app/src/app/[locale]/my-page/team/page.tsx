import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** Team — TII·상태·추세·순위 (팀 단위만). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const m = getMessages(loc).myPageStub;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={m.teamTitle}
      title={m.myPageShellTeamTitle}
      subtitle={m.myPageShellTeamSubtitle}
    >
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.teamTiiCard}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-[#1E2A38]">
            0.72
          </p>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.teamInnerStatus}</span>
            <span className="font-semibold text-[#1E2A38]">{m.teamStable}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.teamInnerTrend}</span>
            <span className="font-semibold text-[#1E2A38]">{m.teamTrendVal}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.teamRankCaption}</span>
            <span className="font-semibold tabular-nums text-[#1E2A38]">{m.teamRankLine}</span>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.myPageTeamNoteHeading}</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{m.teamFooter}</p>
        </div>
      </div>
    </ScreenShell>
  );
}
