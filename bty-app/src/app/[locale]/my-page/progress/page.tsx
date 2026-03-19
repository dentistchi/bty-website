import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
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
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <div data-testid="my-page-progress-screen" className="space-y-4">
        <div data-testid="my-page-core-xp" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.coreXp}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.coreXp}</span>
            <span className="font-semibold tabular-nums text-[#1E2A38]">320</span>
          </div>
          <div className="mt-3 border-t border-[#EEE7DA] pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">
              {m.myPageProgressMovement}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#1E2A38]">{m.progressStage}</p>
          </div>
        </div>

        <div data-testid="my-page-weekly-xp" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.weeklyXp}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.weeklyXp}</span>
            <span className="font-semibold tabular-nums text-[#1E2A38]">140</span>
          </div>
        </div>

        <div data-testid="my-page-streak" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.streak}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{m.streak}</span>
            <span className="font-semibold text-[#1E2A38]">{m.progressStreakVal}</span>
          </div>
        </div>

        <div data-testid="my-page-system-note" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{m.systemMsg}</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{m.progressSystemLine}</p>
        </div>

        <p className="px-1 text-xs leading-relaxed text-[#98A2B3]">{m.progressFootnote}</p>
      </div>
    </ScreenShell>
  );
}
