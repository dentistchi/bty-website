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
    // transparent PLATEAUS to 9.5% and from 90.5% (symmetric), opaque 19%..81%
    // jsdom serializes #000 as rgb(0, 0, 0)
    const opaque = mask.includes("#000") ? "#000" : "rgb(0, 0, 0)";
    expect(mask).toContain("transparent 0%");
    expect(mask).toContain("transparent 9.5%");
    expect(mask).toContain(`${opaque} 19%`);
    expect(mask).toContain(`${opaque} 81%`);
    expect(mask).toContain("transparent 90.5%");
    expect(mask).toContain("transparent 100%");
    // symmetric: the two transparent-plateau edges sum to 100 (9.5 + 90.5), opaque stops 19/81
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

describe("V3.2 mask geometry — actual layout model", () => {
  // main clips at its padding box (viewport edge); main px-5 = 20px each side; the atmosphere is
  // inset-x-[-10%] of the doors container → 120% of container width.
  const MAIN_PX = 20;
  const INSET = 0.1; // -10% each side → width 1.2x
  // The transparent plateaus of the shipped mask (must contain every clip boundary).
  const LEFT_PLATEAU_END = 9.5;
  const RIGHT_PLATEAU_START = 90.5;
  function boundaries(viewportWidth: number) {
    const containerWidth = viewportWidth - 2 * MAIN_PX;
    const atmosphereWidth = containerWidth * (1 + 2 * INSET);
    const left = ((containerWidth * INSET) - MAIN_PX) / atmosphereWidth * 100;
    return { left, right: 100 - left };
  }
  // Mask opacity at a mask-space position p (%), for the shipped stops.
  function maskOpacity(p: number) {
    if (p <= LEFT_PLATEAU_END || p >= RIGHT_PLATEAU_START) return 0; // transparent plateaus
    return 1; // (interior; only the plateau=0 property matters for the clip invariant)
  }

  it("boundaries are symmetric and BELOW/ABOVE the plateaus across device widths", () => {
    for (const vw of [320, 360, 390, 430]) {
      const { left, right } = boundaries(vw);
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThan(8.3334); // strictly under the old container-edge model figure
      expect(right).toBeGreaterThan(91.6666);
      expect(left + right).toBeCloseTo(100, 6); // symmetric
      // both actual clip boundaries fall INSIDE the fully-transparent plateaus
      expect(left).toBeLessThan(LEFT_PLATEAU_END);
      expect(right).toBeGreaterThan(RIGHT_PLATEAU_START);
    }
  });

  it("mask opacity is EXACTLY zero at each actual clipping boundary", () => {
    for (const vw of [320, 360, 390, 430]) {
      const { left, right } = boundaries(vw);
      expect(maskOpacity(left)).toBe(0);
      expect(maskOpacity(right)).toBe(0);
    }
  });

  it("representative calculated values match the formula at all four viewport widths", () => {
    // From ((containerWidth*0.1) - 20) / (containerWidth*1.2) * 100 ; right = 100 - left.
    const expected: Record<number, [number, number]> = {
      320: [2.38095, 97.61905], // container 280, atmosphere 336, left = 8/336*100
      360: [3.125, 96.875], //     container 320, atmosphere 384, left = 12/384*100
      390: [3.57143, 96.42857], // container 350, atmosphere 420, left = 15/420*100
      430: [4.05983, 95.94017], // container 390, atmosphere 468, left = 19.5/468... 20*...
    };
    for (const vw of [320, 360, 390, 430]) {
      const { left, right } = boundaries(vw);
      expect(left).toBeCloseTo(expected[vw][0], 4);
      expect(right).toBeCloseTo(expected[vw][1], 4);
    }
  });
});
