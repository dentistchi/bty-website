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
  it("keeps its top-control region below the safe area, with Back reachable", async () => {
    stub();
    render(<ObserverClient followupId="fu-1" locale="en" />);

    const { findByTestId } = within(document.body);
    const controls = await findByTestId("observe-top-controls");
    // Back stays reachable — the native WKWebView has no browser chrome to fall back on.
    expect(within(controls).getByTestId("observe-back")).toBeDefined();

    const main = controls.closest("main");
    expect(main?.className ?? "").toContain("env(safe-area-inset-top)");
    expect(main?.className ?? "").toContain("env(safe-area-inset-bottom)");
  });

  /*
    Slice R4-R1B REVERSES the R4-R1A placement. R4-R1A moved the switch off the global fixed
    header and into this row; language ownership for the whole authenticated app now sits in Me,
    so the Observer page carries none — the same as Today, Learn and Practice.
  */
  it("carries NO language control — that lives in Me for the whole app", async () => {
    stub();
    const { findByTestId, container } = render(<ObserverClient followupId="fu-1" locale="en" />);
    await findByTestId("observe-top-controls");
    expect(container.textContent).not.toContain("EN");
    expect(container.textContent).not.toContain("KO");
    expect(container.querySelector('a[href^="/ko/"]')).toBeNull();
    expect(container.querySelector('a[href^="/en/"]')).toBeNull();
  });

  it("carries none on the unavailable surface either", async () => {
    stub(404, { ok: false, error: "not_found" });
    const { findByTestId, container } = render(<ObserverClient followupId="fu-1" locale="en" />);
    await findByTestId("observe-unavailable");
    expect(container.querySelector('a[href^="/ko/"]')).toBeNull();
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
