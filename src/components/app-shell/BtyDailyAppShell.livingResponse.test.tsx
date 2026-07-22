/** @vitest-environment jsdom */
/**
 * Today Living Response V1 — UI wiring. The perspective line renders in ONE bounded slot only when
 * confirmed + settled (ready|fallback); pending/null render nothing. Commitment confirmation never
 * waits on the Living Response POST; the POST fires only AFTER the commitment; failure leaves the
 * terminal intact; same-day re-entry restores the line. The client never calls any generation endpoint.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { COPY, TodaySurface, selectTodayStatus, type LivingResponseView } from "@/components/app-shell/BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const view = (over: Partial<LivingResponseView> = {}): LivingResponseView => ({ status: "ready", relationship: "self", perspective: "A quiet return still counts today.", source: "generated", confidence: "grounded", ...over });

function renderSurface(livingResponse: LivingResponseView | null, animateLivingArrival = false) {
  return render(
    <TodaySurface
      copy={COPY.en.today}
      statusLine={selectTodayStatus("en", "scenario_signal")}
      activeFocus={null}
      loading={false}
      promiseText={null}
      centerKeepLine={null}
      selected="Self"
      setSelected={() => {}}
      confirmed
      setConfirmed={() => {}}
      livingResponse={livingResponse}
      animateLivingArrival={animateLivingArrival}
      firstArrival={false}
    />,
  );
}

describe("TodaySurface — living response line", () => {
  it("renders exactly one line when ready", () => {
    const { container } = renderSurface(view());
    const els = container.querySelectorAll("[data-living-response]");
    expect(els.length).toBe(1);
    expect(els[0].textContent).toBe("A quiet return still counts today.");
    expect(els[0].getAttribute("data-living-response-source")).toBe("generated");
  });

  it("renders the fallback line (source=fallback)", () => {
    const { container } = renderSurface(view({ status: "fallback", source: "fallback", confidence: "limited", perspective: "Returning to yourself is quiet work." }));
    expect(container.querySelector('[data-living-response][data-living-response-source="fallback"]')).not.toBeNull();
  });

  it("renders NOTHING while pending", () => {
    const { container } = renderSurface(view({ status: "pending", perspective: null, source: null, confidence: null }));
    expect(container.querySelector("[data-living-response]")).toBeNull();
  });

  it("renders nothing when there is no living response", () => {
    const { container } = renderSurface(null);
    expect(container.querySelector("[data-living-response]")).toBeNull();
  });

  // V1.1 layout stability
  it("V1.1 stable slot exists in confirmed state for BOTH pending and settled (reserves footprint)", () => {
    const pendingC = renderSurface(view({ status: "pending", perspective: null, source: null, confidence: null }));
    const slotPending = pendingC.container.querySelector("[data-living-response-slot]");
    expect(slotPending).not.toBeNull(); // slot present even while pending → CTA position stable
    expect(slotPending!.className).toMatch(/min-h-\[/); // bounded reserved min-height
    const pendingSlotClass = slotPending!.className;
    expect(pendingC.container.querySelector("[data-living-response]")).toBeNull(); // no line/placeholder yet
    cleanup();
    const settledC = renderSurface(view());
    const slotSettled = settledC.container.querySelector("[data-living-response-slot]");
    expect(slotSettled).not.toBeNull();
    expect(slotSettled!.className).toBe(pendingSlotClass); // identical structural slot in both states
  });

  it("V1.2 line is hard-capped to 2 lines (line-clamp-2) so the reserved slot can never grow", () => {
    const { container } = renderSurface(view({ perspective: "A very long perspective ".repeat(10) }));
    const line = container.querySelector("[data-living-response]")!;
    expect(line.className).toContain("line-clamp-2"); // caps at 2 lines regardless of text length
  });

  it("V1.1 confirmed card carries NO loading affordance in any state", () => {
    const { container } = renderSurface(view());
    // no loading affordances anywhere in the confirmed card
    expect(container.querySelector('[class*="spinner"],[class*="skeleton"],[class*="shimmer"],[role="status"],[data-toast]')).toBeNull();
    expect(container.textContent).not.toMatch(/thinking|loading|generating/i);
  });

  // Presence V1.1 — arrival rhythm applies ONLY to a first-generation line.
  it("Presence V1.1 arrival: first-generation line plays btyLivingArrival (pause+rise), no italic/quotes", () => {
    const { container } = renderSurface(view(), /* animateLivingArrival */ true);
    const line = container.querySelector("[data-living-response]")!;
    expect(line.className).toContain("btyLivingArrival"); // the pause+rise reveal
    expect(line.getAttribute("data-living-response-arrival")).toBe("1");
    expect(line.className).not.toContain("italic"); // received presence, not a caption/quote
    expect(line.textContent).not.toMatch(/["“”]/); // no quotation marks
  });

  it("Presence V1.1 restore: a NON-arrival line renders at rest (no arrival animation class)", () => {
    const { container } = renderSurface(view(), /* animateLivingArrival */ false);
    const line = container.querySelector("[data-living-response]")!;
    expect(line.className).not.toContain("btyLivingArrival"); // restore/tab-return/re-render = immediate, at rest
    expect(line.getAttribute("data-living-response-arrival")).toBeNull();
    expect(line.className).toContain("line-clamp-2"); // still hard-capped to the 2-line slot
  });
});

// NOTE (Slice 3.1B-3J.1): the former shell-level "POST after commit" + "hydration materialization"
// blocks were removed with the retired Today relationship/commitment surface — the shell no longer
// renders the doors or drives the commit / living-response reads (those server engines are unchanged
// and covered by their own suites). The Living Response LINE rendering stays fully covered above via
// TodaySurface in isolation.
