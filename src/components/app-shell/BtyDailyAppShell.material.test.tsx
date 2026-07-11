/** @vitest-environment jsdom */
/**
 * Signature Door Material V3 — explicit stacking, resting material depth, full-perimeter ignition,
 * and the deeper active stack. Lifecycle/structure only; no visual-beauty claim.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { AFFORDANCE_START_MS, AFFORDANCE_TOTAL_MS, COPY, TodaySurface, resolveInvitedFocus, selectTodayStatus } from "@/components/app-shell/BtyDailyAppShell";
import type { TodayConfidence, TodayIntelligence, TodayRelationshipFocus } from "@/domain/daily/todayIntelligence";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function intel(confidence: TodayConfidence, relationshipFocus: TodayRelationshipFocus): TodayIntelligence {
  return { userState: "scenario_signal", relationshipFocus, confidence, reasonCodes: [], fallbackMode: "none" };
}
function renderToday(over: Partial<React.ComponentProps<typeof TodaySurface>> = {}) {
  return render(
    <TodaySurface copy={COPY.en.today} statusLine={selectTodayStatus("en", "scenario_signal")} activeFocus={null} loading={false} promiseText={null} centerKeepLine={null} firstArrival {...over} />,
  );
}
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const perimeter = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>("[data-perimeter]"));

describe("explicit stacking + resting material", () => {
  it("1/2. atmosphere is z-0 (no negative-z); doors are z-10", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    const el = container.querySelector<HTMLElement>("[data-aurora]")!;
    expect(el.className).toContain("z-0");
    expect(el.className).not.toContain("-z-10");
    expect(container.querySelector('[data-focus="Self"]')!.closest(".grid")!.className).toContain("z-10");
  });

  it("3. resting doors carry permanent material depth (inset specular + lower depth shadow)", () => {
    const { container } = renderToday(); // t=0, no bloom yet → neutral resting state
    const btn = container.querySelector<HTMLElement>('[data-focus="Self"]')!;
    expect(btn.className).toContain("shadow-[inset_0_1px_0_rgba(255,255,255,0.10)"); // top specular + depth
    expect(container.querySelector('[data-focus="Self"]')!.closest(".grid")!.className).toContain("drop-shadow-"); // float shadow
  });
});

describe("full-perimeter ignition", () => {
  it("4. exists after settle, identical on all three doors (conic border mask)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    expect(perimeter(container).length).toBe(0); // not before settle
    advance(AFFORDANCE_START_MS);
    const p = perimeter(container);
    expect(p.length).toBe(3);
    for (const s of p) {
      expect(s.className).toContain("btyPerimeter");
      expect(s.style.background).toContain("conic-gradient"); // travels the whole boundary
      expect(String((s.style as CSSStyleDeclaration).webkitMask || s.style.getPropertyValue("-webkit-mask"))).toContain("content-box"); // masked to the border ring
    }
    expect(new Set(p.map((s) => s.className)).size).toBe(1); // identical
    expect(p.map((s) => s.style.animationDelay)).toEqual(["0ms", "480ms", "960ms"]); // staggered per door
  });

  it("5/11. perimeter clears on selection (one finite lifecycle, cancelled by tap)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    expect(perimeter(container).length).toBe(3);
    fireEvent.click(container.querySelector('[data-focus="Others"]')!);
    expect(perimeter(container).length).toBe(0);
    expect(container.querySelectorAll("[data-aurora]").length).toBe(0);
  });
});

describe("deeper active stack + stronger resolution", () => {
  it("8. active door coordinates surface, rim, perimeter, halo, type-lift, and scale", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    expect(container.querySelectorAll("[data-afford]").length).toBe(3); // surface + rim
    expect(container.querySelectorAll("[data-perimeter]").length).toBe(3); // perimeter
    expect(container.querySelectorAll("[data-door-halo]").length).toBe(3); // halo
    expect(container.querySelectorAll(".btyAffordLift").length).toBe(3); // type lift
    expect(container.querySelectorAll("button.btyAffordScale").length).toBe(3); // depth scale
  });

  it("9. life-map resolution is a separate weaker layer after the wave (collective, ring /45)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    const reveals = Array.from(container.querySelectorAll<HTMLElement>("[data-map-reveal]"));
    expect(reveals.length).toBe(3);
    for (const r of reveals) expect(r.className).toContain("ring-[#C9A66B]/45");
    expect(new Set(reveals.map((r) => r.style.animationDelay)).size).toBe(1); // collective, not staggered
    expect(reveals[0].style.animationDelay).toBe(`${AFFORDANCE_TOTAL_MS - 120}ms`);
  });

  it("10/12/15. everything clears after completion; NONE/LOW settle equal; reduced-motion renders none", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("low", "Self")) });
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 200);
    expect(container.querySelectorAll("[data-perimeter], [data-aurora]").length).toBe(0); // reduced-motion: none
    expect(container.querySelectorAll(".btyHeart").length).toBe(0); // NONE/LOW: no perpetual pulse
  });
});
