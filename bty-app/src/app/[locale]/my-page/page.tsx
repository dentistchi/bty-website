import Link from "next/link";
import { MyPageRecentRuns } from "@/components/bty/my-page/MyPageRecentRuns";
import { ScreenShell } from "@/components/bty/layout/ScreenShell";
import { BtyMyPageShellFooter } from "@/components/bty/navigation/BtyMyPageShellFooter";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { ProgressBar } from "@/components/bty/ui/ProgressBar";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/**
 * My Page Overview (PIXEL_WIREFRAMES §3). 카드 3개 + 탭.
 */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = locale as Locale;
  const tStub = getMessages(loc).myPageStub;
  const tHeal = getMessages(loc).healing;
  const base = `/${locale}`;

  return (
    <div className="mx-auto max-w-md bg-bty-bg px-4 py-6">
      <ScreenShell
        title="My Page"
        subtitle="Overview"
        footer={<BtyMyPageShellFooter locale={locale} />}
      >
        <InfoCard title="Identity">
          <p className="text-lg font-semibold text-bty-text">Code Name: Builder-07</p>
          <p className="text-sm text-bty-secondary">Stage 3</p>
          <p className="text-xs text-bty-muted">예시 표기 · 실데이터는 API 연동 후</p>
        </InfoCard>

        <InfoCard title="Progress">
          <ProgressBar label="Core Progress" value={60} max={100} />
          <div className="pt-2">
            <ProgressBar label="Weekly Progress" value={40} max={100} />
          </div>
        </InfoCard>

        <InfoCard title="Team">
          <p className="text-sm text-bty-text">
            Team Status: <span className="font-semibold text-bty-stable">Stable</span>
          </p>
          <p className="text-sm text-bty-text">
            TII: <span className="font-semibold text-bty-gold">0.72</span>
          </p>
          <p className="text-xs text-bty-muted">
            팀 단위만 노출 · 개인 AIR 등은 탭 외 비노출
          </p>
        </InfoCard>

        <MyPageRecentRuns locale={locale} />

        <InfoCard title={tStub.overviewHealingCardTitle}>
          <p className="mb-3 text-sm text-bty-secondary">{tStub.overviewHealingCardLead}</p>
          <nav className="flex flex-col gap-2" aria-label={tStub.overviewHealingNavAria}>
            <Link
              href={`${base}/bty/healing`}
              className="text-sm font-semibold text-bty-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
            >
              {tHeal.title} →
            </Link>
            <Link
              href={`${base}/bty/healing/awakening`}
              className="text-sm font-medium text-bty-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
            >
              {tHeal.awakeningCta}
            </Link>
          </nav>
        </InfoCard>
      </ScreenShell>
    </div>
  );
}
