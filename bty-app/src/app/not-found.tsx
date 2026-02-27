import Link from "next/link";

export const metadata = { title: "페이지를 찾을 수 없습니다 | Dear Me" };

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-2">페이지를 찾을 수 없습니다</h1>
      <p className="text-gray-600 mb-2">주소가 잘못되었거나 페이지가 없습니다.</p>
      <p className="text-gray-500 text-sm mb-6">
        로컬에서 실행 중이라면 <strong>/en</strong> 또는 <strong>/ko</strong> 로 시작하는 주소를 사용해 보세요.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link href="/en" className="text-blue-600 underline">
          Home (EN)
        </Link>
        <Link href="/ko" className="text-blue-600 underline">
          홈 (KO)
        </Link>
        <Link href="/en/bty/login" className="text-blue-600 underline">
          로그인 (EN)
        </Link>
        <Link href="/en/bty/dashboard" className="text-blue-600 underline">
          Dashboard
        </Link>
        <Link href="/ko/bty/dashboard" className="text-blue-600 underline">
          대시보드
        </Link>
      </div>
    </div>
  );
}
