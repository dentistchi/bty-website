"use client";

import { usePathname } from "next/navigation";
import { PageLoadingFallback } from "@/components/bty-arena";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/dear-me` Suspense — `<main>` 랜드마크 제공. */
export function DearMeLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).center;
  return (
    <main aria-label={t.dearMeSuspenseMainRegionAria} className="min-h-screen bg-white">
      <PageLoadingFallback message={t.loading} />
    </main>
  );
}
