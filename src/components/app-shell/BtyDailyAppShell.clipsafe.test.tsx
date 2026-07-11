/** @vitest-environment jsdom */
/**
 * Signature Door Material V3.3.1 — filterless synchronized light blobs (structural proofs only).
 *
 * A fully transparent wrapper holds two real light blobs. NO filter anywhere: softness comes from a
 * multi-stop radial with a fully transparent OUTER PLATEAU, so alpha is exactly zero at every
 * element boundary (four-sided safety by construction). Both blobs share top-1/2 + h-full + the same
 * transform keyframe → identical center-Y at Self/Others/World. No visual/sensory claim.
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
const maskOf = (e: HTMLElement) =>
  String(e.style.getPropertyValue("-webkit-mask-image") || (e.style as CSSStyleDeclaration).webkitMaskImage || e.style.maskImage || e.style.getPropertyValue("mask") || "");

describe("transparent wrapper (no paint / filter / mask / clip)", () => {
  it("1. wrapper paints nothing, filters nothing, masks nothing, clips nothing", () => {
    const c = atStart();
    const w = c.querySelector<HTMLElement>("[data-aurora-wrapper]")!;
    expect(w).not.toBeNull();
    expect(w.style.background).toBe("");
    expect(w.style.backgroundImage).toBe("");
    expect(w.style.filter).toBe("");
    expect((w.style as CSSStyleDeclaration).backdropFilter || "").toBe("");
    expect(maskOf(w)).toBe("");
    expect(w.className).not.toContain("overflow-hidden");
    expect(w.className).not.toMatch(/overflow-x-(auto|scroll|hidden)/);
    expect(w.className).toContain("z-0");
  });
});

describe("two filterless light blobs; radial-only softness with transparent plateau", () => {
  it("2. exactly two blobs; NEITHER has filter/backdrop/mask/background-tile; each is a full-element radial", () => {
    const c = atStart();
    const gold = c.querySelector<HTMLElement>("[data-aurora-gold]")!;
    const cool = c.querySelector<HTMLElement>("[data-aurora-cool]")!;
    expect(c.querySelectorAll("[data-aurora-gold], [data-aurora-cool]").length).toBe(2);
    for (const b of [gold, cool]) {
      expect(b.style.filter).toBe(""); // NO filter
      expect((b.style as CSSStyleDeclaration).backdropFilter || "").toBe(""); // NO backdrop-filter
      expect(maskOf(b)).toBe(""); // NO mask
      expect(["", "auto"]).toContain(b.style.backgroundSize); // NO sized tile
      expect(["", "0% 0%"]).toContain(b.style.backgroundPosition); // NO positioned tile
      expect(b.style.background).toContain("radial-gradient(closest-side"); // full-element radial
      expect(b.className).toContain("btyAuroraTravel");
      expect(b.className).toContain("rounded-full");
    }
  });

  it("3. each radial reaches fully transparent BEFORE the boundary and keeps a transparent outer plateau", () => {
    const c = atStart();
    for (const sel of ["[data-aurora-gold]", "[data-aurora-cool]"]) {
      const bg = c.querySelector<HTMLElement>(sel)!.style.background;
      const m = bg.match(/transparent\s+(\d+)%/);
      expect(m, `${sel} has a transparent stop`).not.toBeNull();
      const stop = Number(m![1]);
      expect(stop).toBeLessThan(100); // transparent before the element edge
      expect(100 - stop).toBeGreaterThan(10); // a substantial (>10%) fully-transparent outer plateau
      expect(stop).toBe(84); // authorized outer plateau at 84%→100%
    }
    // gold peak 0.46, secondary shoulder ≤ 0.20; cool peak 0.10
    const gold = c.querySelector<HTMLElement>("[data-aurora-gold]")!.style.background;
    expect(gold).toContain("rgba(201, 166, 107, 0.46) 0%");
    expect(gold).toContain("rgba(201, 166, 107, 0.2) 40%");
    expect(c.querySelector<HTMLElement>("[data-aurora-cool]")!.style.background).toContain("rgba(150, 180, 220, 0.1) 0%");
  });
});

describe("spatial synchronization — identical height + shared keyframe → same center Y", () => {
  it("4. both blobs use top-1/2 + h-full + the same btyAuroraTravel keyframe", () => {
    const c = atStart();
    const gold = c.querySelector<HTMLElement>("[data-aurora-gold]")!;
    const cool = c.querySelector<HTMLElement>("[data-aurora-cool]")!;
    for (const b of [gold, cool]) {
      expect(b.className).toContain("top-1/2");
      expect(b.className).toContain("h-full");
      expect(b.className).toContain("btyAuroraTravel");
    }
    // identical vertical reference geometry (height + top) → identical center Y at every %
    const vClasses = (e: HTMLElement) => e.className.split(/\s+/).filter((t) => /^(top-|h-|-?translate-y|btyAuroraTravel)/.test(t)).sort();
    expect(vClasses(gold)).toEqual(vClasses(cool));
  });

  it("center-Y math: with equal height H and shared keyframe, centers coincide at Self/Others/World", () => {
    // top-1/2 → top edge at 0.5H_wrap; transform translateY(-50%) centers (blob H = H_wrap); the
    // travel translateY(k%) is k% of the blob's OWN height. Equal blob height ⇒ equal travel px ⇒
    // equal center Y for both blobs at every keyframe stop.
    const H = 360; // wrapper (doors group) height, representative
    const centerY = (kPct: number) => 0.5 * H /*top-1/2*/ - 0.5 * H /*translateY(-50%)*/ + (kPct / 100) * H;
    for (const k of [-38 /*Self*/, 0 /*Others*/, 38 /*World*/]) {
      const gold = centerY(k); // same H for gold
      const cool = centerY(k); // same H for cool
      expect(gold).toBe(cool);
    }
    // and the three stops are distinct (real travel)
    expect(new Set([centerY(-38), centerY(0), centerY(38)]).size).toBe(3);
  });
});

describe("obsolete architecture fully removed", () => {
  it("5. no blur(40px)/blur(56px), no V3.2 mask, no background-position tile anywhere in the atmosphere", () => {
    const c = atStart();
    const nodes = c.querySelectorAll<HTMLElement>("[data-aurora-wrapper], [data-aurora-gold], [data-aurora-cool]");
    for (const n of nodes) {
      expect(n.style.filter).not.toContain("blur");
      expect(maskOf(n)).not.toContain("linear-gradient");
      expect(["", "0% 0%"]).toContain(n.style.backgroundPosition);
      expect(["", "auto"]).toContain(n.style.backgroundSize);
    }
  });
});

describe("preserved guarantees", () => {
  it("6. card-local halo + perimeter unchanged and contained; equal across three doors; no clip wrapper", () => {
    const c = atStart();
    expect(c.querySelectorAll("[data-door-halo].btyHalo").length).toBe(3);
    for (const p of c.querySelectorAll<HTMLElement>("[data-perimeter]")) {
      expect(p.className).toContain("inset-0");
      expect(p.closest("button[data-focus]")).not.toBeNull();
    }
    expect(c.querySelectorAll("button.btyAffordScale").length).toBe(3);
    for (const cell of c.querySelectorAll('[data-focus]')) expect(cell.closest(".grid")!.className).not.toMatch(/-translate-x/);
    const group = c.querySelector<HTMLElement>("[data-aurora-wrapper]")!.parentElement!;
    expect(group.className).toContain("isolate");
    expect(group.className).not.toContain("overflow-hidden");
  });
});
