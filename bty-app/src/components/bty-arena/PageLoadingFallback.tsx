"use client";

import { usePathname } from "next/navigation";
import { LoadingFallback } from "./LoadingFallback";
import { getMessages } from "@/lib/i18n";

/**
 * §9 Suspense/페이지 로딩 시 카드형 스켈레톤 + 아이콘·문구. message 없으면 pathname으로 locale 추론.
 */
export function PageLoadingFallback({ message }: { message?: string } = {}) {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const fallbackMessage = getMessages(locale).loading.message;
  const statusMessage = message ?? fallbackMessage;
  return (
    <div
      className="p-6"
      style={{ maxWidth: 960, margin: "0 auto", minHeight: 200 }}
      role="status"
      aria-label={statusMessage}
    >
      <LoadingFallback
        icon="⏳"
        message={message ?? fallbackMessage}
        withSkeleton
      />
    </div>
  );
}
