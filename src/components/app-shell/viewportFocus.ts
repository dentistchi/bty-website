/**
 * iOS post-action viewport reset (Slice 3.1B-3N-5C.4).
 *
 * On iOS WKWebView, focusing a form control auto-zooms the visual viewport; if the control still
 * holds focus when the view navigates away after a successful mutation, the zoom persists. Before
 * a CANONICAL SUCCESS navigation, blur the active control (dismissing the software keyboard) and
 * let one or two animation frames settle so the 1:1 viewport is restored — THEN run the callback.
 *
 * Do NOT call this on a validation "revise" (the form must stay open and keep focus on the invalid
 * field). Deterministic blur + up to two rAF boundaries — no arbitrary timeouts.
 */
export function blurActiveThen(cb: () => void): void {
  try {
    (document.activeElement as HTMLElement | null)?.blur?.();
  } catch {
    /* blur is best-effort */
  }
  const raf =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (f: FrameRequestCallback): number => setTimeout(() => f(0), 0) as unknown as number;
  raf(() => raf(() => cb()));
}
