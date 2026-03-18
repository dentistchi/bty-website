/**
 * C6 SPRINT 237 — bty-arena/result route smoke (RSC render + 핵심 문자열).
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

import ResultPage from "./result/page";

describe("bty-arena/result smoke (237)", () => {
  it("renders Simulation Complete + XP lines", async () => {
    const el = (await ResultPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html).toContain("Simulation Complete");
    expect(html).toMatch(/Core XP|Weekly XP/);
    expect(html).toMatch(/Continue|Arena/);
    expect(html).toMatch(/Next scenario/i);
  });
});
