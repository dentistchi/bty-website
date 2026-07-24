/** @vitest-environment jsdom */
/**
 * blurActiveThen (Slice 3.1B-3N-5C.4) — iOS post-action viewport reset primitive: blur the active
 * control (dismiss keyboard) then run the callback after animation frames settle.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { blurActiveThen } from "./viewportFocus";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("blurActiveThen", () => {
  it("blurs the active element, then invokes the callback", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);
    const blurSpy = vi.spyOn(input, "blur");
    await new Promise<void>((resolve) => blurActiveThen(resolve));
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("still invokes the callback when nothing is focused", async () => {
    let called = false;
    await new Promise<void>((resolve) => blurActiveThen(() => { called = true; resolve(); }));
    expect(called).toBe(true);
  });
});
