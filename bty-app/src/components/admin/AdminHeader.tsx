"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AdminHeader() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
      <nav className="flex items-center gap-4">
        <Link href="/admin/arena-membership" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          Arena 승인
        </Link>
        <Link href="/admin/users" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          사용자 관리
        </Link>
        <Link href="/admin/organizations" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          조직
        </Link>
        <Link href="/admin/debug" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          디버깅
        </Link>
        <Link href="/admin/quality" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
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
