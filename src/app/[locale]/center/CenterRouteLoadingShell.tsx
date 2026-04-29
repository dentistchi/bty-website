"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/center/loading` — `<main>` 랜드마크 (Suspense 라우트 로딩). */
export default function CenterRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).center;
  return (
    <main aria-label={t.centerSuspenseMainRegionAria} className="min-h-screen bg-white">
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <LocaleAwareRouteLoading icon="🏠" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
