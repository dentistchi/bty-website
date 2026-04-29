"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export default function TrainStartPage() {
  const params = useParams();
  const loc = (params?.locale === "en" ? "en" : "ko") as Locale;
  const t = getMessages(loc).train;

  return (
    <main className="p-6 space-y-4" aria-label={t.journeyStartMainRegionAria}>
      <h1 className="text-2xl font-semibold">{t.journeyStartTitle}</h1>
      <p className="opacity-80">{t.journeyStartIntro}</p>
      <div className="rounded-lg border p-4">
        <Link className="underline" href={`/${loc}/train/day/1`} aria-label={t.journeyStartDay1Aria}>
          {t.journeyStartDay1Link}
        </Link>
      </div>
    </main>
  );
}
