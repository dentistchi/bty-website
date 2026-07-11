/** @vitest-environment jsdom */
/**
 * Three-Door Affordance — VISIBLE lifecycle (device-failure correction).
 *
 * The doors render immediately (nonblocking), but the full-door bloom must NOT start at mount — it
 * begins only after the arrival has settled (AFFORDANCE_START_MS) so it plays on already-visible,
 * still cards. These tests assert the SEQUENCE LIFECYCLE with fake timers, not just CSS strings.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  AFFORDANCE_START_MS,
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
    <TodaySurface copy={COPY.en.today} statusLine={selectTodayStatus("en", "scenario_signal")} activeFocus={null} loading={false} promiseText={null} centerKeepLine={null} firstArrival {...over} />,
  );
}
const doors = (c: HTMLElement) => c.querySelectorAll("[data-focus]").length;
const afford = (c: HTMLElement) => c.querySelectorAll("[data-afford]").length;
const invited = (c: HTMLElement) => c.querySelectorAll(".btyHeart").length;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("nonblocking doors, delayed bloom", () => {
  it("doors render immediately + interactive while intel unresolved; bloom not yet begun", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ loading: true, activeFocus: null });
    expect(doors(container)).toBe(3);
    expect(afford(container)).toBe(0); // 1. does NOT begin at mount
    fireEvent.click(container.querySelector('[data-focus="Self"]')!); // interactive during arrival
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull();
  });

  it("2. bloom stays absent while the arrival transition is still active (before START)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS - 50);
    expect(afford(container)).toBe(0);
  });

  it("3/4/5. bloom begins after the arrival-complete boundary; equal sequential phases", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    const spans = Array.from(container.querySelectorAll<HTMLElement>("[data-afford]"));
    expect(spans.length).toBe(3);
    expect(spans.map((s) => s.style.animationDelay)).toEqual(["0ms", "480ms", "960ms"]); // sequential
    for (const s of spans) expect(s.className).toContain("btyAfford");
    expect(new Set(spans.map((s) => s.className)).size).toBe(1); // identical treatment
  });

  it("11. NONE/LOW return to equal neutral (no invited door) through the whole sequence", () => {
    vi.useFakeTimers();
    for (const conf of ["none", "low"] as const) {
      const { container, unmount } = renderToday({ activeFocus: resolveInvitedFocus(intel(conf, "Others")) });
      advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 100);
      expect(invited(container)).toBe(0);
      unmount();
    }
  });

  it("10. MEDIUM/HIGH invitation stays deferred until the bloom completes", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "World")) });
    advance(AFFORDANCE_START_MS); // bloom begins
    expect(invited(container)).toBe(0); // invitation still withheld during the sequence
    advance(AFFORDANCE_TOTAL_MS + 50); // bloom completes
    expect(invited(container)).toBe(1); // exactly one, only after
  });
});

describe("user-tap priority", () => {
  it("6. tap BEFORE the sequence begins permanently cancels it", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    fireEvent.click(container.querySelector('[data-focus="Others"]')!); // tap during the still arrival
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 100);
    expect(afford(container)).toBe(0); // never plays
    expect(container.querySelector('[data-focus="Others"]')!.getAttribute("aria-pressed")).toBe("true");
  });

  it("7. tap DURING the sequence stops remaining blooms; selection immediate", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    advance(AFFORDANCE_START_MS);
    expect(afford(container)).toBe(3);
    fireEvent.click(container.querySelector('[data-focus="Others"]')!);
    expect(afford(container)).toBe(0);
    expect(container.querySelector("[data-today-confirm]")).not.toBeNull();
    expect(container.querySelector('[data-focus="Others"]')!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("session + motion rules", () => {
  it("8. tab-return (firstArrival=false) never replays the bloom; invitation immediate", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ firstArrival: false, activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 100);
    expect(afford(container)).toBe(0);
    expect(invited(container)).toBe(1); // at-rest invited shown immediately
  });

  it("9. reduced-motion skips the bloom entirely; invitation immediate", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    advance(AFFORDANCE_START_MS + AFFORDANCE_TOTAL_MS + 100);
    expect(afford(container)).toBe(0);
    expect(invited(container)).toBe(1);
  });

  it("13. no btySpine / btySpark rail is ever present", () => {
    vi.useFakeTimers();
    const { container } = renderToday({ activeFocus: resolveInvitedFocus(intel("high", "Self")) });
    advance(AFFORDANCE_START_MS);
    expect(container.querySelectorAll(".btySpine, .btySpark").length).toBe(0);
  });
});
