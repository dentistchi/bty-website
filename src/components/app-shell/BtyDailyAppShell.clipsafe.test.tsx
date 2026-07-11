/** @vitest-environment jsdom */
/**
 * Signature Door Material V3.1 — horizontal clip correction. Structural guarantees only (jsdom
 * cannot measure paint clipping): the wide reach moved to a symmetric edge-faded group atmosphere,
 * the card-local halo stays, no overflow-hidden / horizontal-scroll / negative-translate hack was
 * introduced, and the perimeter stays inside the bounded card. No visual-success claim.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { AFFORDANCE_START_MS, COPY, TodaySurface, selectTodayStatus } from "@/components/app-shell/BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderToday(over: Partial<React.ComponentProps<typeof TodaySurface>> = {}) {
  return render(
    <TodaySurface copy={COPY.en.today} statusLine={selectTodayStatus("en", "scenario_signal")} activeFocus={null} loading={false} promiseText={null} centerKeepLine={null} firstArrival {...over} />,
  );
}
const atStart = () => {
  vi.useFakeTimers();
  const r = renderToday();
  act(() => void vi.advanceTimersByTime(AFFORDANCE_START_MS));
  return r.container;
};

describe("horizontal clip correction", () => {
  it("4/5. group atmosphere is separate and uses a SYMMETRIC horizontal edge fade (dissolves both sides)", () => {
    const container = atStart();
    const aurora = container.querySelector<HTMLElement>("[data-aurora]")!;
    const mask = String(aurora.style.getPropertyValue("-webkit-mask-image") || (aurora.style as CSSStyleDeclaration).webkitMaskImage || aurora.style.maskImage || "");
    expect(mask).toContain("linear-gradient(to right");
    expect(mask).toContain("transparent 0%");
    expect(mask).toContain("transparent 100%");
    // symmetric stops (X% and 100-X%)
    expect(mask).toContain("12%");
    expect(mask).toContain("88%");
    expect(aurora.className).toContain("z-0"); // still the separate z-0 field
  });

  it("6. no negative translation is used to hide the defect (atmosphere + door cells)", () => {
    const container = atStart();
    expect(container.querySelector("[data-aurora]")!.className).not.toMatch(/-translate-x/);
    for (const cell of container.querySelectorAll('[data-focus]')) {
      expect(cell.closest(".grid")!.className).not.toMatch(/-translate-x/);
    }
  });

  it("7/8. no overflow-hidden / horizontal-scroll surface introduced around the signature group", () => {
    const container = atStart();
    const group = container.querySelector<HTMLElement>("[data-aurora]")!.parentElement!;
    expect(group.className).toContain("isolate");
    expect(group.className).not.toContain("overflow-hidden");
    expect(group.className).not.toMatch(/overflow-x-(auto|scroll|hidden)/);
    // no descendant of the group re-introduces horizontal scrolling
    expect(group.querySelectorAll('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]').length).toBe(0);
  });

  it("1/3. card-local halo remains on the door cell; perimeter stays INSIDE the bounded card", () => {
    const container = atStart();
    // card-local depth still present per door
    expect(container.querySelectorAll("[data-door-halo].btyHalo").length).toBe(3);
    // perimeter overlay is inset-0 inside the overflow-hidden card button (not the outer halo)
    for (const p of container.querySelectorAll<HTMLElement>("[data-perimeter]")) {
      expect(p.className).toContain("inset-0");
      expect(p.closest("button[data-focus]")).not.toBeNull();
    }
  });

  it("9. scale layer remains equal on all three doors (unchanged)", () => {
    const container = atStart();
    expect(container.querySelectorAll("button.btyAffordScale").length).toBe(3);
  });
});
