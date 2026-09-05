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
/**
 * The Teams-hosted top rhythm, declared HERE and nowhere else (Slice TQ-3).
 *
 * This file is the only thing in the product that is Teams-by-construction — it exists at `/teams`
 * and renders nothing else — so the one host-specific visual value lives here rather than behind a
 * runtime host check inside a component every other host also renders. Standalone web, native and
 * desktop never mount this layout and never see the variable; their `--bty-host-top-floor` stays
 * unset and the shell's `max()` falls back to `0px`, which is exactly today's behaviour.
 *
 * WHY 16px AND NOT MORE. Teams' own header already supplies the separation a title bar owes; this
 * only stops BTY's navy from butting directly against it. Measured: the tab's usable viewport is
 * 773px, so this spends 2% of the visible height and the first heading still lands well inside the
 * first screen. It is spacing, not an inset — nothing here pretends a notch exists.
 */
const TEAMS_HOST_TOP_FLOOR = "16px";

export default function TeamsTabLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-bty-teams-floor="1"
      style={
        {
          minHeight: "100dvh",
          background: "#0B1F3A",
          "--bty-host-top-floor": TEAMS_HOST_TOP_FLOOR,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
