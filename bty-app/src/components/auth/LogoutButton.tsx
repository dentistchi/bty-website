"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function LogoutButton() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/ko") ? "ko" : "en";
  const label = getMessages(locale).logout;

  const onLogout = useCallback(async () => {
    // #20: revoke the Supabase session server-side (auth.signOut) + clear cookies.
    // The old `/bty/logout` path only expired cookies, leaving the Supabase
    // session live so the next OAuth click silently re-authenticated.
    try {
      await fetch(`/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // Network failure: still navigate to the login page (cookies may persist;
      // surfaced to the user as a logged-out screen rather than a hang).
    }
    window.location.assign(`/${locale}/bty/login`);
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
