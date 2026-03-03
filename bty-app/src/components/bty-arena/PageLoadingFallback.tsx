"use client";

import { LoadingFallback } from "./LoadingFallback";

/**
 * DESIGN_FIRST_IMPRESSION_BRIEF §2: Suspense/페이지 로딩 시 카드형 스켈레톤 + 아이콘·문구.
 * CENTER_PAGE_IMPROVEMENT_SPEC §2: message 있으면 locale에 맞는 문구 사용.
 */
export function PageLoadingFallback({ message }: { message?: string } = {}) {
  return (
    <div className="p-6" style={{ maxWidth: 960, margin: "0 auto", minHeight: 200 }}>
      <LoadingFallback
        icon="⏳"
        message={message ?? "잠시만 기다려 주세요."}
        withSkeleton
      />
    </div>
  );
}
