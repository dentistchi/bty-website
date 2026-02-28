import { LoadingFallback } from "@/components/bty-arena";

export default function LocaleLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F4F0] p-6">
      <LoadingFallback
        icon="⏳"
        message="잠시만 기다려 주세요."
        withSkeleton
      />
      <p className="text-xs mt-4 text-[#6B6560] opacity-80">첫 로딩은 1–2분 걸릴 수 있어요</p>
    </div>
  );
}
