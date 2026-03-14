"use client";

export default function CenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isKo =
    typeof window !== "undefined" && window.location.pathname.startsWith("/ko");

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-semibold mb-2">
        {isKo ? "문제가 발생했어요" : "Something went wrong"}
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        {isKo
          ? "페이지를 불러오는 중 오류가 생겼어요. 다시 시도해 주세요."
          : "An error occurred while loading this page. Please try again."}
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-6 text-left overflow-auto">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-xl px-6 py-3 font-medium bg-dear-sage/10 border border-dear-sage/30 text-dear-charcoal hover:bg-dear-sage/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
        aria-label={isKo ? "다시 시도" : "Try again"}
      >
        {isKo ? "다시 시도" : "Try again"}
      </button>
    </div>
  );
}
