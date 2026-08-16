/** @vitest-environment jsdom */
/**
 * SLICE R4-R1A — THE OBSERVER SCREEN ON A PHONE.
 *
 * Founder device review on iPhone: the `EN | KO` control sat on top of the iOS clock and battery.
 * The cause was not this page — it was the GLOBAL web locale header, which is `position: fixed`
 * at `top-2` and whose exclusion list had never been told that `/{locale}/observe/{id}` is an
 * app-shell destination. The root layout sets `viewportFit: "cover"`, so the WebView draws UNDER
 * the status bar and 8px from the top is inside it.
 *
 * These assert ownership and the safe-area contract — the repo's existing style for this
 * (`AppTabBar.test.tsx`, `ArenaPracticeFlow.editorActions.test.tsx` both assert on the
 * `env(safe-area-inset-*)` expression). No pixel geometry is asserted; jsdom could not tell the
 * truth about it anyway.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, waitFor, within } from "@testing-library/react";

const push = vi.fn();
let mockPath = "/en/observe/fu-1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(""),
}));

import ObserverClient from "./ObserverClient";
import { LocaleLayoutHeader } from "@/components/LocaleLayoutHeader";

const REQUEST = {
  followupId: "fu-1",
  learnerDisplayName: "Tesr",
  observableStandard:
    "At the end of a team huddle when there are open action items that need follow-through, you must name " +
    "one owner and one deadline for each open action item before the huddle ends.",
  maxObservedOn: "2026-08-16",
  myObservations: [],
};

function stub(status = 200, body: unknown = { ok: true, request: REQUEST }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status === 200, status, json: async () => body,
  }));
}

beforeEach(() => {
  cleanup();
  push.mockReset();
  mockPath = "/en/observe/fu-1";
});

describe("[R4-R1A] the global web locale header does not follow the observer onto a phone", () => {
  it("renders NOTHING on /en/observe/… — the page owns its own top controls", () => {
    mockPath = "/en/observe/fu-1";
    const { container } = render(<LocaleLayoutHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("renders NOTHING on /ko/observe/… either", () => {
    mockPath = "/ko/observe/fu-1";
    const { container } = render(<LocaleLayoutHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("still renders on a neutral web route — the exclusion is scoped, not a removal", () => {
    mockPath = "/en/some-web-page";
    const { container } = render(<LocaleLayoutHeader />);
    expect(container.innerHTML).not.toBe("");
  });

  it("and where it DOES render it now clears the status bar", () => {
    mockPath = "/en/some-web-page";
    const { container } = render(<LocaleLayoutHeader />);
    const fixed = container.querySelector<HTMLElement>("div.fixed");
    // `max()` keeps the old 0.5rem wherever the inset is 0 — desktop is unchanged.
    expect(fixed?.className ?? "").toContain("env(safe-area-inset-top)");
    expect(fixed?.className ?? "").toContain("max(0.5rem,");
  });
});

describe("[R4-R1A] the observer page's own top controls", () => {
  it("puts Back and the language switch in ONE region, below the safe area", async () => {
    stub();
    render(<ObserverClient followupId="fu-1" locale="en" />);

    const { findByTestId } = within(document.body);
    const controls = await findByTestId("observe-top-controls");
    // Back stays reachable — the native WKWebView has no browser chrome to fall back on.
    expect(within(controls).getByTestId("observe-back")).toBeDefined();
    // The language switch belongs to the same region rather than floating over the OS.
    expect(controls.textContent).toContain("EN");
    expect(controls.textContent).toContain("KO");

    const main = controls.closest("main");
    expect(main?.className ?? "").toContain("env(safe-area-inset-top)");
    expect(main?.className ?? "").toContain("env(safe-area-inset-bottom)");
  });

  it("clears the safe area even when there is nothing to answer — never a bare dead end", async () => {
    stub(404, { ok: false, error: "not_found" });
    const { findByTestId, getByTestId } = render(<ObserverClient followupId="fu-1" locale="en" />);
    await findByTestId("observe-unavailable");
    const main = getByTestId("observe-top-controls").closest("main");
    expect(main?.className ?? "").toContain("env(safe-area-inset-top)");
  });

  it("Back still returns to Practice", async () => {
    stub();
    const { findByTestId } = render(<ObserverClient followupId="fu-1" locale="en" />);
    (await findByTestId("observe-back")).click();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/app?tab=practice"));
  });

  it("the full standard is shown on the page — the detail view never truncates it", async () => {
    stub();
    const { findByTestId } = render(<ObserverClient followupId="fu-1" locale="en" />);
    const el = await findByTestId("observe-standard");
    expect(el.textContent).toBe(REQUEST.observableStandard);
    expect(el.className).not.toMatch(/line-clamp|truncate/);
  });
});
