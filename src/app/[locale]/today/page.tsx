import ScreenShell from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import BeginTodayButton from "./BeginTodayButton";

// D3-0 Slice 1 — BTY Daily OS "Today" static surface (RSC).
// First Fold = Direction; Second Fold = Status placeholders (intentionally static,
// no data wiring this slice). No engines/tables/endpoints/resolver. showBottomNav={false}.
type TodayParams = { locale: string };

export default async function Page({ params }: { params: Promise<TodayParams> }) {
  const { locale } = await params;
  const t = getMessages(locale === "en" ? "en" : "ko").today;

  return (
    <ScreenShell
      locale={locale}
      showBottomNav={false}
      eyebrow={t.eyebrow}
      title={t.title}
      mainAriaLabel={t.title}
    >
      <div className="space-y-8">
        {/* First Fold — Direction */}
        <section className="space-y-5">
          <p className="text-lg text-[#1E2A38]">{t.greeting}</p>

          <div className="flex items-start gap-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#98A2B3]">NOW</p>
              <p className="mt-1 text-sm text-[#667085]">{t.nowReserved}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#98A2B3]">
                TODAY
              </p>
              <p className="mt-1 text-sm text-[#667085]">{t.todayLabel}</p>
            </div>
          </div>

          <p className="text-xl font-medium leading-8 text-[#1E2A38]">{t.promise}</p>
        </section>

        {/* Second Fold — Status placeholders (static; data wiring lands in future slices) */}
        <section className="space-y-3">
          <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-[#667085]">
            {t.journeyPlaceholder}
          </div>
          <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-[#667085]">
            {t.pendingPlaceholder}
          </div>
          <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-[#667085]">
            {t.reflectionPlaceholder}
          </div>
        </section>

        <BeginTodayButton locale={locale} />
      </div>
    </ScreenShell>
  );
}
