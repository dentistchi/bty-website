/**
 * /start-local navy launch surface (Native Launch Seam STEP 1).
 *
 * The quiet full-viewport BTY-navy surface shown for EVERY pre-Orb wait on /start — the
 * Suspense fallback, the auth-loading window, and the transient pre-redirect frame. It replaces
 * the white PageLoadingFallback seam (⏳ / "Please wait…" / skeleton bars) so the launch reads as
 * one continuous native surface: iOS navy LaunchScreen → this navy web surface → the existing
 * Golden Master Orb.
 *
 * Deliberately mirrors StartShellClient's existing "Better Than Yesterday" splash treatment (same
 * <main> classes, same brand line) — no new copy, typography, animation, or branding. Static and
 * reduced-motion-safe: no spinner, hourglass, skeleton, shimmer, or loading copy. Presentational
 * only (no hooks, no state) so BOTH the server page (Suspense fallback) and the client shell can
 * render the SAME surface, keeping all three pre-Orb frames byte-consistent and drift-free.
 */
export function StartNavySurface() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bty-navy px-6 text-white">
      <p className="text-xs uppercase tracking-[0.32em] text-white/55">Better Than Yesterday</p>
    </main>
  );
}
