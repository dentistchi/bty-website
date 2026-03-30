import { cookies, headers } from "next/headers";
import Link from "next/link";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { MyPageLeadershipConsole } from "@/components/bty/my-page/MyPageLeadershipConsole";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Matches {@link MyPageLeadershipConsole} server prop (avoid importing client types into RSC). */
type ActionLoopQrCompletion = { success: boolean; narrativeState?: string | null };

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

  let actionLoopQrCompletion: ActionLoopQrCompletion | null = null;
  const arenaActionLoop = firstSearchParam(sp?.arena_action_loop);
  const aalo = firstSearchParam(sp?.aalo);

  if (arenaActionLoop === "commit" && aalo) {
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
      const proto =
        h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
      const cookieStore = await cookies();
      const cookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      const validateRes = await fetch(
        `${proto}://${host}/api/arena/leadership-engine/qr/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            arenaActionLoopToken: aalo,
            clientScanAtIso: new Date().toISOString(),
          }),
          cache: "no-store",
        },
      );
      if (validateRes.ok) {
        const raw = (await validateRes.json()) as { ok?: boolean };
        if (raw.ok === true) {
          actionLoopQrCompletion = { success: true, narrativeState: null };
        }
      }
    } catch (err) {
      console.error("[my-page] QR validate failed", err);
    }
  }

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

      <MyPageLeadershipConsole locale={locale} actionLoopQrCompletion={actionLoopQrCompletion} />

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
