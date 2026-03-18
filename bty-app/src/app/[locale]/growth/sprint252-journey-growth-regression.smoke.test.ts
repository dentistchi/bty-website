/**
 * C5 SPRINT 252 — Journey·Comeback·Growth 서브네비 회귀: i18n 비어 있지 않음, Growth RSC에
 * Journey 딥링크·Dojo→Journey 순서, ko 경로, Arena 루트에 Journey CTA 미삽입(정책).
 */
import { readFileSync } from "fs";
import path from "path";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages } from "@/lib/i18n";

import GrowthPage from "./page";

describe("SPRINT 252 Growth·Journey·Comeback regression (C5)", () => {
  it("en/ko i18n: Comeback + Growth subnav keys non-empty", () => {
    for (const loc of ["en", "ko"] as const) {
      const t = getMessages(loc).uxPhase1Stub;
      expect(t.comebackTitle.trim()).not.toHaveLength(0);
      expect(t.comebackBody.trim()).not.toHaveLength(0);
      expect(t.comebackResumeJourneyCta.trim()).not.toHaveLength(0);
      expect(t.comebackNotNowCta.trim()).not.toHaveLength(0);
      expect(t.growthNavJourneyTitle.trim()).not.toHaveLength(0);
      expect(t.growthNavDojoTitle.trim()).not.toHaveLength(0);
      expect(t.growthNavIntegrityTitle.trim()).not.toHaveLength(0);
      expect(t.growthNavGuidanceTitle.trim()).not.toHaveLength(0);
      expect(t.growthBackToGrowth.trim()).not.toHaveLength(0);
      expect(t.growthHubHeadline.trim()).not.toHaveLength(0);
      expect(t.growthCardJourneyDesc.trim()).not.toHaveLength(0);
    }
  });

  it("/en/growth RSC: Journey + Growth-scoped card hrefs; Dojo before Journey", async () => {
    const el = (await GrowthPage({
      params: Promise.resolve({ locale: "en" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html.length).toBeGreaterThan(200);
    expect(html).toContain("/en/growth/journey");
    expect(html).toContain("/en/growth/dojo");
    expect(html).toContain("/en/growth/integrity");
    expect(html).toContain("/en/growth/guidance");
    expect(html.indexOf("/en/growth/dojo")).toBeLessThan(html.indexOf("/en/growth/journey"));
  });

  it("/ko/growth RSC: /ko/growth/journey present", async () => {
    const el = (await GrowthPage({
      params: Promise.resolve({ locale: "ko" }),
    })) as ReactElement;
    const html = renderToString(el);
    expect(html).toContain("/ko/growth/journey");
  });

  it("policy: root bty-arena/page.tsx does not reference Growth Journey route or JourneyBoard", () => {
    const arenaPage = path.join(
      process.cwd(),
      "src/app/[locale]/bty-arena/page.tsx"
    );
    const src = readFileSync(arenaPage, "utf8");
    expect(src).not.toMatch(/growth\/journey/);
    expect(src).not.toMatch(/JourneyBoard/);
  });
});
