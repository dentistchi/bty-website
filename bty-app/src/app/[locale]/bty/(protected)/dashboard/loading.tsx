import { LoadingFallback } from "@/components/bty-arena";

/**
 * DESIGN_FIRST_IMPRESSION_BRIEF §2: 로딩 시 아이콘 + 한 줄 문구 + 카드 형태 스켈레톤.
 */
export default function DashboardLoading() {
  return (
    <div
      className="p-6"
      style={{ maxWidth: 980, margin: "0 auto" }}
      aria-busy="true"
      aria-label="Loading…"
    >
      <LoadingFallback
        icon="📋"
        message="잠시만 기다려 주세요."
        withSkeleton
      />
    </div>
  );
}
