import { LoadingFallback } from "@/components/bty-arena";

export default function DearMeLoading() {
  return (
    <div
      style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}
      aria-busy="true"
      aria-label="Loading…"
    >
      <LoadingFallback
        icon="✉️"
        message="잠시만 기다려 주세요."
        withSkeleton
      />
    </div>
  );
}
