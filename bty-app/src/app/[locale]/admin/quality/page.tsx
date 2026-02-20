"use client";

import Link from "next/link";

/** Canonical route for "Quality Events" in Admin. /admin/quality is the only quality route; no redirect. */
export default function AdminQualityPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Admin Quality</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Quality Events 대시보드입니다.
          </p>
        </div>
        <Link
          href="/admin/debug"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          디버깅
        </Link>
      </div>

      <div className="space-y-6">
        <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-medium text-neutral-900">Quality Events 로그(예정)</h2>
          <p className="text-sm text-neutral-600">
            이 섹션에서는 품질 이벤트 로그를 조회·관리할 수 있습니다. 데이터 연동은 추후 제공될 예정입니다.
          </p>
        </div>

        <div className="rounded border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <p>
            <Link href="/admin/users" className="underline hover:text-neutral-900">사용자 관리</Link>
            {" · "}
            <Link href="/admin/organizations" className="underline hover:text-neutral-900">조직</Link>
            {" · "}
            <Link href="/admin/debug" className="underline hover:text-neutral-900">디버깅</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
