/** @vitest-environment jsdom */
/**
 * OrbLiving — Haptics must NOT block the hold commit (Slice 3.1B-3N-5D.1C-L, Phase 3/7).
 *
 * The 5D.1C-L latency instrumentation is measurement-only; this test locks the pre-existing invariant
 * it is meant to confirm: the Capacitor Haptics call is fire-and-forget, so a cold-start Haptics that
 * REJECTS (or resolves slowly) can never delay or block the hold timer / commit / navigation. The hold
 * duration is honored and onCommit fires exactly once.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/native/isNative", () => ({ isNative: () => true }));
vi.mock("./orbGoldenOverlay", () => ({ setProgress: () => {}, commit: () => {}, clear: () => {} }));

import OrbLiving from "./OrbLiving";

const realGetContext = HTMLCanvasElement.prototype.getContext;

function stubCanvas() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ scale: vi.fn(), setTransform: vi.fn() })) as unknown as typeof realGetContext;
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  if (!window.matchMedia) vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
}

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  document.documentElement.removeAttribute("data-orb-interactive-ready");
});
beforeEach(() => { document.documentElement.removeAttribute("data-orb-interactive-ready"); });

function pointerDown(canvas: Element) {
  const ev = new Event("pointerdown") as Event & { clientX: number; clientY: number; pointerId: number };
  ev.clientX = 110; ev.clientY = 110; ev.pointerId = 1;
  canvas.dispatchEvent(ev);
}

describe("OrbLiving — Haptics non-blocking commit", () => {
  it("commits after the hold even when Capacitor Haptics REJECTS, exactly once", async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const impact = vi.fn(() => Promise.reject(new Error("cold-init")));
    (window as unknown as { Capacitor?: unknown }).Capacitor = { Plugins: { Haptics: { impact } } };
    stubCanvas();

    render(<OrbLiving size={220} holdMs={50} onCommit={onCommit} />);
    const canvas = document.querySelector("canvas")!;
    pointerDown(canvas);
    expect(impact).toHaveBeenCalledTimes(1); // haptics requested (fire-and-forget)
    expect(onCommit).not.toHaveBeenCalled(); // not before the hold threshold

    vi.advanceTimersByTime(60); // past holdMs
    expect(onCommit).toHaveBeenCalledTimes(1); // commit fired despite the rejected haptics
  });

  it("a SLOW (never-resolving) Haptics does not extend the hold duration", async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const impact = vi.fn(() => new Promise<void>(() => {})); // never resolves
    (window as unknown as { Capacitor?: unknown }).Capacitor = { Plugins: { Haptics: { impact } } };
    stubCanvas();

    render(<OrbLiving size={220} holdMs={50} onCommit={onCommit} />);
    const canvas = document.querySelector("canvas")!;
    pointerDown(canvas);
    vi.advanceTimersByTime(49);
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2); // cross the 50ms threshold
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("interactive-ready still fires with the instrumentation present", async () => {
    stubCanvas();
    render(<OrbLiving size={220} holdMs={50} onCommit={() => {}} />);
    await waitFor(() => expect(document.documentElement.getAttribute("data-orb-interactive-ready")).toBe("1"));
  });
});
