/** @vitest-environment jsdom */
/**
 * Sensory Overreach V1 — the four coordinated arrival layers and the selection ceremony.
 *
 * Tests assert lifecycle + layer presence/equality, NOT visual beauty. Fake timers advance to the
 * post-arrival start; selection tests need no timers (the bloom hasn't started yet at mount).
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

describe("arrival — four coordinated layers", () => {
  it("2/3/4. after settled arrival, all three doors get inner-light + rim + halo + action-lift + scale, equally", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    expect(container.querySelectorAll("[data-afford]").length).toBe(0); // not before settle
    advance(AFFORDANCE_START_MS);

    // (A) inner light + (B) rim — one overlay per door: full radial fill + full gold rounded rim.
    const inner = Array.from(container.querySelectorAll<HTMLElement>("[data-afford]"));
    expect(inner.length).toBe(3);
    for (const s of inner) {
      expect(s.className).toContain("ring-2"); // whole rounded border
      expect(s.className).toContain("ring-[#C9A66B]/80");
      expect(s.style.background).toContain("radial-gradient"); // full-card surface warmth
    }
    // (C) outer halo — one per door, on the non-clipping grid cell.
    const halos = Array.from(container.querySelectorAll<HTMLElement>("[data-door-halo]"));
    expect(halos.length).toBe(3);
    for (const h of halos) expect(h.className).toContain("btyHalo");
    // (D) action-label lift + active-door scale.
    expect(container.querySelectorAll(".btyAffordLift").length).toBe(3);
    expect(container.querySelectorAll("button.btyAffordScale").length).toBe(3);

    // Sequential + identical treatment across all three.
    expect(inner.map((s) => s.style.animationDelay)).toEqual(["0ms", "480ms", "960ms"]);
    expect(new Set(inner.map((s) => s.className)).size).toBe(1);
    expect(new Set(halos.map((h) => h.className.replace(/grid-rows-\[[^\]]+\]/, ""))).size).toBe(1);
  });

  it("5. no left rail / spark returns", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    expect(container.querySelectorAll(".btySpine, .btySpark").length).toBe(0);
  });

  it("6. tap BEFORE the sequence cancels every layer (inner/rim/halo/lift/scale)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 100);
    expect(container.querySelectorAll("[data-afford]").length).toBe(0);
    expect(container.querySelectorAll("[data-door-halo]").length).toBe(0);
    expect(container.querySelectorAll(".btyHalo, .btyAffordScale, .btyAffordLift").length).toBe(0);
  });

  it("11/12. settled NONE/LOW has NO looping animation (no heartbeat) and equal doors", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("low", "Self")) });
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 200);
    expect(container.querySelectorAll(".btyHeart").length).toBe(0); // no perpetual pulse
  });
});

describe("selection — commitment ceremony", () => {
  it("8/9/10. acknowledge (selected pop + strong rim) · focus (others recede, visible) · open · reveal", () => {
    const { container } = renderToday({ promiseText: "Ship the draft" });
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);

    // PHASE 1 — acknowledge: selected button gets the one-time scale pop + a strong warm rim.
    const selectedBtn = container.querySelector<HTMLElement>('[data-focus="Self"]')!;
    expect(selectedBtn.className).toContain("btySelectAck");
    expect(selectedBtn.className).toContain("border-[#C9A66B]/70");

    // PHASE 2 — focus: the two unselected doors recede (dim + shrink) but remain in the DOM.
    const othersBtn = container.querySelector<HTMLElement>('[data-focus="Others"]')!;
    const othersRecede = othersBtn.parentElement!; // the dim/scale wrapper
    expect(othersRecede.className).toContain("opacity-40");
    expect(othersRecede.className).toContain("scale-[0.97]");
    expect(othersBtn).toBeTruthy(); // still visible, not removed

    // PHASE 3 — open: the interior opens dimensionally.
    const interior = container.querySelector<HTMLElement>("[data-today-confirm]")!;
    expect(interior.className).toContain("btyOpenRoom");

    // PHASE 4 — reveal: staged content order intact + action_text verbatim + CTA works.
    expect(container.querySelector("[data-path-label]")!.className).toContain("btySettle");
    expect(container.querySelector("[data-carry-line]")!.textContent).toBe("Ship the draft");
    const cta = container.querySelector<HTMLElement>("[data-today-cta]")!;
    expect(cta.style.animationDelay).toBe("140ms");
    fireEvent.click(cta);
    expect(cta.getAttribute("aria-pressed")).toBe("true");
  });

  it("interaction is immediate — interior available on the same tap (no wait)", () => {
    const { container } = renderToday();
    fireEvent.click(container.querySelector('[data-focus="World"]')!);
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull();
  });
});
