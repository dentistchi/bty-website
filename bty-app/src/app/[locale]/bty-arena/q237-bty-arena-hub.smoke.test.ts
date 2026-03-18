/**
 * C6 — /[locale]/bty-arena hub: RSC + 허브 카피 랜드마크.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

import ArenaHubPage from "./page";

describe("bty-arena hub smoke", () => {
  it("renders hub shell + entry card SSR (loading gate before client hydration)", async () => {
    const el = (await ArenaHubPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toMatch(/Arena/);
    expect(html).toMatch(/Decision, repetition, and pressure training live here/);
    expect(html).toMatch(/Loading/);
    expect(html).toMatch(/arena-hub-card/);
  });
});
