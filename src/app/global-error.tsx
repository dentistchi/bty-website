"use client";

/**
 * App-level global error boundary (Next.js root).
 *
 * BTY Daily App P0: the native cold-reopen intermittently/deterministically rendered
 * a WHITE screen. There was NO error boundary anywhere in the app, so any client
 * render/hydration crash unmounted the whole tree → the WKWebView's default white,
 * with no recovery (native does a passive WebView load, no watchdog).
 *
 * This boundary does two things without hiding the issue:
 *  1. LOGS the exact crash — Capacitor forwards `console.error` to the Xcode console,
 *     so the reopen trigger (message + stack + digest) is captured on device.
 *  2. Renders a deterministic NON-WHITE (navy) fallback with a reopen action, so a
 *     crash is a recoverable screen instead of a dead white one.
 *
 * Diagnostic-first: this SURFACES the error (it is logged, and the digest is shown),
 * it does not mask it. Remove/trim once the root cause is fixed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.error("[BTYAppBoot] fatal render crash", {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
    });
  }
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1F3A",
          color: "#ffffff",
          fontFamily: "-apple-system, system-ui, sans-serif",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>다시 열어주세요</p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.55)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            앱을 여는 중 문제가 발생했습니다. 아래를 눌러 다시 시작해 주세요.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                reset();
              } catch {
                /* noop */
              }
              if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              appearance: "none",
              border: "1px solid rgba(201,166,107,0.4)",
              background: "rgba(201,166,107,0.15)",
              color: "#C9A66B",
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 22px",
              borderRadius: 14,
              cursor: "pointer",
            }}
          >
            다시 열기
          </button>
          {error?.digest ? (
            <p style={{ marginTop: 16, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
