import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * REAL-PIXEL GATE — target confirmation on the physical app viewport (Slice 3.2L-R1.4).
 *
 * THE DEFECT THIS EXISTS TO PREVENT. The confirmation shipped with every element present
 * in the DOM and every unit test green — and on the physical iPhone it showed a blank
 * panel with only the gold button. The shared `Modal` panel is `bg-foundry-white`
 * (#FFFFFF) and this content is written in white for the dark Builder surface, so label,
 * focus statement, explanatory copy and "Go back" all rendered at contrast 1.00:1.
 * Measured, not inferred: reverting the fix reproduces exactly that.
 *
 * jsdom cannot catch this. It has no layout and no cascade, so "the element exists" and
 * "the Host can read it" are the same assertion there — which is why the defect reached a
 * Founder gate. This test compiles the real component with the real Tailwind build, opens
 * it in Chromium at the iPhone viewport, and asserts CONTRAST and BOUNDS.
 *
 * SKIPS LOUDLY when Playwright/Chromium is unavailable.
 */

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14/15 CSS px
const MIN_CONTRAST = 4.5; // WCAG AA body text
const CANONICAL_FOCUS = "Our handoffs are inconsistent.";
const KOREAN_FOCUS = "새로운 의사들의 교만이 문제야";
const LONG_FOCUS =
  "Our handoffs at shift change keep missing the double-check step and this creates real risk for the next team, especially on the night shift.";

let chromium: typeof import("playwright").chromium | null = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  chromium = null;
}

const ROOT = process.cwd();
let dir = "";
let built = false;

function build(focus: string): void {
  writeFileSync(
    join(dir, "entry.tsx"),
    `import React from "react";
     import { createRoot } from "react-dom/client";
     import { ProgramAuthorship } from "../ProgramAuthorship";
     const ANSWERS = { problem: ${JSON.stringify(focus)}, audienceType: "everyone",
       recurringMoment: "at each handoff point",
       observableBehavior: "Create a shared handoff standard.", successEvidence: "Handoff record",
       learningNeeds: ["know"], materialIntent: "youtube", materialText: "https://youtu.be/x",
       completionPrompt: "What will you include?", followUpDays: 7 };
     createRoot(document.getElementById("root")).render(
       React.createElement("div", { style: { minHeight: "100dvh", background: "#0B1F3A", padding: 16 } },
         React.createElement(ProgramAuthorship, {
           draftId: "093b0361-7cc8-4688-9f93-396d60582501", locale: "en", answers: ANSWERS, journey: undefined, ready: true,
           onGenerate: async () => ({ ok: false, code: "provider_unavailable" }), onApply: () => {},
         })));`,
  );
  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <link rel="stylesheet" href="./app.css"><style>html,body{margin:0;background:#0B1F3A}</style></head>
     <body><div id="root"></div><script src="./bundle.js"></script></body></html>`,
  );
  try {
    execFileSync("npx", ["esbuild", join(dir, "entry.tsx"), "--bundle", `--outfile=${join(dir, "bundle.js")}`,
      "--define:process.env.NODE_ENV=\"production\"", "--jsx=automatic", `--tsconfig=${join(ROOT, "tsconfig.json")}`,
      "--format=iife", "--log-level=error"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    throw new Error(`esbuild failed:\n${String((e as { stderr?: Buffer }).stderr ?? e)}`);
  }
  if (!built) {
    execFileSync("npx", ["tailwindcss", "-c", join(ROOT, "tailwind.config.ts"), "-i", join(ROOT, "src/app/globals.css"),
      "-o", join(dir, "app.css"), "--content", "./src/components/**/*.tsx", "--minify"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    built = true;
  }
}

type Measured = {
  present: boolean; visible: boolean; inViewport: boolean; contrast: number;
  color: string; bg: string; width: number; height: number;
};

async function openConfirmation(focus: string) {
  build(focus);
  const browser = await chromium!.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(`file://${join(dir, "index.html")}`);
  await page.waitForSelector('[data-testid="program-generate"]');
  await page.click('[data-testid="program-generate"]');
  await page.waitForSelector('[data-testid="program-target-confirm"]');
  await page.waitForTimeout(300);

  const measure = async (selector: string): Promise<Measured> => {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) {
      return { present: false, visible: false, inViewport: false, contrast: 0, color: "", bg: "", width: 0, height: 0 };
    }
    const box = await el.boundingBox();
    const s = await el.evaluate((node) => {
      const c = getComputedStyle(node as Element);
      let bg = "rgba(0, 0, 0, 0)";
      let p: Element | null = node as Element;
      while (p && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; }
      return { color: c.color, bg };
    });
    const rgb = (v: string) => (v.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (x: number) => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const L1 = lum(rgb(s.color)); const L2 = lum(rgb(s.bg));
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return {
      present: true,
      visible: await el.isVisible(),
      inViewport: !!box && box.y >= 0 && box.y + box.height <= VIEWPORT.height && box.x >= 0,
      contrast: (hi + 0.05) / (lo + 0.05),
      color: s.color, bg: s.bg,
      width: box?.width ?? 0, height: box?.height ?? 0,
    };
  };
  return { browser, page, measure };
}

/**
 * The harness lives INSIDE the project on purpose. esbuild resolves `react` by walking up
 * from the entry file, so an entry in the OS temp directory cannot see node_modules —
 * measured, not guessed: it failed with `Could not resolve "react"`.
 */
beforeAll(() => { if (chromium) { dir = join(ROOT, "src/components/foundry/event-rooms/.viewport-harness"); mkdirSync(dir, { recursive: true }); } }, 60_000);
afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); }, 30_000);

