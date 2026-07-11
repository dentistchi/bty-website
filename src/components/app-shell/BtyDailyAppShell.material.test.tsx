/** @vitest-environment jsdom */
/**
 * Signature Door Material V3 — explicit stacking, resting material depth, full-perimeter ignition,
 * and the deeper active stack. Lifecycle/structure only; no visual-beauty claim.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { AFFORDANCE_DOOR_MS, AFFORDANCE_START_MS, AFFORDANCE_TOTAL_MS, COPY, TodaySurface, resolveInvitedFocus, selectTodayStatus } from "@/components/app-shell/BtyDailyAppShell";
import type { TodayConfidence, TodayIntelligence, TodayRelationshipFocus } from "@/domain/daily/todayIntelligence";

// V3.4 keyframes live in the parent BtyDailyAppShell <style> block (not the TodaySurface subtree the
// DOM tests mount), so these structural proofs read the source text directly.
const SRC = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");
const kfLine = (name: string) => SRC.split("\n").find((l) => l.includes(`@keyframes ${name}{`)) ?? "";
const scalesIn = (kf: string) => [...kf.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));

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
    const el = container.querySelector<HTMLElement>("[data-aurora-wrapper]")!;
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
    expect(container.querySelectorAll("[data-aurora-wrapper]").length).toBe(0);
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
    expect(container.querySelectorAll("[data-perimeter], [data-aurora-wrapper]").length).toBe(0); // reduced-motion: none
    expect(container.querySelectorAll(".btyHeart").length).toBe(0); // NONE/LOW: no perpetual pulse
  });
});

describe("V3.4 bounded arrival-card scale (btyAffordScale never exceeds the layout box)", () => {
  it("1/2. the arrival signature-door scale keyframe contains NO scale > 1.0; peak is exactly 1.0", () => {
    const kf = kfLine("btyAffordScale");
    expect(kf).not.toBe("");
    const scales = scalesIn(kf);
    expect(scales.length).toBeGreaterThan(0);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.0); // never wider than its layout box
    expect(Math.max(...scales)).toBe(1); // peak is exactly 1.0
  });

  it("3/4. initial scale < 1.0 (settles in) and final scale returns to exactly 1.0", () => {
    const kf = kfLine("btyAffordScale");
    const initial = Number(kf.match(/0%\{transform:scale\(([\d.]+)\)/)![1]);
    const final = Number(kf.match(/100%\{transform:scale\(([\d.]+)\)/)![1]);
    expect(initial).toBeLessThan(1); // begins smaller than the box (grows toward it)
    expect(final).toBe(1); // returns to exact layout size
  });

  it("6. no horizontal translation is introduced; any translateY is subtle (<= 1px)", () => {
    const kf = kfLine("btyAffordScale");
    expect(kf).not.toMatch(/translateX/);
    expect(kf).not.toMatch(/translate3d/);
    expect(kf).not.toMatch(/translate\([^)]*,/); // 2-arg translate() carries an X component
    for (const m of kf.matchAll(/translateY\((-?[\d.]+)px\)/g)) expect(Math.abs(Number(m[1]))).toBeLessThanOrEqual(1);
  });

  it("5. all three doors receive the identical bounded scale animation (one class, no per-door variance)", () => {
    vi.useFakeTimers();
    const { container } = renderToday();
    advance(AFFORDANCE_START_MS);
    const scaled = Array.from(container.querySelectorAll<HTMLElement>("button.btyAffordScale"));
    expect(scaled.length).toBe(3);
    expect(new Set(scaled.map((b) => b.className)).size).toBe(1); // identical treatment
  });

  it("PROTECTED: the V1 selection ceremony (btySelectAck, a separate tap animation) is byte-unchanged", () => {
    // The device finding names the ARRIVAL card (btyAffordScale 1.03). btySelectAck is the tap-time
    // acknowledge of the protected V1 selection ceremony — left exactly as-is by this arc.
    expect(SRC).toContain("@keyframes btySelectAck{0%{transform:scale(0.994)}45%{transform:scale(1.02)}100%{transform:scale(1)}}");
  });
});

describe("V3.4 lock: atmosphere V3.3.2 remains byte-unchanged", () => {
  it("9. wrapper runway + both blobs (widths, gradients, peaks, travel) are exactly as shipped in V3.3.2", () => {
    expect(SRC).toContain('pointer-events-none absolute inset-y-0 inset-x-5 z-0'); // runway wrapper
    expect(SRC).toContain('btyAuroraTravel absolute inset-x-[-12.5%] top-1/2 h-full rounded-full'); // gold blob box
    expect(SRC).toContain('btyAuroraTravel absolute inset-x-[-18%] top-1/2 h-full rounded-full'); // cool blob box
    expect(SRC).toContain("radial-gradient(closest-side, rgba(201,166,107,0.46) 0%, rgba(201,166,107,0.20) 40%, rgba(201,166,107,0.12) 54%, rgba(201,166,107,0.05) 66%, rgba(201,166,107,0.015) 76%, transparent 84%)");
    expect(SRC).toContain("radial-gradient(closest-side, rgba(150,180,220,0.10) 0%, rgba(150,180,220,0.055) 38%, rgba(150,180,220,0.025) 56%, rgba(150,180,220,0.008) 72%, transparent 84%)");
    expect(SRC).not.toContain("data-aurora-wrapper aria-hidden className=\"pointer-events-none absolute inset-0 z-0\""); // not reverted to edge-to-edge
  });

  it("10. full-perimeter ignition, warm-white core, and arrival/affordance timing constants unchanged", () => {
    expect(SRC).toContain("rgba(255,236,190,0.98)"); // warm-white perimeter core
    expect(SRC).toMatch(/@keyframes btyPerimeterSpin/);
    expect(AFFORDANCE_START_MS).toBe(1650); // arrival settle timing (runtime value)
    expect(AFFORDANCE_DOOR_MS).toBe(700); // per-door affordance timing (runtime value)
  });
});
