/** @vitest-environment jsdom */
/**
 * OrbLiving — explicit INTERACTIVE-READY contract (Slice 3.1B-3N-5D.1C-H).
 *
 * The Orb must never present as interactive before its first valid touch can be accepted. The
 * readiness state derives from REAL state (canvas + attached pointer handlers), never a timeout,
 * and emits a one-shot, privacy-safe `orb-interactive-ready` signal (window event + `__btyOrbReadyAt`
 * timestamp + `<html data-orb-interactive-ready>`) so the native shell can correlate web-ready vs the
 * first native touch (Gate H5). When the canvas is unavailable (no handlers), readiness stays false.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import OrbLiving from "./OrbLiving";

const realGetContext = HTMLCanvasElement.prototype.getContext;

function stubCanvas(ctx: unknown) {
  // Synchronous effect path touches ctx.scale (orb) + fctx.setTransform (field); the rAF draw is
  // stubbed to a no-op so nothing else is invoked.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof realGetContext;
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  if (!window.matchMedia) vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
}

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-orb-interactive-ready");
  delete (window as unknown as { __btyOrbReadyAt?: number }).__btyOrbReadyAt;
});
beforeEach(() => {
  document.documentElement.removeAttribute("data-orb-interactive-ready");
  delete (window as unknown as { __btyOrbReadyAt?: number }).__btyOrbReadyAt;
});

describe("OrbLiving — interactive-ready contract", () => {
  it("(3) flips interactive-ready to true only after the mount effect attaches handlers", async () => {
    stubCanvas({ scale: vi.fn(), setTransform: vi.fn() });
    render(<OrbLiving size={220} holdMs={3000} onCommit={() => {}} />);
    const orb = screen.getByTestId("orb-living");
    await waitFor(() => expect(orb.getAttribute("data-orb-interactive-ready")).toBe("1"));
    expect(document.documentElement.getAttribute("data-orb-interactive-ready")).toBe("1");
  });

  it("(H5) emits the orb-interactive-ready signal exactly once with a timestamp", async () => {
    const onReady = vi.fn();
    window.addEventListener("orb-interactive-ready", onReady);
    stubCanvas({ scale: vi.fn(), setTransform: vi.fn() });
    render(<OrbLiving size={220} holdMs={3000} onCommit={() => {}} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(typeof (window as unknown as { __btyOrbReadyAt?: number }).__btyOrbReadyAt).toBe("number");
    window.removeEventListener("orb-interactive-ready", onReady);
  });

  it("(5) does not auto-commit on mount (no navigation without a valid press)", async () => {
    const onCommit = vi.fn();
    stubCanvas({ scale: vi.fn(), setTransform: vi.fn() });
    render(<OrbLiving size={220} holdMs={3000} onCommit={onCommit} />);
    await waitFor(() => expect(screen.getByTestId("orb-living").getAttribute("data-orb-interactive-ready")).toBe("1"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("(4) stays NOT-ready and emits no signal when the canvas is unavailable (no handlers)", async () => {
    const onReady = vi.fn();
    window.addEventListener("orb-interactive-ready", onReady);
    stubCanvas(null); // getContext('2d') → null → fallback presence, no pointer handlers
    render(<OrbLiving size={220} holdMs={3000} onCommit={() => {}} />);
    // give effects a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId("orb-living").getAttribute("data-orb-interactive-ready")).toBe("0");
    expect(onReady).not.toHaveBeenCalled();
    expect((window as unknown as { __btyOrbReadyAt?: number }).__btyOrbReadyAt).toBeUndefined();
    window.removeEventListener("orb-interactive-ready", onReady);
  });

  it("clears the <html> readiness marker on unmount (next mount re-emits)", async () => {
    stubCanvas({ scale: vi.fn(), setTransform: vi.fn() });
    const { unmount } = render(<OrbLiving size={220} holdMs={3000} onCommit={() => {}} />);
    await waitFor(() => expect(document.documentElement.getAttribute("data-orb-interactive-ready")).toBe("1"));
    unmount();
    expect(document.documentElement.getAttribute("data-orb-interactive-ready")).toBeNull();
  });
});
