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

/**
 * WE COULD NOT REACH BTY (Slice R4-R4B-R1).
 *
 * The same navy surface, but with something to press. Before this, a boot request that never
 * settled left the launch on the quiet brand frame indefinitely — no error, no control, and no way
 * to tell a slow network from a broken app.
 *
 * IT DOES NOT SAY "SIGNED OUT", because we do not know that. The bound expiring means the server
 * never answered; it is not a reply. Retrying re-runs the same session resolution the launch
 * already uses — nothing here clears a cookie, drops a session or routes to login.
 */
export function StartUnreachableSurface({
  locale,
  onRetry,
  retrying = false,
}: {
  locale: "en" | "ko";
  onRetry: () => void;
  retrying?: boolean;
}) {
  const ko = locale === "ko";
  return (
    <main
      data-testid="start-unreachable"
      className="relative flex min-h-screen flex-col items-center justify-center gap-5 bg-bty-navy px-6 text-white"
    >
      <p className="text-xs uppercase tracking-[0.32em] text-white/55">Better Than Yesterday</p>
      <p className="text-center text-[0.95rem] leading-6 text-white/70">
        {ko ? "BTY에 연결하지 못했습니다." : "Couldn’t reach BTY."}
      </p>
      {/*
        THE QUESTION A PERSON ACTUALLY HAS HERE (Slice R4-R4B-R1).

        "Couldn't reach BTY" says what happened and the button says what to do, but it left the
        third question unanswered — and it is the one that frightens people: is my account still
        there? Silence invited them to assume the worst and sign in again, which is the outcome
        this whole surface exists to avoid. It is also a claim we can honestly make: nothing on
        this path clears a cookie, a session or a stored credential.
      */}
      <p className="text-center text-[0.95rem] leading-6 text-white/55">
        {ko ? "계정은 그대로 있습니다. 연결 상태를 확인해 주세요." : "Your account is safe. Check your connection."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        data-testid="start-unreachable-retry"
        className="min-h-[44px] rounded-xl bg-[#C9A66B] px-6 py-3 text-sm font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
      >
        {retrying ? (ko ? "다시 시도하는 중…" : "Retrying…") : ko ? "다시 시도" : "Retry"}
      </button>
    </main>
  );
}
