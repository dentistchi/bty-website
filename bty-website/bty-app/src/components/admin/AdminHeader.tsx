"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AdminHeader() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
      <Link href="/admin/quality" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
        Quality Events
      </Link>
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
