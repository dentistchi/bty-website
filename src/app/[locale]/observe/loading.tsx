/**
 * Observer route STREAMING FALLBACK (Slice R4-R1B).
 *
 * The page is `force-dynamic` — correctly, since it is auth-gated and must never be cached — so
 * there is a real server round-trip when the reviewer taps a card, and whatever sits here is
 * genuinely seen. Before this file the nearest boundary was `[locale]/loading.tsx`: cream, ⏳,
 * skeleton bars, and a hint about the first load taking one to two minutes. Inside the native
 * app that reads as the web bootstrapping, not as a screen opening.
 *
 * Deliberately quieter than the segment it replaces. No spinner, no skeleton, no
 * "may take 1–2 minutes" — this is a one-hop navigation the reviewer just initiated, and
 * furniture promising a long wait invents one. Just the destination's own background and a
 * single calm line, mirroring `/{locale}/app`'s "Opening BTY…".
 *
 * NOT locale-aware, and that is on purpose: `[locale]/loading.tsx` reads the locale off the
 * pathname to pick copy, which is a client component and one more thing to hydrate on the seam
 * this file exists to remove. A single neutral word costs nothing to render and is legible in
 * both languages the app ships.
 */
export default function ObserveLoading() {
  return (
    <div
      data-bty-observe-loading="1"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B1220",
        color: "rgba(255,255,255,0.4)",
        fontFamily: "-apple-system, system-ui, sans-serif",
        fontSize: 13,
        letterSpacing: "0.02em",
      }}
    >
      …
    </div>
  );
}
