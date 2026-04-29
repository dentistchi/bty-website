"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function AdminHeader() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const base = `/${locale}/admin`;

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
      <nav className="flex items-center gap-4">
        <Link href={`${base}/arena-membership`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          Arena 승인
        </Link>
        <Link href={`${base}/mentor-requests`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          멘토 신청 승인
        </Link>
        <Link href={`${base}/users`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          사용자 관리
        </Link>
        <Link href={`${base}/organizations`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          조직
        </Link>
        <Link href={`${base}/debug`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          디버깅
        </Link>
        <Link href={`${base}/quality`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          Quality
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-xs text-neutral-500 hover:text-neutral-700"
      >
        Sign out
      </button>
    </header>
  );
}
