import type { ReactNode } from "react";

/**
 * Teams Personal Tab frame. Slice A0.
 *
 * A SERVER-rendered navy floor, mirroring `/[locale]/app/layout.tsx` for the same measured reason:
 * a WebView that fails to execute the client bundle shows an empty body, and an empty body with a
 * transparent background paints the host's default WHITE. Inside Teams that reads as a broken app
 * rather than a slow one. This is in the SSR HTML unconditionally.
 *
 * It bypasses no auth: `/teams` is outside the middleware matcher by design (the tab carries no
 * cookie and must not be redirected to a login page it cannot complete inside a frame), and every
 * authenticated read still goes through the API, which authenticates the bearer.
 */
export default function TeamsTabLayout({ children }: { children: ReactNode }) {
  return (
    <div data-bty-teams-floor="1" style={{ minHeight: "100dvh", background: "#0B1F3A" }}>
      {children}
    </div>
  );
}
