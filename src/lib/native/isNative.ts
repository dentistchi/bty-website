/**
 * Native-shell detection for the hosted Capacitor WebView.
 *
 * Inner web code carries NO `@capacitor/*` dependency — the native runtime
 * injects `window.Capacitor` into the hosted remote origin, and the shell
 * appends `BTYNative` to the WebView user-agent. Both signals were confirmed
 * live in the iOS shell; the UA token is a deterministic fallback if the
 * bridge global is ever unavailable at call time.
 *
 * Returns false in every plain browser, so callers stay on the web path.
 */
export const isNative = (): boolean =>
  typeof window !== "undefined" &&
  (window.Capacitor?.isNativePlatform?.() === true ||
    (typeof navigator !== "undefined" && navigator.userAgent.includes("BTYNative")));

/** Minimal shape of the runtime-injected Capacitor bridge — no package import. */
type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Browser?: { open: (options: { url: string }) => Promise<void> };
    App?: {
      addListener: (
        eventName: "appUrlOpen",
        listener: (event: { url: string }) => void
      ) => Promise<{ remove: () => void }>;
    };
    /** Native iOS impact feedback (morning Orb pulse). `style` = ImpactStyle wire value ("LIGHT"). */
    Haptics?: { impact?: (o: { style: string }) => Promise<void> };
  };
};

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}
