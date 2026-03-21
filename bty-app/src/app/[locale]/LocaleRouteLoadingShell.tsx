"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/loading` — 세그먼트 Suspense 시 `<main>` 랜드마크. */
export default function LocaleRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).loading;
  return (
    <main aria-label={t.localeRouteSuspenseMainRegionAria} className="min-h-screen bg-[#F8F4F0]">
      <LocaleAwareRouteLoading icon="⏳" withSkeleton showHint />
    </main>
  );
}
