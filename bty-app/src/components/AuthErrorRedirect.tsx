"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Intercepts Supabase auth error hashes that land on the site root
 * (e.g. #error_code=otp_expired) and redirects to the reset-password page
 * where they are handled with proper UI.
 */
export function AuthErrorRedirect() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;

    const params: Record<string, string> = {};
    for (const pair of hash.slice(1).split("&")) {
      const [k, v] = pair.split("=");
      if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v.replace(/\+/g, " ")) : "";
    }

    if (params.error_code === "otp_expired") {
      window.location.replace(`/${locale}/reset-password${hash}`);
    }
  }, [locale]);

  return null;
}
