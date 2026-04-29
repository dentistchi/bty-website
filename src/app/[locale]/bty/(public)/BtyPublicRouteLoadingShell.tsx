"use client";

import { usePathname } from "next/navigation";
import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";
import { getMessages, type Locale } from "@/lib/i18n";

/** `/[locale]/bty/(public)/loading` — 로그인·비밀번호 찾기 공통 Suspense `<main>` 랜드마크. */
export default function BtyPublicRouteLoadingShell() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.startsWith("/ko") ? "ko" : "en") as Locale;
  const t = getMessages(locale).login;
  return (
    <main
      aria-label={t.btyPublicRouteSuspenseMainRegionAria}
      className="flex min-h-screen items-center justify-center bg-white p-6"
    >
      <div className="w-full max-w-md">
        <LocaleAwareRouteLoading icon="🔐" withSkeleton showHint={false} />
      </div>
    </main>
  );
}
