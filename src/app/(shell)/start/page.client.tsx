"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import OrbLiving from "@/components/orb/OrbLiving";
import { isNative } from "@/lib/native/isNative";
import { StartNavySurface } from "./StartNavySurface";

/**
 * App Shell v0 — Threshold Door (Scope Lock §4 / spec §G). App Launch → Splash(0.5s) →
 * living OrbLiving door @220px. Tap/commit OPENS /today (navigation) — it does NOT
 * self-terminate into mini-Today. The Orb is the door; /today is the revealed room.
 *
 * Living door = OrbLiving (visual-only, haptic-free per §G). Data-free: no
 * daily-gate-check / relationship-pulse fetch, no server interpretation. Locale from
 * <html lang> (root layout sets it; defaults "ko") — /start is not under [locale].
 *
 * Haptic (§G, v0.1): the door chooses living visual presence over press-haptic; the
 * previous production Orb.tsx press-haptic is intentionally not used. OrbLiving adds NO
 * haptic (exclusivity sole-site remains Orb.tsx).
 */

type Phase = "splash" | "orb";

const SPLASH_MS = 500;
const HOLD_MS = 3000; // §G deliberate hold — STEP 5.2b: ~3s hold-to-enter. Progress builds the
// Orb enlargement + warm-golden entry light (OrbLiving); a brief tap stays a response (no nav).

function currentLocale(): string {
  return (typeof document !== "undefined" && document.documentElement.lang) || "ko";
}

/** [BTYOrbLatency] milestone log (Slice 3.1B-3N-5D.1C-L) — same contract as OrbLiving's helper.
 * console.log is bridged to native os_log by Capacitor. Diagnostics only; no user/url/session data. */
function logOrbLatency(phase: string): void {
  try {
    const p = typeof performance !== "undefined" ? performance : null;
    const now = p ? p.now() : 0;
    const epoch = (p && typeof p.timeOrigin === "number" ? p.timeOrigin : 0) + now;
    console.log(`[BTYOrbLatency][Web] ${phase} perfMs=${now.toFixed(1)} epochMs=${epoch.toFixed(0)}`);
  } catch {
    /* never block navigation */
  }
}

export default function StartShellClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("splash");
  const navigatedRef = React.useRef(false);

  // Slice 3.1B-3N-5D.1C-N3: mark the START SHELL as HYDRATED the instant this client component mounts
  // — BEFORE auth resolves, the 500ms splash, or the Orb. The native launch watchdog uses this as the
  // positive "the web is alive" progress signal, so a healthy-but-slow cold start (a slow first
  // WebProcess) is NOT misclassified as a blank document and force-reloaded. This runs regardless of
  // the loading/!user early return below (hooks run before return), so it fires even while auth is
  // still restoring. No user/session data; a plain hydration timestamp + a data flag. Cleared on true
  // page unload only (client SPA navigation keeps the same document, so the flag persists into Today).
  React.useEffect(() => {
    try {
      (window as unknown as { __btyStartShellReadyAt?: number }).__btyStartShellReadyAt =
        typeof performance !== "undefined" ? performance.now() : 0;
      document.documentElement.dataset.btyStartShellReady = "1";
    } catch {
      /* best-effort progress marker — never block startup */
    }
    const onUnload = () => {
      try {
        delete document.documentElement.dataset.btyStartShellReady;
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, []);

  // Client auth gate — redirect to the REAL login.
  React.useEffect(() => {
    if (loading || user) return;
    router.replace(`/${currentLocale()}/bty/login?next=${encodeURIComponent("/start")}`);
  }, [loading, user, router]);

  // splash(0.5s) → orb  (only once authenticated)
  React.useEffect(() => {
    if (loading || !user || phase !== "splash") return;
    const t = setTimeout(() => setPhase("orb"), SPLASH_MS);
    return () => clearTimeout(t);
  }, [loading, user, phase]);

  // Door → the day. Navigate-once guard (commit latches once per press). B2: the native
  // shell lands on its own app surface /{locale}/app (BtyDailyAppShell); web stays on
  // /{locale}/today. isNative() reads the existing BTYNative UA / Capacitor bridge signal
  // (no new UA detection). Locale comes from the SAME currentLocale() the web push uses —
  // zero change to locale resolution (guards the 4224599 locale regression). Never bare "/app".
  const openDay = React.useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    logOrbLatency("openDay-enter");
    const locale = currentLocale();
    const dest = isNative() ? `/${locale}/app` : `/${locale}/today`;
    logOrbLatency("navigation-requested"); // milestone only — the destination path is NOT logged
    router.push(dest);
  }, [router]);

  // Keyboard commit mirrors the pointer press-and-hold: Space/Enter must be HELD ≥ HOLD_MS;
  // an early keyup cancels. A quick key press does not open Today.
  const keyHoldRef = React.useRef<number | null>(null);
  const startKeyHold = React.useCallback(() => {
    if (keyHoldRef.current != null) return;
    keyHoldRef.current = window.setTimeout(() => {
      keyHoldRef.current = null;
      openDay();
    }, HOLD_MS);
  }, [openDay]);
  const cancelKeyHold = React.useCallback(() => {
    if (keyHoldRef.current != null) {
      clearTimeout(keyHoldRef.current);
      keyHoldRef.current = null;
    }
  }, []);
  React.useEffect(() => () => cancelKeyHold(), [cancelKeyHold]);

  // Native Launch Seam STEP 1: every pre-Orb wait shows the quiet navy surface (not the white
  // PageLoadingFallback), so the launch stays continuous navy → Orb. Auth timing is UNCHANGED —
  // this only swaps the visual of the loading/pre-redirect frames. The redirect itself is still
  // driven by the effect above; `!user` renders navy only until that replace() lands.
  if (loading) return <StartNavySurface />;
  if (!user) return <StartNavySurface />;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bty-navy px-6 text-white">
      {/* Splash (0.5s) — quiet brand moment, fixed copy. */}
      {phase === "splash" ? (
        <p className="text-xs uppercase tracking-[0.32em] text-white/55">Better Than Yesterday</p>
      ) : (
        // Threshold Door — living OrbLiving @220 (§G). Tap/commit opens /today. The canvas
        // is decorative (aria-hidden); role=button + keyboard here carry the accessible name
        // and activation. onCommit fires the door on touch/tap. No haptic.
        <div
          role="button"
          tabIndex={0}
          aria-label="Begin today (press and hold)"
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
              e.preventDefault();
              startKeyHold();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cancelKeyHold();
            }
          }}
          onBlur={cancelKeyHold}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            // iOS WKWebView: block the long-press selection/callout menu on the hold target
            // so the press-and-hold reaches the commit threshold uninterrupted. Non-visual.
            touchAction: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <OrbLiving size={220} holdMs={HOLD_MS} onCommit={openDay} />
        </div>
      )}
    </main>
  );
}
