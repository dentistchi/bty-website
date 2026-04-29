"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/assessment/loading` — Suspense 시 `<main>` 랜드마크. */
export default function AssessmentRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).landing;
  return (
    <main aria-label={t.assessmentSuspenseMainRegionAria} className="min-h-screen bg-white">
      <div className="mx-auto max-w-xl px-4 py-16">
        <LocaleAwareRouteLoading icon="📋" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
