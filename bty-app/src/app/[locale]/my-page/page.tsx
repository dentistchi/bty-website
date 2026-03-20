import Link from "next/link";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { MyPageLeadershipConsole } from "@/components/bty/my-page/MyPageLeadershipConsole";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** My Page · Overview — Arena 누적 신호 기반 리더십 정체성 콘솔 (AIR/TII raw 비노출). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const m = getMessages(loc).myPageStub;

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

      <MyPageLeadershipConsole locale={locale} />

      <p className="mt-4 px-1 text-center text-xs text-[#98A2B3]">
        <Link
          href={`/${locale}/bty/dashboard`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          {m.myPageAccountLink}
        </Link>
        {" · "}
        <Link
          href={`/${locale}/my-page/progress`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          {m.myPageTabProgress}
        </Link>
        {" · "}
        <Link
          href={`/${locale}/my-page/team`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          {m.myPageTabTeam}
        </Link>
        {" · "}
        <Link
          href={`/${locale}/my-page/leader`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          {m.myPageTabLeader}
        </Link>
      </p>
    </ScreenShell>
  );
}
