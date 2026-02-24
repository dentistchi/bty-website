"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function LogoutButton() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/ko") ? "ko" : "en";
  const label = getMessages(locale).logout;

  const onLogout = useCallback(() => {
    const next = encodeURIComponent(`/${locale}/bty`);
    window.location.assign(`/${locale}/bty/logout?next=${next}`);
  }, [locale]);

  return (
    <button
      type="button"
      onClick={onLogout}
      className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
    >
      {label}
    </button>
  );
}

export default LogoutButton;
