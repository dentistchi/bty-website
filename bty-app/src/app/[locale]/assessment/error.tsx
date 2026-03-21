"use client";

import { useParams } from "next/navigation";
import { getMessages, type Locale } from "@/lib/i18n";

export default function AssessmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const rawLocale = typeof params?.locale === "string" ? params.locale : "";
  const locale = (rawLocale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(locale).landing;

  return (
    <main
      className="min-h-screen bg-white"
      aria-label={t.assessmentErrorMainRegionAria}
      role="alert"
    >
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">
          {locale === "ko" ? "문제가 발생했어요" : "Something went wrong"}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {locale === "ko"
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
          className="rounded-xl px-6 py-3 font-medium bg-gray-100 border border-gray-300 text-gray-800 hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
          aria-label={locale === "ko" ? "다시 시도" : "Try again"}
        >
          {locale === "ko" ? "다시 시도" : "Try again"}
        </button>
      </div>
    </main>
  );
}
