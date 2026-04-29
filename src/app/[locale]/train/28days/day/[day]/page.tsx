import TrainDayClient from "@/components/train/TrainDayClient";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type DayParams = { locale: string; day: string };

export default async function Page({ params }: { params: Promise<DayParams> }) {
  const { locale, day } = await params;
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).train;
  return (
    <main className="space-y-4" aria-label={t.track28DayMainRegionAria}>
      <TrainDayClient day={day} />
    </main>
  );
}
