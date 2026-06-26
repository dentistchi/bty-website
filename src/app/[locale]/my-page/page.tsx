import Link from "next/link";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import {
  MyPageLeadershipConsole,
  type ActionLoopQrCompletion,
} from "@/components/bty/my-page/MyPageLeadershipConsole";
import { getLatestCompletedActionContract } from "@/lib/bty/action-contract/getLatestCompletedActionContract";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { DashboardBackLink } from "@/components/bty/navigation/DashboardBackLink";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

/** My Page · Overview — Arena 누적 신호 기반 리더십 정체성 콘솔 (AIR/TII raw 비노출). */
export default async function Page({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([
    params,
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const m = getMessages(loc).myPageStub;

  const arenaActionLoop = firstSearchParam(sp?.arena_action_loop);
  const aalo = firstSearchParam(sp?.aalo);
  const actionContractResolveFocus = firstSearchParam(sp?.arena_contract) === "resolve";

  // D2 actor-return: detect the actor's latest completed action so they can see
  // "I actually did something today." Witness-mode isolation: when this page is the
  // public QR witness landing (`arena_action_loop=commit`), do NOT compute or pass any
  // actor completion — the completion sheet must never fire in witness mode.
  let actorCompletion: ActionLoopQrCompletion | null = null;
  if (arenaActionLoop !== "commit") {
    try {
      const supabase = await createSupabaseRouteClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const latest = await getLatestCompletedActionContract(supabase, user.id);
        if (latest) {
          actorCompletion = {
            success: true,
            contractId: latest.id,
            contractDescription: latest.contractDescription,
          };
        }
      }
    } catch {
      actorCompletion = null;
    }
  }

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.bottomNavMyPage}
      title={m.myPageShellOverviewTitle}
      subtitle={m.myPageShellOverviewSubtitle}
    >
      <DashboardBackLink locale={locale} />
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <MyPageLeadershipConsole
        locale={locale}
        actionLoopQrCompletion={actorCompletion}
        arenaActionLoopParam={arenaActionLoop ?? null}
        aaloParam={aalo ?? null}
        actionContractResolveFocus={actionContractResolveFocus}
      />

      <p className="mt-4 px-1 text-center text-xs text-[#98A2B3]">
        <Link
          href={`/${locale}/center`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          Center
        </Link>
        {" · "}
        <Link
          href={`/${locale}/bty-arena`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          Arena
        </Link>
        {" · "}
        <Link
          href={`/${locale}/bty/foundry`}
          className="underline-offset-2 hover:text-[#405A74] hover:underline"
        >
          Foundry
        </Link>
      </p>
    </ScreenShell>
  );
}
