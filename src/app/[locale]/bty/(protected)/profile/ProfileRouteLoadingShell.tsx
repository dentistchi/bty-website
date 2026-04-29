"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/bty/(protected)/profile/loading` — Suspense 시 `<main>` 랜드마크. */
export default function ProfileRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).bty;
  return (
    <main
      aria-label={t.profileRouteSuspenseMainRegionAria}
      className="min-h-screen bg-white text-[#1F2937]"
    >
      <div className="mx-auto max-w-2xl px-6 py-10">
        <LocaleAwareRouteLoading icon="👤" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
