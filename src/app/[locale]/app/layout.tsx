import type { ReactNode } from "react";

/**
 * Daily App launch FAILSAFE (STEP 6F).
 *
 * BtyDailyAppShell is a client component. On a native cold reopen the WKWebView can end
 * up with an empty body — no visible React render, and crucially NO thrown error (Web
 * Inspector: innerHTML present but innerText "", no <canvas>, elementFromPoint === body,
 * html/body background transparent). Because nothing throws, the client-side
 * `app/global-error.tsx` boundary never fires; and because the html/body background is
 * transparent, an empty body shows the WKWebView's default WHITE — the P0.
 *
 * This layout is a SERVER-rendered navy floor: it is in the SSR HTML unconditionally, so
 * even if the client bundle never executes / hydrates, /[locale]/app paints navy instead
 * of white. It does NOT bypass auth (middleware still gates /app before this renders),
 * and does not change Orb / Today / cards.
 *
 * It also DIAGNOSES the trigger: after deploy, if a reopen is now NAVY, the served SSR is
 * reaching the device (failure is client-side hydration/execution); if it is STILL WHITE,
 * the served SSR is NOT reaching the device (stale WKWebView document/snapshot → native
 * path). Verify in Web Inspector via `document.querySelector('[data-bty-app-floor]')`.
 */
export default function DailyAppLayout({ children }: { children: ReactNode }) {
  return (
    <div data-bty-app-floor="1" style={{ minHeight: "100dvh", background: "#0B1F3A" }}>
      {children}
    </div>
  );
}
