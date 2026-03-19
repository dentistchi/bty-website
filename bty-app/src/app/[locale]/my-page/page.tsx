import Link from "next/link";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** My Page · Overview — 얕은 상태층 (AIR raw 비노출, TII는 팀 요약만). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const m = getMessages(loc).myPageStub;
  const base = `/${locale}/my-page`;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.bottomNavMyPage}
      title={m.myPageShellOverviewTitle}
      subtitle={m.myPageShellOverviewSubtitle}
    >
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <section
        data-testid="my-page-overview"
        className="space-y-4"
        role="region"
        aria-label={m.myPageOverviewRegionAria}
      >
        <div data-testid="my-page-identity-card" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#1E2A38]">{m.myPageCardIdentity}</p>
            <Link
              href={`${base}/leader`}
              className="text-sm font-medium text-[#405A74] hover:text-[#1E2A38]"
            >
              {m.myPageLinkLeader}
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">{m.myPageLabelCodeName}</span>
              <span data-testid="my-page-code-name" className="font-semibold text-[#1E2A38]">
                Builder-07
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">{m.myPageLabelStage}</span>
              <span data-testid="my-page-stage" className="font-semibold text-[#1E2A38]">
                3
              </span>
            </div>
          </div>
        </div>

        <div data-testid="my-page-progress-card" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#1E2A38]">{m.myPageCardProgress}</p>
            <Link
              href={`${base}/progress`}
              className="text-sm font-medium text-[#405A74] hover:text-[#1E2A38]"
            >
              {m.myPageLinkView}
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            <div data-testid="my-page-core-progress">
              <div className="mb-2 flex items-center justify-between text-xs text-[#667085]">
                <span>{m.myPageLabelCoreProgress}</span>
                <span>60%</span>
              </div>
              <div className="h-2 rounded-full bg-[#ECE7DC]">
                <div className="h-2 w-[60%] rounded-full bg-[#1E2A38]" />
              </div>
            </div>
            <div data-testid="my-page-weekly-progress">
              <div className="mb-2 flex items-center justify-between text-xs text-[#667085]">
                <span>{m.myPageLabelWeeklyProgress}</span>
                <span>40%</span>
              </div>
              <div className="h-2 rounded-full bg-[#ECE7DC]">
                <div className="h-2 w-[40%] rounded-full bg-[#B08D57]" />
              </div>
            </div>
          </div>
        </div>

        <div data-testid="my-page-team-card" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#1E2A38]">{m.myPageCardTeam}</p>
            <Link
              href={`${base}/team`}
              className="text-sm font-medium text-[#405A74] hover:text-[#1E2A38]"
            >
              {m.myPageLinkView}
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">{m.myPageOverviewTeamStatus}</span>
              <span className="font-semibold text-[#1E2A38]">{m.teamStable}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">TII</span>
              <span data-testid="my-page-tii-summary" className="font-semibold tabular-nums text-[#1E2A38]">
                0.72
              </span>
            </div>
          </div>
        </div>

        <p className="px-1 text-center">
          <Link
            href={`/${locale}/bty/dashboard`}
            className="text-sm text-[#667085] underline-offset-2 hover:text-[#405A74] hover:underline"
          >
            {m.myPageAccountLink} →
          </Link>
        </p>
      </section>
    </ScreenShell>
  );
}
