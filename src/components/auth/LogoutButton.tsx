"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { clearNativeSession } from "@/lib/native/durableSession";
import { clearAllDeviceDrafts } from "@/lib/bty/foundry/device-draft-store";

export function LogoutButton() {
  const pathname = usePathname() ?? "";
  const locale: Locale = pathname.startsWith("/ko") ? "ko" : "en";
  const label = getMessages(locale).logout;

  const onLogout = useCallback(async () => {
    // #20: revoke the Supabase session server-side (auth.signOut) + clear cookies.
    // The old `/bty/logout` path only expired cookies, leaving the Supabase
    // session live so the next OAuth click silently re-authenticated.
    // STEP A2 — clear the iOS Keychain durable session so relaunch after logout
    // requires Google again (no silent restore). No-op on web.
    await clearNativeSession();
    try {
      await fetch(`/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // Network failure: still navigate to the login page (cookies may persist;
      // surfaced to the user as a logged-out screen rather than a hang).
    }
    /*
      R4-R5C4A-R1 — the second JS-reachable sign-out. `signOutAccount` (the Me tab) purges
      device-local drafts; this button tears the session down its own way and would otherwise
      leave the previous learner's unfinished private text readable on the device. Best-effort
      and unconditional here: unlike `signOutAccount` this path navigates even when the server
      call failed, so it always ends as a sign-out from the person's point of view.
    */
    clearAllDeviceDrafts();
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
