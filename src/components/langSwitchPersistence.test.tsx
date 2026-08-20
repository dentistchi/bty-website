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

describe("R4-R4B-R1N-R1 · 1/2 · an explicit choice is persisted", () => {
  it("1 — selecting KO writes NEXT_LOCALE=ko", () => {
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    expect(readSavedLocale(document.cookie)).toBe("ko");
  });

  it("2 — selecting EN writes NEXT_LOCALE=en", () => {
    pathname = "/ko/app";
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-en"));
    expect(readSavedLocale(document.cookie)).toBe("en");
  });

  it("switching back and forth ends on the LAST explicit choice", () => {
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    fireEvent.click(screen.getByTestId("lang-switch-en"));
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    expect(readSavedLocale(document.cookie)).toBe("ko");
  });
});

describe("R4-R4B-R1N-R1 · 6 · nothing is written without a choice", () => {
  it("merely RENDERING the control saves no preference", () => {
    render(<LangSwitch />);
    // Visiting a page — or following a /ko link someone sent you — must not rewrite a preference.
    expect(readSavedLocale(document.cookie)).toBeNull();
  });

  it("a /ko pathname alone does not imply a Korean preference", () => {
    pathname = "/ko/app";
    render(<LangSwitch />);
    expect(readSavedLocale(document.cookie)).toBeNull();
  });
});

describe("R4-R4B-R1N-R1 · 7/9 · navigation is unchanged", () => {
  it("7 — the links still swap only the path prefix and keep the query", () => {
    pathname = "/en/app";
    search = "tab=me";
    render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(screen.getByTestId("lang-switch-ko").getAttribute("href")).toBe("/ko/app?tab=me");
    expect(screen.getByTestId("lang-switch-en").getAttribute("href")).toBe("/en/app?tab=me");
  });

  it("ensureParams still merges over an empty query", () => {
    pathname = "/en/app";
    search = "";
    render(<LangSwitch ensureParams={{ tab: "me" }} />);
    expect(screen.getByTestId("lang-switch-ko").getAttribute("href")).toBe("/ko/app?tab=me");
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
  it("an existing session cookie survives a language change", () => {
    document.cookie = "sb-access-token=SESSIONVALUE; path=/";
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    expect(document.cookie).toContain("sb-access-token=SESSIONVALUE");
    expect(readSavedLocale(document.cookie)).toBe("ko");
  });
});
