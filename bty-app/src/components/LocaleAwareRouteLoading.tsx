"use client";

import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import { LoadingFallback } from "@/components/bty-arena";

/**
 * CENTER_PAGE_IMPROVEMENT_SPEC §2: 전환 중 로딩/대기 문구를 현재 locale에 맞게 표시.
 * [locale]/loading.tsx에서 사용. pathname으로 locale 추론 (ko → 한국어, 그 외 → 영어).
 */
export function LocaleAwareRouteLoading() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const t = getMessages(locale).loading;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F4F0] p-6">
      <LoadingFallback icon="⏳" message={t.message} withSkeleton />
      <p className="text-xs mt-4 text-[#6B6560] opacity-80">{t.hint}</p>
    </div>
  );
}
