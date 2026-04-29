/**
 * C6 SPRINT 237 — stub route smoke: wireframe, growth, my-page.
 * Renders async RSC pages (en) and checks for stable landmark copy (핵심 문자열).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

import WireframePage from "./wireframe/page";
import GrowthPage from "../growth/page";
import MyPagePage from "../my-page/page";

function smokeHtml(el: ReactElement): string {
  return renderToString(el);
}

describe("stub routes smoke (237)", () => {
  it("/[locale]/bty-arena/wireframe renders key strings", async () => {
    const el = (await WireframePage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = smokeHtml(el);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toMatch(/Play Game|System ready/i);
    expect(html).toMatch(/Continue/i);
    expect(html).toMatch(/region|aria-label/i);
  });

  it("/[locale]/growth renders key strings", async () => {
    const el = (await GrowthPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = smokeHtml(el);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toMatch(/Growth|Dojo 50|Foundry/i);
  });

  it("/[locale]/my-page renders key strings", async () => {
    const el = (await MyPagePage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = smokeHtml(el);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("My Page");
    expect(html).toMatch(/Overview|Identity|Progress/i);
  });
});
