import Link from "next/link";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

/** Arena 결과 — ScreenShell · AIR raw·과장 없음. */
export default async function ArenaResultPage({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const m = getMessages(loc).myPageStub;
  const hub = `/${locale}/bty-arena`;
  const play = `/${locale}/bty-arena/play`;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={t.arenaResultEyebrow}
      title={t.arenaResultRecordedTitle}
      subtitle={t.arenaResultRecordedSubtitle}
    >
      <div data-testid="arena-result" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-testid="arena-result-core-xp" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#1E2A38]">{m.coreXp}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-[#1E2A38]">
              +25
            </p>
          </div>
          <div data-testid="arena-result-weekly-xp" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#1E2A38]">{m.weeklyXp}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-[#1E2A38]">
              +15
            </p>
          </div>
        </div>

        <div data-testid="arena-result-system-note" className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1E2A38]">{t.arenaResultSystemNoteTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{t.arenaResultSystemNoteBody}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            data-testid="arena-result-continue-button"
            href={play}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white hover:bg-[#243446]"
          >
            {t.arenaResultContinuePlayCta}
          </Link>
          <Link
            data-testid="arena-result-return-button"
            href={hub}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7CFBF] bg-white px-4 text-sm font-medium text-[#405A74] hover:bg-[#F6F4EE]"
          >
            {t.arenaResultReturnHubCta}
          </Link>
        </div>

        <p className="px-1 text-center text-xs leading-relaxed text-[#98A2B3]">{t.resultSampleNote}</p>
      </div>
    </ScreenShell>
  );
}
