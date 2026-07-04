"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import OrbLiving from "@/components/orb/OrbLiving";
import { PageLoadingFallback } from "@/components/bty-arena";

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
const HOLD_MS = 1800; // §G deliberate hold — long enough (~3× the B-2 engage ease) for the
// secondary Influence Field to visibly gather toward the finger before the door opens Today.
// STEP 5 — brief Orb exit before the route change so Today feels opened BY the Orb, not routed to.
const EXIT_MS = 420;

function currentLocale(): string {
  return (typeof document !== "undefined" && document.documentElement.lang) || "ko";
}

export default function StartShellClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("splash");
  const [exiting, setExiting] = React.useState(false);
  const navigatedRef = React.useRef(false);

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

  // Door → Today. Navigate-once guard (commit latches once per press).
  // STEP 5 — bridge instead of a hard cut: the Orb light breathes outward + fades briefly,
  // THEN we navigate with ?enter=orb so Today echoes the light in. The navy background is
  // shared across /start and /today, so it never flashes during the swap. Reduced-motion →
  // navigate immediately (no exit animation). Haptic/routing/Orb tuning are untouched.
  const openToday = React.useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const target = `/${currentLocale()}/today?enter=orb`;
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push(target);
      return;
    }
    setExiting(true);
    window.setTimeout(() => router.push(target), EXIT_MS);
  }, [router]);

  // Keyboard commit mirrors the pointer press-and-hold: Space/Enter must be HELD ≥ HOLD_MS;
  // an early keyup cancels. A quick key press does not open Today.
  const keyHoldRef = React.useRef<number | null>(null);
  const startKeyHold = React.useCallback(() => {
    if (keyHoldRef.current != null) return;
    keyHoldRef.current = window.setTimeout(() => {
      keyHoldRef.current = null;
      openToday();
    }, HOLD_MS);
  }, [openToday]);
  const cancelKeyHold = React.useCallback(() => {
    if (keyHoldRef.current != null) {
      clearTimeout(keyHoldRef.current);
      keyHoldRef.current = null;
    }
  }, []);
  React.useEffect(() => () => cancelKeyHold(), [cancelKeyHold]);

  if (loading) return <PageLoadingFallback />;
  if (!user) return <div className="p-6">redirecting…</div>;

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
            // STEP 5 exit bridge — on commit the Orb breathes gently outward and fades over
            // EXIT_MS, then the route changes; the shared navy holds so nothing flashes.
            opacity: exiting ? 0 : 1,
            transform: exiting ? "scale(1.06)" : "scale(1)",
            transition:
              "opacity 420ms ease-out, transform 560ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "opacity, transform",
          }}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <OrbLiving size={220} holdMs={HOLD_MS} onCommit={openToday} />
        </div>
      )}
    </main>
  );
}
