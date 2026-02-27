export default function LocaleLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F4F0]">
      <div className="text-center text-[#6B6560]">
        <div className="inline-block w-8 h-8 border-2 border-[#5B4B8A]/40 border-t-[#5B4B8A] rounded-full animate-spin mb-4" />
        <p className="text-sm">Loading…</p>
        <p className="text-xs mt-1 opacity-70">첫 로딩은 1–2분 걸릴 수 있어요</p>
      </div>
    </div>
  );
}
