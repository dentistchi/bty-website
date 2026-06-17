"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export default function Track28Home() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko") ? "ko" : "en";
  const t = getMessages(locale as Locale).train;

  return (
    <main className="p-6 space-y-4" aria-label={t.track28HubMainRegionAria}>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="opacity-70">
        {t.journeyStartIntro}
      </p>
      <div className="rounded-lg border p-4">
        <Link className="underline" href={`/${locale}/train/day/1`} aria-label={t.journeyStartDay1Aria}>
          {t.journeyStartDay1Link}
        </Link>
      </div>
    </main>
  );
}
