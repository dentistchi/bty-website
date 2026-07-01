"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Orb } from "@/components/orb/Orb";
import { PageLoadingFallback } from "@/components/bty-arena";

/**
 * App Shell v0 — "Morning 30s": App Launch → Splash(0.5s) → Orb → Fade(~600ms) → Mini Today.
 * ONE route, ONE client phase machine. Phases = internal state, NOT separate routes.
 *
 * CRUX — Orb `onCommit` advances the ritual IN-PLACE (→ 'fade' → 'miniToday'). It does NOT
 * navigate, does NOT call useArenaEntryResolution, does NOT leave for /today's beginHref.
 * The Orb commits the ritual itself — "Orb in the right house."
 *
 * Auth — client gate mirroring /app, but redirects to the REAL /[locale]/bty/login
 * (NOT /app's broken /login). Locale read from <html lang> (root layout sets it; defaults "ko").
 *
 * Haptic — imports Orb.tsx as-is → only its internal triggerOrbHaptic (press arrival) fires.
 * NO vibrate on splash / fade / miniToday; commit is silent. Zero new vibrate site.
 */

type Phase = "splash" | "orb" | "fade" | "miniToday";

const SPLASH_MS = 500;
const FADE_MS = 600; // provisional, ease-out

export default function StartShellClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("splash");
  const [miniIn, setMiniIn] = React.useState(false);

  // Client auth gate (mirror /app) — redirect to the REAL login, not /app's broken /login.
  React.useEffect(() => {
    if (loading || user) return;
    const locale =
      (typeof document !== "undefined" && document.documentElement.lang) || "ko";
    router.replace(`/${locale}/bty/login?next=${encodeURIComponent("/start")}`);
  }, [loading, user, router]);

  // splash(0.5s) → orb  (only once authenticated)
  React.useEffect(() => {
    if (loading || !user || phase !== "splash") return;
    const t = setTimeout(() => setPhase("orb"), SPLASH_MS);
    return () => clearTimeout(t);
  }, [loading, user, phase]);

  // fade(~600ms) → miniToday
  React.useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => setPhase("miniToday"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // miniToday gentle fade-in
  React.useEffect(() => {
    if (phase !== "miniToday") return;
    const r = requestAnimationFrame(() => setMiniIn(true));
    return () => cancelAnimationFrame(r);
  }, [phase]);

  if (loading) return <PageLoadingFallback />;
  if (!user) return <div className="p-6">redirecting…</div>;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bty-navy px-6 text-white">
      {/* Splash (0.5s) — quiet brand moment, fixed copy. */}
      {phase === "splash" ? (
        <p className="text-xs uppercase tracking-[0.32em] text-white/55">Better Than Yesterday</p>
      ) : null}

      {/* Orb — mounted in 'orb' and 'fade'; fades out over FADE_MS on commit. */}
      {phase === "orb" || phase === "fade" ? (
        <div
          style={{ transition: `opacity ${FADE_MS}ms ease-out`, opacity: phase === "fade" ? 0 : 1 }}
        >
          {/* CRUX: commit advances the ritual in-place — no navigation, no beginHref. */}
          <Orb mode="morning" onCommit={() => setPhase("fade")} ariaLabel="Begin today" />
        </div>
      ) : null}

      {/* Mini Today — fixed placeholder copy only. No fetch / data / timezone / personalization. */}
      {phase === "miniToday" ? (
        <div
          className="text-center"
          style={{ transition: `opacity ${FADE_MS}ms ease-out`, opacity: miniIn ? 1 : 0 }}
        >
          <h1 className="text-2xl font-semibold text-white">Today begins.</h1>
          <p className="mt-2 text-sm text-white/70">Carry one thing today.</p>
        </div>
      ) : null}
    </main>
  );
}
