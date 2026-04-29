"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/bty/(protected)/dashboard/loading` — `<main>` 랜드마크 (Suspense 라우트 로딩). */
export default function DashboardRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).bty;
  return (
    <main aria-label={t.dashboardSuspenseMainRegionAria} className="min-h-screen bg-white">
      <div className="p-6" style={{ maxWidth: 980, margin: "0 auto" }}>
        <LocaleAwareRouteLoading icon="📋" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
