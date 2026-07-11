/** @vitest-environment jsdom */
/**
 * Sensory Overreach V2 — screen-space presence. A SHARED atmospheric aurora travels behind the
 * door group with the sequence, the active card is lit from within, and a collective map reveal
 * closes the ritual. Tests validate lifecycle + separation (behind cards, cleared on tap/settle),
 * NOT visual beauty.
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
const aurora = (c: HTMLElement) => c.querySelectorAll("[data-aurora]").length;
const mapReveal = (c: HTMLElement) => c.querySelectorAll("[data-map-reveal]").length;

describe("screen-space aurora", () => {
  it("1/3/4. one shared aurora exists after settle, sits BEHIND cards (-z-10), travels on the sequence timeline", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    expect(aurora(container)).toBe(0); // 3. not before the settled boundary
    advance(AFFORDANCE_START_MS);
    expect(aurora(container)).toBe(1); // 1. single shared field
    const el = container.querySelector<HTMLElement>("[data-aurora]")!;
    // V3 explicit stacking: atmosphere at z-0, doors at z-10 (no negative-z for the principal effect).
    expect(el.className).toContain("z-0");
    expect(el.className).not.toContain("-z-10");
    expect(el.className).toContain("btyAurora"); // travels (background-position keyframe)
    expect(el.style.background).toContain("radial-gradient");
    const doorCell = container.querySelector('[data-focus="Self"]')!.closest(".grid")!;
    expect(doorCell.className).toContain("z-10"); // doors explicitly above the atmosphere
  });

  it("9. all atmospheric effects clear when a door is selected (tap during)", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    advance(AFFORDANCE_START_MS);
    expect(aurora(container)).toBe(1);
    fireEvent.click(container.querySelector('[data-focus="Others"]')!);
    expect(aurora(container)).toBe(0);
    expect(mapReveal(container)).toBe(0);
    expect(container.querySelectorAll("[data-afford]").length).toBe(0);
  });

  it("10. tap BEFORE the sequence clears the shared atmosphere (never appears)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 200);
    expect(aurora(container)).toBe(0);
    expect(mapReveal(container)).toBe(0);
  });

  it("14. reduced-motion renders NO aurora element at all", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 100);
    expect(aurora(container)).toBe(0);
  });

  it("13. tab-return (firstArrival=false) renders no aurora", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ firstArrival: false });
    advance(AFFORDANCE_START_MS + 100);
    expect(aurora(container)).toBe(0);
  });
});

describe("active card lit-from-within + collective map reveal", () => {
  it("2/6. active-card layers remain equal AND stronger (ignition core 0.66 in the inner-light fill)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    const inner = Array.from(container.querySelectorAll<HTMLElement>("[data-afford]"));
    expect(inner.length).toBe(3);
    for (const s of inner) expect(s.style.background).toContain("0.66"); // central ignition
    expect(new Set(inner.map((s) => s.className)).size).toBe(1); // equal treatment
    expect(container.querySelectorAll("button.btyAffordScale").length).toBe(3);
    expect(container.querySelectorAll("[data-door-halo]").length).toBe(3);
  });

  it("8. collective map reveal — all three outlines share ONE (non-staggered) delay after the wave", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    const reveals = Array.from(container.querySelectorAll<HTMLElement>("[data-map-reveal]"));
    expect(reveals.length).toBe(3);
    const delays = reveals.map((r) => r.style.animationDelay);
    expect(new Set(delays).size).toBe(1); // collective, not sequential
    expect(delays[0]).toBe(`${AFFORDANCE_TOTAL_MS - 120}ms`); // fires as the wave ends
  });

  it("11. NONE/LOW: aurora + wave play, then everything returns to equal neutral (no heartbeat)", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("low", "Self")) });
    advance(AFFORDANCE_START_MS);
    expect(aurora(container)).toBe(1);
    advance(AFFORDANCE_TOTAL_MS + 300);
    expect(container.querySelectorAll(".btyHeart").length).toBe(0); // no perpetual pulse
  });

  it("15/17. no rail/spark; existing selected ceremony intact (btySelectAck + btyOpenRoom)", () => {
    const { container } = renderToday();
    expect(container.querySelectorAll(".btySpine, .btySpark").length).toBe(0);
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    expect(container.querySelector('[data-focus="Self"]')!.className).toContain("btySelectAck");
    expect(container.querySelector("[data-today-confirm]")!.className).toContain("btyOpenRoom");
  });
});
