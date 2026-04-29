"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/growth/loading` — Suspense 시 `<main>` 랜드마크. */
export default function GrowthRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).uxPhase1Stub;
  return (
    <main aria-label={t.growthRouteSuspenseMainRegionAria} className="min-h-screen bg-[#F8F4F0]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LocaleAwareRouteLoading icon="🌱" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
