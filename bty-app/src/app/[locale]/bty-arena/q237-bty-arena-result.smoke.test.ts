/**
 * C6 SPRINT 237 — bty-arena/result route smoke (RSC render + 핵심 문자열).
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

import ResultPage from "./record/page";

describe("bty-arena/result smoke (237)", () => {
  it("renders result headline + XP lines + CTAs", async () => {
    const el = (await ResultPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html).toMatch(/Decision recorded|Simulation Complete/i);
    expect(html).toMatch(/Core XP|Weekly XP/);
    expect(html).toMatch(/Continue|Arena/);
    expect(html).toMatch(/Next scenario|Continue|Return to Arena/i);
  });
});
