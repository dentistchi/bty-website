"use client";

/**
 * orbGoldenOverlay — the warm-golden "entry light" for the Orb hold-to-enter (STEP 5.2b).
 *
 * A body-mounted, React-INDEPENDENT singleton. It is mounted on `document.body` so that:
 *  1. it has NO transformed ancestor (transform-immune, like the STEP 5.2a wave layer), and
 *  2. it PERSISTS across the client route change (Orb `/start` → `/today`): it ramps up while
 *     the user holds, and on commit it hands off — surviving the navigation — then recedes over
 *     the freshly-mounted Today, revealing it "from inside the light" (no hard cut, never white).
 *
 * HARD FAILSAFE (Commander-required): a commit-anchored ~4s timeout force-removes the overlay
 * (and `console.warn`s, non-silently) if the normal fade/removal ever fails — so a stuck
 * full-screen overlay can NEVER visually lock the UI. `pointer-events:none` at all times.
 *
 * Colour is warm gold only (never `#fff`), so brightening reads as golden light, not a flash.
 */

const FADE_MS = 820; // commit recede over Today
const FAILSAFE_MS = 4000; // hard commit-anchored force-remove
const PEAK = 0.94; // max opacity (never fully opaque → soft, not a hard cut)
const Z = 2147483000; // above app UI; pointer-events:none so it never intercepts

let el: HTMLDivElement | null = null;
let committed = false;
let removeTimer = 0;
let failsafeTimer = 0;

function ensure(): HTMLDivElement {
  if (el) return el;
  const d = document.createElement("div");
  d.setAttribute("aria-hidden", "true");
  d.dataset.orbEntryLight = "1";
  d.style.cssText =
    `position:fixed;inset:0;pointer-events:none;z-index:${Z};opacity:0;` +
    "background:radial-gradient(circle at 50% 45%," +
    "rgba(246,224,176,1) 0%,rgba(214,176,116,0.94) 44%,rgba(170,126,70,0.86) 100%);";
  document.body.appendChild(d);
  el = d;
  return d;
}

function finalize(): void {
  if (removeTimer) {
    clearTimeout(removeTimer);
    removeTimer = 0;
  }
  if (failsafeTimer) {
    clearTimeout(failsafeTimer);
    failsafeTimer = 0;
  }
  if (el && el.parentNode) el.parentNode.removeChild(el);
  el = null;
  committed = false;
}

/**
 * Ramp opacity with hold progress (0→1); also drives the calm rewind when the caller feeds a
 * decreasing progress on early release. No-op once committed (the commit fade owns opacity).
 */
export function setProgress(p: number): void {
  if (typeof document === "undefined" || committed) return;
  const d = ensure();
  const e = Math.max(0, Math.min(1, p));
  d.style.transition = "opacity 90ms linear";
  d.style.opacity = String(PEAK * e * e); // ease-in: subtle early, strong late
}

/**
 * Commit: peak, persist through the route change, then recede over Today. Guarded by a hard
 * failsafe so the overlay can never be left stuck on screen.
 */
export function commit(): void {
  if (typeof document === "undefined" || committed) return;
  const d = ensure();
  committed = true;
  d.style.transition = "opacity 90ms linear";
  d.style.opacity = String(PEAK);
  // Two frames so PEAK paints before the recede starts (the nav fires this same tick).
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!el) return;
      el.style.transition = `opacity ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.opacity = "0";
    })
  );
  removeTimer = window.setTimeout(finalize, FADE_MS + 140);
  failsafeTimer = window.setTimeout(() => {
    if (el) {
      // Non-silent: surface that the normal recede did not complete.
      console.warn("[orbGoldenOverlay] failsafe fired — entry light force-removed (recede did not complete)");
    }
    finalize();
  }, FAILSAFE_MS);
}

/**
 * Immediate teardown when NOT committed (e.g., fully rewound, or component unmount mid-hold).
 * A committed overlay is self-managing (survives unmount, recedes over Today) and is left alone.
 */
export function clear(): void {
  if (typeof document === "undefined" || committed) return;
  finalize();
}
