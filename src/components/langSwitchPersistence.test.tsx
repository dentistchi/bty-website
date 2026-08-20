/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { readSavedLocale } from "@/lib/localePreference";

/**
 * R4-R4B-R1N-R1 — the language control now remembers, and only on an explicit choice.
 *
 * The Founder's report: choose Korean, fully terminate the app, relaunch — English. The path prefix
 * carried the choice and the WebView carried the path, so terminating the app discarded both.
 */

let pathname = "/en/app";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

import { LangSwitch } from "./LangSwitch";

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const k = c.split("=")[0]?.trim();
    if (k) document.cookie = `${k}=; path=/; max-age=0`;
  }
}

beforeEach(() => {
  pathname = "/en/app";
  search = "";
  clearCookies();
});
afterEach(cleanup);

/*
  R4-R4B-R1N-R1-R1 REPLACED THESE ASSERTIONS.

  They pinned a `document.cookie` write in the link's onClick — the implementation that passed
  every test here and failed on the Founder's device. The control now navigates through
  `/api/locale/set`, which sets the cookie and redirects in ONE response, so what belongs here is
  the TARGET; the cookie shape is asserted against the real route in
  `src/app/api/locale/set/route.test.ts`.
*/
describe("R4-R4B-R1N-R1-R1 · 9/10 · the control routes through the server writer", () => {
  it("10 — KO points at the preference route, carrying the destination it used to link to", () => {
    render(<LangSwitch />);
    expect(screen.getByTestId("lang-switch-ko").getAttribute("href")).toBe(
      `/api/locale/set?to=ko&next=${encodeURIComponent("/ko/app")}`,
    );
  });

  it("10 — EN does the same", () => {
    pathname = "/ko/app";
    render(<LangSwitch />);
    expect(screen.getByTestId("lang-switch-en").getAttribute("href")).toBe(
      `/api/locale/set?to=en&next=${encodeURIComponent("/en/app")}`,
    );
  });

  it("9 — the control no longer writes document.cookie itself", () => {
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    // The server owns the write now; a JS-store write here is exactly what failed on device.
    expect(readSavedLocale(document.cookie)).toBeNull();
  });

  it("the component performs no cookie WRITE", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/LangSwitch.tsx", "utf8");
    // The word appears in the comment recording WHY the write was removed; what must be absent is
    // the assignment. Banning the substring would have forced deleting the explanation.
    expect(src).not.toMatch(/document\.cookie\s*=/);
    expect(src).not.toContain("saveLocalePreference");
  });
});

describe("R4-R4B-R1N-R1 · 7/9 · navigation is unchanged", () => {
  /** The prefix swap and query preservation still happen — they now ride inside `next`. */
  const nextOf = (testId: string) =>
    decodeURIComponent(new URL(screen.getByTestId(testId).getAttribute("href")!, "https://x.dev").searchParams.get("next") ?? "");

  it("7 — the destination still swaps only the path prefix and keeps the query", () => {
    pathname = "/en/app";
    search = "tab=me";
    render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(nextOf("lang-switch-ko")).toBe("/ko/app?tab=me");
    expect(nextOf("lang-switch-en")).toBe("/en/app?tab=me");
  });

  it("ensureParams still merges over an empty query", () => {
    pathname = "/en/app";
    search = "";
    render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(nextOf("lang-switch-ko")).toBe("/ko/app?tab=me");
  });

  it("9 — the click does not preventDefault, so the navigation still happens", () => {
    render(<LangSwitch />);
    const link = screen.getByTestId("lang-switch-ko");
    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(evt);
    expect(evt.defaultPrevented, "the href must still navigate").toBe(false);
  });
});

describe("R4-R4B-R1N-R1 · 8 · auth cookies are untouched", () => {
  it("a language change touches no auth cookie in the client at all", () => {
    document.cookie = "sb-access-token=SESSIONVALUE; path=/";
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    // The component writes nothing now; the session cookie is untouched, and so is the preference
    // (which the SERVER will set on the response to the link's own navigation).
    expect(document.cookie).toContain("sb-access-token=SESSIONVALUE");
    expect(readSavedLocale(document.cookie)).toBeNull();
  });
});
