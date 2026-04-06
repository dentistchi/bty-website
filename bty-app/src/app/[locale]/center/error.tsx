"use client";

import { useParams } from "next/navigation";
import { getMessages, type Locale } from "@/lib/i18n";

export default function CenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const rawLocale = typeof params?.locale === "string" ? params.locale : "";
  const locale = (rawLocale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(locale).center;

  return (
    <main
      className="min-h-screen bg-white"
      aria-label={t.centerErrorMainRegionAria}
      role="alert"
    >
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">
          {locale === "ko" ? "문제가 발생했어요" : "Something went wrong"}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {locale === "ko"
            ? "페이지를 불러오는 중 오류가 생겼어요. 다시 시도해 주세요."
            : "An error occurred while loading this page. Please reload the page."}
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
          aria-label={locale === "ko" ? "다시 시도" : "Reload"}
        >
          {locale === "ko" ? "다시 시도" : "Reload"}
        </button>
      </div>
    </main>
  );
}
