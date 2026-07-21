/** @vitest-environment jsdom */
/**
 * LocaleLayoutHeader app-shell purity — Slice 3.1B-3E.3 contract C.
 *
 * The shared `[locale]` layout wraps `/{locale}/app`, so the global locale header must NOT
 * render inside the BtyDailyAppShell (the canonical app-shell experience owns its own chrome;
 * a web locale header would read as legacy web-page smell). This locks that it returns null on
 * `/en/app` and `/ko/app` (and nested), while still rendering the switch on a neutral web route.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { LocaleLayoutHeader } from "./LocaleLayoutHeader";

let mockPath = "/en/some-web-page";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));
vi.mock("@/components/LangSwitch", () => ({
  LangSwitch: () => <div data-testid="lang-switch" />,
}));

function headerHtml(path: string): string {
  mockPath = path;
  const { container } = render(<LocaleLayoutHeader />);
  return container.innerHTML;
}

describe("LocaleLayoutHeader — app-shell purity", () => {
  it("renders NOTHING on /en/app", () => {
    expect(headerHtml("/en/app")).toBe("");
  });
  it("renders NOTHING on /ko/app", () => {
    expect(headerHtml("/ko/app")).toBe("");
  });
  it("renders NOTHING on a nested app-shell route /en/app?tab=foundry equivalent path", () => {
    expect(headerHtml("/en/app/anything")).toBe("");
  });
  it("still renders the switch on a neutral web route", () => {
    expect(headerHtml("/en/some-web-page")).toContain("lang-switch");
  });
});