describe.runIf(Boolean(chromium) && existsSync(join(process.cwd(), "tailwind.config.ts")))(
  "[3.2L-R1.4] the confirmation is READABLE on the physical app viewport",
  () => {
    it("G1/G5 — every required element is visible, in-viewport and legible", async () => {
      const { browser, measure } = await openConfirmation(CANONICAL_FOCUS);
      try {
        const required: [string, string][] = [
          ["Training program target", "text=Training program target"],
          ["focus statement", '[data-testid="program-target-focus"]'],
          ["explanatory copy", "text=Nothing will be added or published"],
          ["primary action", '[data-testid="program-target-confirm-action"]'],
          ["Go back", '[data-testid="program-target-cancel"]'],
        ];
        for (const [label, sel] of required) {
          const m = await measure(sel);
          expect(m.present, `${label} missing`).toBe(true);
          expect(m.visible, `${label} not visible`).toBe(true);
          expect(m.inViewport, `${label} outside the 390x844 viewport`).toBe(true);
          expect(m.width, `${label} has zero width`).toBeGreaterThan(0);
          expect(m.height, `${label} has zero height`).toBeGreaterThan(0);
          // The whole defect: present, sized, and completely unreadable.
          expect(
            m.contrast,
            `${label} contrast ${m.contrast.toFixed(2)}:1 (${m.color} on ${m.bg}) — white-on-white regression`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      } finally {
        await browser.close();
      }
    }, 180_000);

    it("G4 — the panel is not an unexplained blank region, and touch targets survive", async () => {
      const { browser, page, measure } = await openConfirmation(CANONICAL_FOCUS);
      try {
        const panel = await page.locator('[data-testid="program-target-confirm"]').evaluate((e) => {
          const r = (e as Element).getBoundingClientRect();
          return { height: r.height, scrollH: (e as Element).scrollHeight, clientH: (e as Element).clientHeight };
        });
        const content = await measure('[data-testid="program-target-focus"]');
        // Content must occupy the panel — a tall panel holding only a button is the bug.
        expect(panel.height).toBeGreaterThan(content.height);
        expect(panel.scrollH, "no hidden overflow at normal length").toBeLessThanOrEqual(panel.clientH + 2);
        for (const sel of ['[data-testid="program-target-confirm-action"]', '[data-testid="program-target-cancel"]']) {
          expect((await measure(sel)).height, `${sel} below 44px`).toBeGreaterThanOrEqual(44);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow, "horizontal overflow").toBe(false);
      } finally {
        await browser.close();
      }
    }, 180_000);

    it("G2/G3 — the canonical and Korean targets render legibly and differently", async () => {
      for (const focus of [CANONICAL_FOCUS, KOREAN_FOCUS]) {
        const { browser, page, measure } = await openConfirmation(focus);
        try {
          const m = await measure('[data-testid="program-target-focus"]');
          expect(m.visible).toBe(true);
          expect(m.contrast).toBeGreaterThanOrEqual(MIN_CONTRAST);
          expect(await page.locator('[data-testid="program-target-focus"]').textContent()).toBe(focus);
        } finally {
          await browser.close();
        }
      }
    }, 240_000);

    it("G7 — a long focus keeps its tail readable and both actions reachable", async () => {
      const { browser, page, measure } = await openConfirmation(LONG_FOCUS);
      try {
        const focus = page.locator('[data-testid="program-target-focus"]');
        expect(await focus.textContent()).toBe(LONG_FOCUS);
        const m = await measure('[data-testid="program-target-focus"]');
        expect(m.contrast).toBeGreaterThanOrEqual(MIN_CONTRAST);
        // Wrapped, not truncated to one line.
        expect(m.height).toBeGreaterThan(30);
        // Both actions still reachable — scrolling the panel is allowed, hiding them is not.
        for (const sel of ['[data-testid="program-target-confirm-action"]', '[data-testid="program-target-cancel"]']) {
          await page.locator(sel).scrollIntoViewIfNeeded();
          expect(await page.locator(sel).isVisible()).toBe(true);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      } finally {
        await browser.close();
      }
    }, 180_000);
  },
);
