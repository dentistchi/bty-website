"use client";

import { LoadingFallback } from "./LoadingFallback";

/**
 * DESIGN_FIRST_IMPRESSION_BRIEF §2: Suspense/페이지 로딩 시 카드형 스켈레톤 + 아이콘·문구.
 * "Loading..." 텍스트·스피너 대신 일관된 첫인상용 폴백.
 */
export function PageLoadingFallback() {
  return (
    <div className="p-6" style={{ maxWidth: 960, margin: "0 auto", minHeight: 200 }}>
      <LoadingFallback icon="⏳" message="잠시만 기다려 주세요." withSkeleton />
    </div>
  );
}
