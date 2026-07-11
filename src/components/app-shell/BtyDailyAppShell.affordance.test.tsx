/** @vitest-environment jsdom */
/**
 * Three-Door Affordance + Nonblocking Arrival STEP 1.
 *
 * The doors render immediately (never gated on the intelligence read). On the first shell arrival a
 * restrained, EQUAL, one-time surface warmth blooms across the three doors (Self→Others→World) to
 * say "choose one of these" — distinct from, and BEFORE, any MEDIUM/HIGH evidence invitation. User
 * taps always win and suppress the remaining sequence. Uses fake timers (no wall-clock dependency).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  AFFORDANCE_TOTAL_MS,
  COPY,
  TodaySurface,
  resolveInvitedFocus,
  selectTodayStatus,
} from "@/components/app-shell/BtyDailyAppShell";
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
    <TodaySurface
      copy={COPY.en.today}
      statusLine={selectTodayStatus("en", "scenario_signal")}
      activeFocus={null}
      loading={false}
      promiseText={null}
      centerKeepLine={null}
      firstArrival
      {...over}
    />,
  );
}
const doors = (c: HTMLElement) => c.querySelectorAll("[data-focus]").length;
const afford = (c: HTMLElement) => c.querySelectorAll("[data-afford]").length;
const invited = (c: HTMLElement) => c.querySelectorAll(".btyHeart").length;

describe("nonblocking arrival", () => {
  it("1. intel unresolved (loading) → all three doors already rendered, interactive, zero invited", () => {
    const { container } = renderToday({ loading: true, activeFocus: resolveInvitedFocus(intel("none", "CleanStart")) });
    expect(doors(container)).toBe(3);
    expect(invited(container)).toBe(0);
    fireEvent.click(container.querySelector('[data-focus="Self"]')!); // interactive while pending
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull();
  });

  it("6. intel request fails (neutral fallback) → complete neutral Today usable", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("none", "CleanStart")) });
    expect(doors(container)).toBe(3);
    expect(invited(container)).toBe(0);
    fireEvent.click(container.querySelector('[data-focus="Others"]')!);
    expect(container.querySelector("[data-today-cta]")).not.toBeNull();
  });

  it("12. no initial invited-door flash — unresolved intelligence starts neutral", () => {
    const { container } = renderToday({ loading: true, activeFocus: null });
    expect(invited(container)).toBe(0);
    expect(afford(container)).toBe(3); // the neutral affordance, not a recommendation
  });
});

describe("affordance sequence + deferred invitation", () => {
  it("2/3. NONE and LOW stay neutral through and after the sequence", () => {
    vi.useFakeTimers();
    for (const conf of ["none", "low"] as const) {
      const { container, unmount } = renderToday({ activeFocus: resolveInvitedFocus(intel(conf, "Others")) });
      expect(afford(container)).toBe(3);
      expect(invited(container)).toBe(0);
      act(() => vi.advanceTimersByTime(AFFORDANCE_TOTAL_MS + 50));
      expect(invited(container)).toBe(0); // never invited
      unmount();
    }
  });

  it("4/5. MEDIUM/HIGH: neutral sequence first, exactly one invited door AFTER it", () => {
    vi.useFakeTimers();
    for (const conf of ["medium", "high"] as const) {
      const { container, unmount } = renderToday({ activeFocus: resolveInvitedFocus(intel(conf, "World")) });
      expect(afford(container)).toBe(3); // equal neutral affordance on all three
      expect(invited(container)).toBe(0); // invitation withheld during the sequence
      act(() => vi.advanceTimersByTime(AFFORDANCE_TOTAL_MS + 50));
      expect(invited(container)).toBe(1); // exactly one, after the sequence
      unmount();
    }
  });

  it("9. affordance applies once to each door with equal class/delay semantics", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    const spans = Array.from(container.querySelectorAll<HTMLElement>("[data-afford]"));
    expect(spans.length).toBe(3);
    for (const s of spans) expect(s.className).toContain("btyAfford"); // identical effect
    const delays = spans.map((s) => s.style.animationDelay);
    expect(delays).toEqual(["0ms", "120ms", "240ms"]); // sequential, equal gap
  });

  it("10. tab-return (firstArrival=false) → no affordance replay, invitation immediate", () => {
    const { container } = renderToday({ firstArrival: false, activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    expect(afford(container)).toBe(0); // sequence does not replay
    expect(invited(container)).toBe(1); // at-rest invited shown immediately (no defer)
  });

  it("11. reduced-motion → no sequence, doors visible + usable immediately, invitation at rest", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    expect(afford(container)).toBe(0); // no sequential animation
    expect(doors(container)).toBe(3);
    expect(invited(container)).toBe(1); // invitation immediate (not deferred behind an animation)
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull();
  });
});

describe("user interaction priority", () => {
  it("7. select while unresolved → selected interior opens; later intel cannot override", () => {
    const { container, rerender } = renderToday({ loading: true, activeFocus: null });
    fireEvent.click(container.querySelector('[data-focus="Self"]')!);
    expect(container.querySelector('[data-focus="Self"]')!.getAttribute("aria-pressed")).toBe("true");
    // Intelligence resolves late to a DIFFERENT focus — must not override the user's choice.
    rerender(
      <TodaySurface copy={COPY.en.today} statusLine={selectTodayStatus("en", "verified_action")} activeFocus={resolveInvitedFocus(intel("high", "World"))} loading={false} promiseText={null} centerKeepLine={null} firstArrival />,
    );
    expect(container.querySelector('[data-focus="Self"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-focus="World"]')!.getAttribute("aria-pressed")).toBe("false");
  });

  it("8. tap during the sequence → remaining affordance stops, selection is immediate", () => {
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    expect(afford(container)).toBe(3);
    fireEvent.click(container.querySelector('[data-focus="Others"]')!);
    expect(afford(container)).toBe(0); // remaining sequence suppressed
    expect(container.querySelector('[data-focus="Others"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull(); // interior opened immediately
  });
});
