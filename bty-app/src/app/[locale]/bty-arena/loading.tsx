import { LoadingFallback } from "@/components/bty-arena";

/**
 * Arena route loading: 아이콘 + 한 줄 문구 + 카드 스켈레톤 (DESIGN_FIRST_IMPRESSION_BRIEF §2).
 */
export default function BtyArenaLoading() {
  return (
    <div
      style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}
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
