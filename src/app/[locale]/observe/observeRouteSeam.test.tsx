/** @vitest-environment jsdom */
/**
 * SLICE R4-R1B — THE PRACTICE → OBSERVE SEAM.
 *
 * Measured cause of the Founder's "Please wait" flash: `/{locale}/observe/{id}` had no loading
 * boundary and no floor of its own, so the nearest one applied — `[locale]/loading.tsx`, which is
 * a CREAM `#F8F4F0` page carrying ⏳, skeleton bars and "First load may take 1–2 minutes."
 * Between navy Practice and the dark observer page that reads as the web bootstrapping.
 *
 * `/{locale}/app` had already solved this with a navy floor + a calm navy fallback. These lock
 * the same pair onto `/observe`, and lock OUT the furniture that made the seam look like a cold
 * start: no spinner, no skeleton, and above all no promise of a one-to-two-minute wait for a
 * navigation the reviewer just initiated.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import ObserveLayout from "./layout";
import ObserveLoading from "./loading";

/**
 * The observer page's own background — floor, fallback and content must be one surface.
 * jsdom normalises hex to rgb(), so the assertions below use the form the DOM actually reports.
 */
const OBSERVE_BG = "rgb(11, 18, 32)"; // #0B1220
/** What the segment fallback used to be, and must never be again. */
const WEB_CREAM = "rgb(248, 244, 240)"; // #F8F4F0

describe("[R4-R1B] the observe segment paints its own floor", () => {
  it("is server-renderable and paints the destination's background, not white", () => {
    const { container } = render(<ObserveLayout>{<span>child</span>}</ObserveLayout>);
    const floor = container.querySelector<HTMLElement>("[data-bty-observe-floor]");
    expect(floor).not.toBeNull();
    expect(floor!.style.background).toBe(OBSERVE_BG);
    expect(floor!.style.minHeight).toBe("100dvh");
    // The floor wraps the route rather than replacing it.
    expect(floor!.textContent).toContain("child");
  });

  it("is a plain element — no client hook can stop it painting", () => {
    // A floor that needed hydration would be absent during the very seam it exists to cover.
    const { container } = render(<ObserveLayout>{null}</ObserveLayout>);
    expect(container.querySelector("[data-bty-observe-floor]")).not.toBeNull();
  });
});

describe("[R4-R1B] the streaming fallback is calm, not a cold start", () => {
  it("matches the destination background so there is no second flash", () => {
    const { container } = render(<ObserveLoading />);
    const el = container.querySelector<HTMLElement>("[data-bty-observe-loading]");
    expect(el).not.toBeNull();
    expect(el!.style.background).toBe(OBSERVE_BG);
    expect(el!.style.background).not.toBe(WEB_CREAM);
  });

  it("carries no spinner, no skeleton, and no promise of a long wait", () => {
    const { container } = render(<ObserveLoading />);
    const text = container.textContent ?? "";
    for (const forbidden of ["⏳", "Please wait", "잠시만", "1–2 minutes", "minutes"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    expect(container.querySelector('[class*="skeleton"]')).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("the floor and the fallback agree on the surface", () => {
    const floor = render(<ObserveLayout>{null}</ObserveLayout>)
      .container.querySelector<HTMLElement>("[data-bty-observe-floor]")!;
    const loading = render(<ObserveLoading />)
      .container.querySelector<HTMLElement>("[data-bty-observe-loading]")!;
    expect(loading.style.background).toBe(floor.style.background);
    expect(floor.style.background).toBe(OBSERVE_BG);
  });
});
