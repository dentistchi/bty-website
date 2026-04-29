"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/my-page/loading` — Suspense 시 `<main>` 랜드마크 (`ScreenShell` 배경과 맞춤). */
export default function MyPageRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).myPageStub;
  return (
    <main
      aria-label={t.myPageRouteSuspenseMainRegionAria}
      className="min-h-screen bg-[#F6F4EE] text-[#1F2937]"
    >
      <div className="mx-auto max-w-md px-4 py-10">
        <LocaleAwareRouteLoading icon="👤" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
