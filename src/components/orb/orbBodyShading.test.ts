import { describe, it, expect, vi } from "vitest";
import { drawOrbBodyShading } from "./orbBodyShading";

/**
 * Lab-only body-shading helper (STEP 2). These tests verify the pure canvas contract only —
 * NO production/OrbLiving behavior is asserted here. A hand-rolled minimal 2D-context mock is
 * used (jsdom does not implement a real canvas 2D backend), recording the call sequence.
 */
function makeMockCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    save: vi.fn(() => calls.push("save")),
    restore: vi.fn(() => calls.push("restore")),
    beginPath: vi.fn(() => calls.push("beginPath")),
    arc: vi.fn(() => calls.push("arc")),
    clip: vi.fn(() => calls.push("clip")),
    fill: vi.fn(() => calls.push("fill")),
    fillRect: vi.fn(() => calls.push("fillRect")),
    createRadialGradient: vi.fn(() => {
      calls.push("createRadialGradient");
      return gradient;
    }),
    createLinearGradient: vi.fn(() => {
      calls.push("createLinearGradient");
      return gradient;
    }),
    globalCompositeOperation: "source-over" as string,
    fillStyle: "" as unknown,
  };
  return { ctx, calls, gradient };
}

describe("drawOrbBodyShading — lab-only volumetric body pass", () => {
  it("is importable and callable, and does not throw with a minimal 2D context", () => {
    const { ctx } = makeMockCtx();
    expect(() =>
      drawOrbBodyShading(ctx as unknown as CanvasRenderingContext2D, { cx: 110, cy: 110, radius: 92 }),
    ).not.toThrow();
  });

  it("uses canvas drawing primitives (gradients + fills), clips to the body, and balances save/restore", () => {
    const { ctx, calls } = makeMockCtx();
    drawOrbBodyShading(ctx as unknown as CanvasRenderingContext2D, { cx: 110, cy: 110, radius: 92 });
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    // Perfectly balanced (no leaked save state).
    expect(ctx.save.mock.calls.length).toBe(ctx.restore.mock.calls.length);
    // Shading is confined to the body disk.
    expect(ctx.clip).toHaveBeenCalled();
    // It actually draws (gradients + fills), not a no-op.
    expect(calls.some((c) => c === "createRadialGradient" || c === "createLinearGradient")).toBe(true);
    expect(calls.filter((c) => c === "fill" || c === "fillRect").length).toBeGreaterThan(0);
  });

  it("restores globalCompositeOperation to source-over (never leaves 'lighter'/'destination-over')", () => {
    const { ctx } = makeMockCtx();
    drawOrbBodyShading(ctx as unknown as CanvasRenderingContext2D, { cx: 10, cy: 10, radius: 40 });
    expect(ctx.globalCompositeOperation).toBe("source-over");
  });

  it("no-ops safely on a non-positive radius (draws nothing, touches no state)", () => {
    const { ctx } = makeMockCtx();
    drawOrbBodyShading(ctx as unknown as CanvasRenderingContext2D, { cx: 10, cy: 10, radius: 0 });
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("is pure/deterministic — same params → identical call sequence (no randomness/time/DOM)", () => {
    const a = makeMockCtx();
    const b = makeMockCtx();
    drawOrbBodyShading(a.ctx as unknown as CanvasRenderingContext2D, { cx: 50, cy: 50, radius: 60 });
    drawOrbBodyShading(b.ctx as unknown as CanvasRenderingContext2D, { cx: 50, cy: 50, radius: 60 });
    expect(a.calls).toEqual(b.calls);
  });

  it("honours per-effect disable flags (grounding/limb/bottom/specular = 0)", () => {
    const { ctx, calls } = makeMockCtx();
    drawOrbBodyShading(ctx as unknown as CanvasRenderingContext2D, {
      cx: 50,
      cy: 50,
      radius: 60,
      grounding: 0,
      limb: 0,
      bottom: 0,
      specular: 0,
    });
    // All effects disabled → only save + clip scaffold, no gradient draws.
    expect(calls.filter((c) => c === "createRadialGradient" || c === "createLinearGradient").length).toBe(0);
    expect(calls.filter((c) => c === "fill" || c === "fillRect").length).toBe(0);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
