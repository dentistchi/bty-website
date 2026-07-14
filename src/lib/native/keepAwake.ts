/**
 * Keep the screen awake while training plays (Immersive Learning V1).
 *
 * A training video is watched, not touched — so the screen must not sleep mid-
 * playback. Two independent strategies, both best-effort, both gracefully
 * degrading:
 *   1. Web Screen Wake Lock API (`navigator.wakeLock`) — modern WebKit/Chromium.
 *   2. Capacitor KeepAwake plugin — reached ONLY through the runtime-injected
 *      `window.Capacitor.Plugins` bridge (this web code carries no `@capacitor/*`
 *      dependency, matching `isNative.ts` / `durableSession.ts`).
 *
 * Nothing here throws. On any unsupported surface the caller simply gets a no-op
 * controller and playback proceeds normally.
 */

import { isNative } from "./isNative";

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };
type NavigatorWakeLock = {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/** The KeepAwake bridge shape, if the native shell registered the plugin. */
type KeepAwakeBridge = {
  keepAwake?: () => Promise<void>;
  allowSleep?: () => Promise<void>;
};

function keepAwakePlugin(): KeepAwakeBridge | null {
  if (!isNative() || typeof window === "undefined") return null;
  const plugins = (window.Capacitor?.Plugins ?? {}) as { KeepAwake?: KeepAwakeBridge };
  return plugins.KeepAwake ?? null;
}

export type WakeLockController = { release: () => void };

const NOOP: WakeLockController = { release: () => {} };

/**
 * Request that the screen stay awake. Returns a controller whose `release()`
 * relinquishes every lock acquired. Safe to call on the server or an unsupported
 * browser (returns a no-op). The web sentinel is re-acquired when the tab
 * returns to the foreground, since the platform auto-releases it on hide.
 */
export function keepScreenAwake(): WakeLockController {
  if (typeof window === "undefined") return NOOP;

  let released = false;
  let sentinel: WakeLockSentinelLike | null = null;
  const nav = navigator as Navigator & NavigatorWakeLock;

  const requestWeb = () => {
    if (released || !nav.wakeLock) return;
    nav.wakeLock
      .request("screen")
      .then((s) => {
        if (released) {
          void s.release().catch(() => {});
        } else {
          sentinel = s;
        }
      })
      .catch(() => {
        /* denied / unsupported — ignore */
      });
  };

  const onVisibility = () => {
    if (!released && document.visibilityState === "visible" && (!sentinel || sentinel.released)) {
      requestWeb();
    }
  };

  requestWeb();
  document.addEventListener("visibilitychange", onVisibility);

  // Native bridge (if present) — independent of the web lock.
  try {
    void keepAwakePlugin()?.keepAwake?.();
  } catch {
    /* ignore */
  }

  return {
    release() {
      if (released) return;
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        void sentinel?.release?.().catch(() => {});
      } catch {
        /* ignore */
      }
      sentinel = null;
      try {
        void keepAwakePlugin()?.allowSleep?.();
      } catch {
        /* ignore */
      }
    },
  };
}
