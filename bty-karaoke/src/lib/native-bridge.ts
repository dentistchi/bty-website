// Capability-based detection of the BTY native host — NEVER user-agent guessing.
//
// The canonical production path is the iPhone native app, which embeds the Admin in a
// WKWebView and hands YouTube off to the external YouTube app (preserving Admin state and
// the app's existing TV/Cast connection). Normal web browsers have no such bridge and use
// the same-origin BTY Player instead.
//
// The native app opts in by exposing ONE of these capabilities into the WebView (either is
// accepted; both are capability probes, not UA strings):
//   1. window.__BTY_NATIVE__ = { openYouTube({ videoId, url }) { … } }
//   2. an iOS WKScriptMessageHandler named `btyYouTube` (or `openYouTube`) — i.e.
//      window.webkit.messageHandlers.btyYouTube.postMessage({ videoId, url })
// Mobile Safari does NOT expose webkit.messageHandlers, so its presence indicates an
// app-embedded WebView, not merely an iOS device.

export interface NativeYouTubePayload {
  videoId: string;
  url: string;
}

interface NativeBridge {
  openYouTube: (p: NativeYouTubePayload) => void;
}

type NativeWindow = {
  __BTY_NATIVE__?: { openYouTube?: (p: NativeYouTubePayload) => void };
  webkit?: {
    messageHandlers?: Record<string, { postMessage?: (m: unknown) => void } | undefined>;
  };
};

function resolveNativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as NativeWindow;

  // 1) Explicit capability object injected by the native app.
  const g = w.__BTY_NATIVE__;
  if (g && typeof g.openYouTube === 'function') {
    return { openYouTube: (p) => g.openYouTube!(p) };
  }

  // 2) iOS WKWebView script-message handler (capability-detected, not UA-sniffed).
  const handlers = w.webkit?.messageHandlers;
  const mh = handlers?.btyYouTube ?? handlers?.openYouTube;
  if (mh && typeof mh.postMessage === 'function') {
    return { openYouTube: (p) => mh.postMessage!(p) };
  }

  return null;
}

/** True iff the page runs inside the BTY native host (a bridge capability is present). */
export function isNativeHost(): boolean {
  return resolveNativeBridge() !== null;
}

/**
 * Dispatch the external YouTube handoff through the native bridge. Returns true when a native
 * bridge accepted it (it opens the YouTube app, reuses the TV/Cast connection, and preserves
 * the Admin WebView). Returns false when there is no native bridge (a web browser) — the
 * caller then uses the same-origin BTY Player instead.
 */
export function nativeOpenYouTube(payload: NativeYouTubePayload): boolean {
  const bridge = resolveNativeBridge();
  if (!bridge) return false;
  try {
    bridge.openYouTube(payload);
    return true;
  } catch {
    return false;
  }
}
