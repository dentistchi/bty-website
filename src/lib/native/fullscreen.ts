/**
 * Fullscreen capability helper (Immersive Learning V1 — fullscreen repair).
 *
 * The Fullscreen API is NOT uniform across platforms. Desktop Chromium/Firefox and
 * iPadOS Safari implement `Element.requestFullscreen()` (or the `webkit`-prefixed
 * form); iPhone Safari and the installed Capacitor **WKWebView** do NOT support
 * arbitrary-element fullscreen at all (only `HTMLVideoElement.webkitEnterFullscreen`,
 * which is unreachable for a cross-origin YouTube iframe). So a single assumed API
 * silently no-ops on the Commander's device.
 *
 * This helper picks by CAPABILITY and returns a typed result. The request is always
 * INITIATED SYNCHRONOUSLY so it stays inside the user-gesture call stack. When no
 * native path exists (or it rejects), `onFallback` fires so the caller can enter a
 * controlled in-app immersive mode instead of failing silently. Errors are surfaced
 * (dev-only, safe diagnostics) — never swallowed.
 */

export type FullscreenResult = "native_fullscreen" | "immersive_fallback" | "failed";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => unknown;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => unknown;
};

function devWarn(message: string, err?: unknown): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  const detail = err instanceof Error ? err.message : "";
  // Safe: only a static message + the error's own message — no user data.
  console.warn("[fullscreen]", message, detail);
}

/** The element currently in native fullscreen (standard or webkit), if any. */
export function currentFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FullscreenDocument;
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** True when SOME element is in native fullscreen right now. */
export function isNativeFullscreenActive(): boolean {
  return currentFullscreenElement() != null;
}

/**
 * Try to put `el` into native fullscreen. MUST be called synchronously inside the
 * tap/click handler (no awaited work before it) or the gesture is lost.
 *
 * Order: standard `requestFullscreen` → `webkitRequestFullscreen` → give up to the
 * caller's immersive fallback. `onFallback` is invoked exactly once whenever native
 * fullscreen is unavailable OR the native request rejects. Never throws.
 */
export function enterFullscreen(el: HTMLElement | null, onFallback: () => void): Promise<FullscreenResult> {
  if (!el) return Promise.resolve("failed");
  const e = el as FullscreenElement;

  if (typeof e.requestFullscreen === "function") {
    try {
      // requestFullscreen() is initiated synchronously here (gesture preserved);
      // only the RESULT is awaited.
      return Promise.resolve(e.requestFullscreen())
        .then<FullscreenResult>(() => "native_fullscreen")
        .catch((err): FullscreenResult => {
          devWarn("native requestFullscreen rejected → immersive fallback", err);
          onFallback();
          return "immersive_fallback";
        });
    } catch (err) {
      devWarn("native requestFullscreen threw → immersive fallback", err);
      onFallback();
      return Promise.resolve("immersive_fallback");
    }
  }

  if (typeof e.webkitRequestFullscreen === "function") {
    try {
      e.webkitRequestFullscreen();
      return Promise.resolve("native_fullscreen");
    } catch (err) {
      devWarn("webkitRequestFullscreen threw → immersive fallback", err);
      onFallback();
      return Promise.resolve("immersive_fallback");
    }
  }

  // No element-fullscreen support (iPhone Safari / WKWebView) → immersive fallback.
  devWarn("no native element-fullscreen API → immersive fallback");
  onFallback();
  return Promise.resolve("immersive_fallback");
}

/** Exit native fullscreen (standard or webkit). No-op if not in fullscreen. */
export function exitNativeFullscreen(): void {
  if (typeof document === "undefined") return;
  const d = document as FullscreenDocument;
  try {
    if (document.exitFullscreen && document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (d.webkitExitFullscreen && d.webkitFullscreenElement) {
      d.webkitExitFullscreen();
    }
  } catch (err) {
    devWarn("exitFullscreen threw", err);
  }
}
