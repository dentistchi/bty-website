"use client";

import { usePathname } from "next/navigation";
import { PageLoadingFallback } from "@/components/bty-arena";
import { getMessages, type Locale } from "@/lib/i18n";

/** Foundry 허브 Suspense — `<main>` 랜드마크 제공. */
export function FoundryHubLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).bty;
  return (
    <main aria-label={t.foundryHubSuspenseMainRegionAria} className="min-h-screen bg-[var(--arena-bg,#fff)]">
      <PageLoadingFallback />
    </main>
  );
}
