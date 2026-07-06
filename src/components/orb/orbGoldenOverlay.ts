"use client";

/**
 * orbGoldenOverlay — the warm-golden "entry light" for the Orb hold-to-enter (STEP 5.2b).
 *
 * A body-mounted, React-INDEPENDENT singleton. It is mounted on `document.body` so that:
 *  1. it has NO transformed ancestor (transform-immune, like the STEP 5.2a wave layer), and
 *  2. it PERSISTS across the client route change (Orb `/start` → `/today`): it ramps up while
 *     the user holds, and on commit it hands off — surviving the navigation. The recede is
 *     ARRIVAL-anchored (5.2b-fix): it HOLDS at peak until `location.pathname` reaches `/today`,
 *     then recedes over the freshly-mounted Today — so the blue `/start` + Orb are never
 *     re-revealed between commit and arrival ("from inside the light", no hard cut, never white).
 *
 * HARD FAILSAFE (Commander-required): a commit-anchored ~4s timeout force-removes the overlay
 * (and `console.warn`s, non-silently) if the normal fade/removal ever fails — so a stuck
 * full-screen overlay can NEVER visually lock the UI. `pointer-events:none` at all times.
 *
 * Colour is warm gold only (never `#fff`), so brightening reads as golden light, not a flash.
 */

const FADE_MS = 820; // recede over Today (ease-out; warm hue retained, only opacity falls)
const FAILSAFE_MS = 4000; // hard commit-anchored force-remove (timing UNCHANGED)
const PEAK = 0.94; // max opacity (never fully opaque → soft, not a hard cut)
const Z = 2147483000; // above app UI; pointer-events:none so it never intercepts
const ARRIVAL_SETTLE_MS = 150; // after /today lands, brief hold so Today paints under the light
const POLL_MS = 50; // arrival poll cadence (location.pathname → /today)

let el: HTMLDivElement | null = null;
let committed = false;
let removeTimer = 0;
let failsafeTimer = 0;
let arrivalTimer = 0; // pathname poll (commit → arrival at /today)
let settleTimer = 0; // brief hold after arrival, before recede

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
  if (arrivalTimer) {
    clearTimeout(arrivalTimer);
    arrivalTimer = 0;
  }
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = 0;
  }
  if (el && el.parentNode) el.parentNode.removeChild(el);
  el = null;
  committed = false;
}

/** Begin the recede over Today (called only AFTER arrival at /today + settle). */
function recede(): void {
  settleTimer = 0;
  if (!el || !committed) return;
  // ease-out; gradient colours are fixed warm gold → only opacity falls (no hue shift to white/grey).
  el.style.transition = `opacity ${FADE_MS}ms ease-out`;
  el.style.opacity = "0";
  removeTimer = window.setTimeout(finalize, FADE_MS + 140);
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
  d.style.opacity = String(PEAK); // HOLD at peak — do NOT fade yet (5.2b-fix).

  // HARD FAILSAFE — commit-anchored, timing UNCHANGED. Force-remove + non-silent warn if the
  // route never lands on /today (nav failure / auth redirect) or the recede is interrupted.
  failsafeTimer = window.setTimeout(() => {
    if (el) {
      console.warn("[orbGoldenOverlay] failsafe fired — entry light force-removed (arrival/recede did not complete)");
    }
    finalize();
  }, FAILSAFE_MS);

  // ARRIVAL-ANCHORED recede (5.2b-fix): the overlay HOLDS at peak until navigation actually
  // lands on /today, so the blue /start + Orb are never re-revealed between commit and arrival.
  // Poll location.pathname (no Today coupling); on match, settle briefly so Today paints under
  // the light, then recede.
  const poll = (): void => {
    arrivalTimer = 0;
    if (!el || !committed) return;
    if (typeof window !== "undefined" && window.location.pathname.includes("/today")) {
      settleTimer = window.setTimeout(recede, ARRIVAL_SETTLE_MS);
      return;
    }
    // ADDITIVE — BTY Daily App local-state entry (/[locale]/app). Entry there is a
    // local-state transition (no navigation; pathname stays /app), so the entry light
    // recedes over the freshly-shown Today exactly as the /today block above does. That
    // /today block is byte-unchanged; /start never reaches /app, so it is unaffected.
    if (typeof window !== "undefined" && window.location.pathname.includes("/app")) {
      settleTimer = window.setTimeout(recede, ARRIVAL_SETTLE_MS);
      return;
    }
    arrivalTimer = window.setTimeout(poll, POLL_MS);
  };
  arrivalTimer = window.setTimeout(poll, POLL_MS);
}

/**
 * Immediate teardown when NOT committed (e.g., fully rewound, or component unmount mid-hold).
 * A committed overlay is self-managing (survives unmount, recedes over Today) and is left alone.
 */
export function clear(): void {
  if (typeof document === "undefined" || committed) return;
  finalize();
}
