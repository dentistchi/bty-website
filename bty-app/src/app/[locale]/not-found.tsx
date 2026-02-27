import Link from "next/link";

type Props = { locale?: string };

export default function LocaleNotFound({ params }: { params?: Props }) {
  const locale = params?.locale ?? "en";
  const isKo = locale === "ko";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-2">404</h1>
      <p className="text-gray-600 mb-6">{isKo ? "페이지를 찾을 수 없습니다." : "Page not found."}</p>
      <div className="flex gap-4">
        <Link href={`/${locale}`} className="text-blue-600 underline">
          {isKo ? "홈" : "Home"}
        </Link>
        <Link href={`/${locale}/bty/dashboard`} className="text-blue-600 underline">
          Dashboard
        </Link>
        <Link href={`/${locale}/bty/leaderboard`} className="text-blue-600 underline">
          {isKo ? "리더보드" : "Leaderboard"}
        </Link>
      </div>
    </div>
  );
}
