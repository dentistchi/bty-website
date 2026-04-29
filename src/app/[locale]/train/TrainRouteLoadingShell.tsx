"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/train/loading` — Suspense 시 `<main>` 랜드마크. */
export default function TrainRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).train;
  return (
    <main aria-label={t.trainRouteSuspenseMainRegionAria} className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LocaleAwareRouteLoading icon="📅" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
