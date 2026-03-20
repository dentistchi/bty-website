"use client";

import { usePathname } from "next/navigation";
import { PageLoadingFallback } from "@/components/bty-arena";
import { getMessages, type Locale } from "@/lib/i18n";

/** Suspense·초기 auth 로딩 — `<main>` 랜드마크 일관 제공. */
export function JournalLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).journal;
  return (
    <main aria-label={t.journalLoadingMainRegionAria} className="min-h-screen bg-white">
      <PageLoadingFallback />
    </main>
  );
}
