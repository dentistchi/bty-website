import { LoadingFallback } from "@/components/bty-arena";

/**
 * Arena beginner route loading: 아이콘 + 한 줄 문구 + 카드 스켈레톤.
 */
export default function BtyArenaBeginnerLoading() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <LoadingFallback
        icon="📋"
        message="잠시만 기다려 주세요."
        withSkeleton
      />
    </div>
  );
}
