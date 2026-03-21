"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/bty/leaderboard/loading` — Suspense 시 `<main>` 랜드마크. */
export default function BtyLeaderboardRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).bty;
  return (
    <main
      aria-label={t.leaderboardRouteSuspenseMainRegionAria}
      className="min-h-screen bg-white text-[#1F2937]"
    >
      <div className="mx-auto max-w-[860px] px-4 py-10">
        <LocaleAwareRouteLoading icon="🏆" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
