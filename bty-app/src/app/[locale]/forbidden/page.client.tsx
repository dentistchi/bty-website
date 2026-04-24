"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ForbiddenPage() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">권한이 없습니다</h1>
      <p className="text-neutral-600 text-center mb-6">
        이 페이지에 접근할 수 있는 권한이 없습니다. 관리자에게 권한 요청을 하세요.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          aria-label="홈으로"
        >
          홈으로
        </Link>
        <Link
          href={`/${locale}/admin/login`}
          className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          aria-label="관리자 로그인"
        >
          관리자 로그인
        </Link>
      </div>
    </div>
  );
}
