"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";

export function LogoutButton() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
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
      로그아웃
    </button>
  );
}

export default LogoutButton;
