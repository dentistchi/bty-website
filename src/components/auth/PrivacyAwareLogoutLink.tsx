"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { clearAllDeviceDrafts } from "@/lib/bty/foundry/device-draft-store";

/**
 * A Sign out link that also ends this device's unfinished learner drafts (Slice R4-R5C4A-R2).
 *
 * Two sign-out affordances reach `/bty/logout` as ordinary links, and that route is handled
 * entirely in middleware — it clears cookies and nothing else, so before this component the
 * device kept the previous learner's unfinished private text. The two JS sign-outs
 * (`signOutAccount`, `LogoutButton`) already purged; this gives the remaining two the same
 * boundary without touching the route they use.
 *
 * IT IS STILL A LINK, AND THAT IS THE POINT.
 * ------------------------------------------
 * `preventDefault` is never called and navigation is never re-implemented. The handler does one
 * synchronous thing and returns, and the browser then follows the href exactly as it always did:
 * same destination, same middleware, same accessibility, same keyboard behaviour, and modified
 * clicks (cmd/ctrl/shift/middle) keep opening a new tab or window as before.
 *
 * WHY EVERY CLICK PURGES, INCLUDING A MODIFIED ONE. There is no navigation to intercept, so
 * there is nothing to branch on. A cmd-click opens the logout route in a new tab, which clears
 * the session cookies for the whole browser — the person signed out either way, and localStorage
 * is shared across tabs of one origin. Purging on every click is therefore both simpler and more
 * truthful than guessing which clicks "really" meant it.
 *
 * The purge is best-effort by construction (see `device-draft-store`), so a browser that refuses
 * storage still signs out normally. Nothing here can block or delay a logout.
 */
export default function PrivacyAwareLogoutLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      data-testid="privacy-aware-logout"
      onClick={() => {
        // No preventDefault: purge, then let the browser do what it was always going to do.
        clearAllDeviceDrafts();
      }}
    >
      {children}
    </Link>
  );
}
