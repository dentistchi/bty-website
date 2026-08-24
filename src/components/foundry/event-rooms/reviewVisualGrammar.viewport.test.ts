import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * REAL-PIXEL GATE — the Review visual grammar, on the physical app viewport (Slice R4-R2E).
 *
 * WHY THIS EXISTS AND NOT JUST THE JSDOM TESTS. This whole slice is a claim about what a Host can
 * SEE. jsdom has no layout and no cascade, so there "the element has the editable class" and "the
 * Host can tell it is editable" are the same assertion — and this repository has already shipped a
 * defect straight through that gap: Slice 3.2L-R1.4's confirmation panel passed every unit test
 * and rendered at contrast 1.00:1 on the physical iPhone.
 *
 * So the two grammars are measured here in a real browser, with the real Tailwind build, at the
 * real viewport: the editable control must be a legible, bordered, distinctly-grounded field, the
 * read-only sentence must be legible and must NOT be a field, and the difference between them must
 * survive with colour removed.
 *
 * SKIPS LOUDLY when Playwright/Chromium is unavailable.
 */

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14/15 CSS px
const MIN_CONTRAST = 4.5; // WCAG AA body text
const DRAFT = "d-r4r2e-px";
const ATTEMPT = "0f5a6f4a-7d4f-4a52-9a0d-9c0a1a6b2f11";

let chromium: typeof import("playwright").chromium | null = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  chromium = null;
}

const ROOT = process.cwd();
let dir = "";

/**
 * The page renders BOTH grammars together, from the real components:
 *   `ProgramAuthorship`, resumed into its review from the real continuity cache → the read-only
 *   derived sentence; `JourneyPreview` over a real journey → the editable learner-facing field.
 * Nothing is re-implemented for the test — a hand-built approximation would measure the harness.
 */
function build(): void {
  writeFileSync(
    join(dir, "entry.tsx"),
    `import React from "react";
     import { createRoot } from "react-dom/client";
     import { ProgramAuthorship } from "../ProgramAuthorship";
     import { JourneyPreview } from "../JourneyPreview";
     import { writeCachedProposal } from "../proposalContinuity";
     import { PROGRAM_AUTHORSHIP_VERSION, programContext, programContextFingerprint } from "../../../../domain/foundry/module/program-authorship";

     const el = (kind, content) => ({ kind, content, rationale: "because it fits" });
     const ANSWERS = {
       title: "Close the Loop on One Commitment",
       problem: "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
       audienceType: "everyone",
       recurringMoment: "At the end of a team huddle when there are open action items",
       observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
       successEvidence: "The huddle notes show a named owner and deadline.",
       evidenceType: "seen",
       learningNeeds: ["decide", "shared_standard"],
       materialIntent: "youtube", materialText: "https://youtu.be/x",
       completionPrompt: "What two things should be clear before a huddle ends?",
       capabilityCandidate: "Accountability", arenaRecommended: false, followUpDays: 7,
     };
     const PROPOSAL = {
       displayTitle: "Close the loop on one commitment",
       elements: [
         el("why_it_matters", "When an action leaves a huddle without an owner, the work stalls."),
         el("observable_standard", "Before the huddle ends, the facilitator names one owner and one deadline."),
         el("action_decision", "I will name one owner and one deadline before the huddle ends."),
         el("field_application", "At your next huddle, you name one owner and one deadline."),
         el("completion_check", "What two things should be clear before a huddle ends?"),
         el("follow_up", "In seven days you will be asked what you actually said."),
       ],
       assumptions: [], warnings: [], evidenceLanguage: "",
       behaviorContract: {
         actor: "the facilitator",
         trigger: "At the end of a team huddle when there are open action items",
         observableAction: "name one owner and one deadline for each open action item",
         completion: { criterion: "The huddle notes show a named owner and deadline." },
       },
       scenarioContract: null,
       applicationContract: { applicationMoment: "The next time this happens" },
       completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
       followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
       operationalConstruct: null,
     };
     const FINGERPRINT = programContextFingerprint(programContext(ANSWERS));
     writeCachedProposal(${JSON.stringify(DRAFT)}, {
       attemptId: ${JSON.stringify(ATTEMPT)}, contextFingerprint: FINGERPRINT,
       proposal: PROPOSAL, evidenceCeiling: "", authorityVersion: PROGRAM_AUTHORSHIP_VERSION,
     });

     const JOURNEY = {
       version: 1, displayTitle: "End every huddle with an owner", displayTitleStatus: "grounded",
       elements: [{
         id: "el_observable_standard", kind: "observable_standard",
         content: "Before the huddle ends, the facilitator names one owner and one deadline.",
         grounding: [{ sourceType: "host_statement", field: "problem" }],
         confirmationStatus: "grounded",
       }],
     };

     createRoot(document.getElementById("root")).render(
       React.createElement("div", { style: { minHeight: "100dvh", background: "#0B1F3A", padding: 16 } },
         React.createElement(ProgramAuthorship, {
           draftId: ${JSON.stringify(DRAFT)}, answers: ANSWERS, journey: undefined, ready: true,
           currentContextFingerprint: FINGERPRINT,
           onGenerate: async () => ({ ok: false, code: "provider_unavailable" }),
           onCheckResume: async () => true,
           onApply: async () => ({ status: "adopted" }),
         }),
         React.createElement(JourneyPreview, {
           answers: { ...ANSWERS, realityGroundedJourneyV1: JOURNEY },
           onPatch: () => {}, onApprovableChange: () => {},
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
  execFileSync("npx", ["tailwindcss", "-c", join(ROOT, "tailwind.config.ts"), "-i", join(ROOT, "src/app/globals.css"),
    "-o", join(dir, "app.css"), "--content", "./src/components/**/*.tsx", "--minify"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
}

type Measured = {
  present: boolean; visible: boolean; contrast: number;
  color: string; bg: string; ownBg: string; borderWidth: number; borderColor: string;
  width: number; height: number;
};

async function open() {
  build();
  const browser = await chromium!.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(`file://${join(dir, "index.html")}`);
  await page.waitForSelector('[data-testid="program-review"]');
  await page.waitForSelector('[data-testid="journey-preview"]');
  /*
    R4-R2E-R4 — the program sections are a disclosure now, closed by default, so the read-only
    grammar has to be OPENED before it can be measured. Expanding here rather than relaxing the
    assertion: the question "is BTY's sentence legible and not shaped like a field" is still
    exactly the right one, it is just one tap further in.
  */
  /*
    Opened on a section BTY still RENDERS (Slice R4-R5C14A). THE STANDARD is the Host's own
    sentence now and shows an editable field, so it can no longer demonstrate the read-only
    grammar this test measures.
  */
  await page.click('[data-testid="program-section-toggle-action_decision"]');
  await page.waitForTimeout(300);

  const measure = async (selector: string): Promise<Measured> => {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) {
      return { present: false, visible: false, contrast: 0, color: "", bg: "", ownBg: "", borderWidth: 0, borderColor: "", width: 0, height: 0 };
    }
    const box = await el.boundingBox();
    const s = await el.evaluate((node) => {
      const c = getComputedStyle(node as Element);
      /*
        THE EFFECTIVE BACKGROUND, COMPOSITED — not "the first ancestor with a background".
        The editable field's ground is `bg-white/[0.07]`: a SEMI-transparent layer. Taking it as
        the background and comparing white text against it reports 1.00:1 and reads as the
        invisible-text regression, when what is actually on screen is 7% white over the navy
        card. Every layer up to the first opaque one is composited, in paint order.
      */
      const parse = (v: string): [number, number, number, number] => {
        const n = (v.match(/[\d.]+/g) ?? []).map(Number);
        return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n.length > 3 ? n[3]! : v === "transparent" ? 0 : 1];
      };
      const layers: [number, number, number, number][] = [];
      let p: Element | null = node as Element;
      while (p) {
        const l = parse(getComputedStyle(p).backgroundColor);
        if (l[3] > 0) layers.push(l);
        if (l[3] >= 1) break;
        p = p.parentElement;
      }
      // Nothing opaque found (a page with no painted background) — fall back to the document's.
      const base = parse(getComputedStyle(document.body).backgroundColor);
      let out: [number, number, number] = layers.length && layers[layers.length - 1]![3] >= 1
        ? [layers[layers.length - 1]![0], layers[layers.length - 1]![1], layers[layers.length - 1]![2]]
        : [base[0], base[1], base[2]];
      // Farthest-to-nearest, each layer painted over what is already there.
      for (let i = layers.length - (layers[layers.length - 1]![3] >= 1 ? 2 : 1); i >= 0; i--) {
        const [r, g, b, a] = layers[i]!;
        out = [a * r + (1 - a) * out[0], a * g + (1 - a) * out[1], a * b + (1 - a) * out[2]];
      }
      // The text colour itself may be semi-transparent — composite it over that result too.
      const [tr, tg, tb, ta] = parse(c.color);
      const text: [number, number, number] = [
        ta * tr + (1 - ta) * out[0], ta * tg + (1 - ta) * out[1], ta * tb + (1 - ta) * out[2],
      ];
      const fmt = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      return {
        color: fmt(text), bg: fmt(out), ownBg: c.backgroundColor,
        // The four-sided box is what makes something look like a field. A single left rule is not.
        borderWidth: Math.min(
          parseFloat(c.borderTopWidth) || 0, parseFloat(c.borderRightWidth) || 0,
          parseFloat(c.borderBottomWidth) || 0, parseFloat(c.borderLeftWidth) || 0,
        ),
        borderColor: c.borderTopColor,
      };
    });
    const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (x: number) => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const L1 = lum(rgb(s.color)); const L2 = lum(rgb(s.bg));
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return {
      present: true, visible: await el.isVisible(),
      contrast: (hi + 0.05) / (lo + 0.05),
      color: s.color, bg: s.bg, ownBg: s.ownBg,
      borderWidth: s.borderWidth, borderColor: s.borderColor,
      width: box?.width ?? 0, height: box?.height ?? 0,
    };
  };
  return { browser, page, measure };
}

const EDITABLE = '[data-testid="journey-edit-observable_standard"]';
const PROVENANCE = '[data-testid="journey-grounded-observable_standard"]';
// THE STANDARD is the Host's own editable sentence since Slice R4-R5C14A, so the read-only
// grammar is measured on a section BTY still renders.
const READONLY = '[data-testid="program-derived-action_decision"]';

beforeAll(() => { if (chromium) { dir = join(ROOT, "src/components/foundry/event-rooms/.grammar-harness"); mkdirSync(dir, { recursive: true }); } }, 60_000);
afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); }, 30_000);

describe.runIf(Boolean(chromium) && existsSync(join(process.cwd(), "tailwind.config.ts")))(
  "[R4-R2E] the two Review grammars are distinguishable in real pixels",
  () => {
    it("G1/G2 — both are legible, and neither is the invisible-text regression", async () => {
      const { browser, measure } = await open();
      try {
        for (const [label, sel] of [["editable learner field", EDITABLE], ["read-only BTY sentence", READONLY]] as const) {
          const m = await measure(sel);
          expect(m.present, `${label} missing`).toBe(true);
          expect(m.visible, `${label} not visible`).toBe(true);
          expect(m.width, `${label} zero width`).toBeGreaterThan(0);
          expect(m.height, `${label} zero height`).toBeGreaterThan(0);
          expect(
            m.contrast,
            `${label} contrast ${m.contrast.toFixed(2)}:1 (${m.color} on ${m.bg})`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      } finally {
        await browser.close();
      }
    }, 240_000);

    it("G3 — the editable one is a bordered, distinctly-grounded field; the read-only one is not", async () => {
      const { browser, measure } = await open();
      try {
        const editable = await measure(EDITABLE);
        const readOnly = await measure(READONLY);

        // A four-sided boundary, actually painted — this is the "you can type here" affordance.
        expect(editable.borderWidth, "editable field has no full border box").toBeGreaterThan(0);
        expect(editable.borderColor, "editable border is invisible").not.toMatch(/rgba\(.*,\s*0\)$/);
        // And its own ground, distinct from the card it sits on.
        expect(editable.ownBg, "editable field has no field ground").not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

        // The read-only sentence must NOT wear a field box. A left rule is allowed; four sides
        // are exactly the decoy this slice removes.
        expect(readOnly.borderWidth, "read-only text still renders as a boxed field").toBe(0);

        /*
          NOT COLOUR-ONLY. Strip hue entirely and the two must still be different things: one has
          a painted boundary on all four sides and a filled ground, the other has neither.
        */
        const shapeOf = (m: Measured) => `${m.borderWidth > 0 ? "boxed" : "open"}/${/rgba\(0, 0, 0, 0\)|transparent/.test(m.ownBg) ? "unfilled" : "filled"}`;
        expect(shapeOf(editable)).not.toBe(shapeOf(readOnly));
      } finally {
        await browser.close();
      }
    }, 240_000);

    it("[R4-R2E-R3] provenance recedes without becoming unreadable, and the content dominates", async () => {
      /*
        Measured BEFORE the density slice: provenance rendered at 3.14:1 — already under WCAG AA.
        "Make it quieter" as a colour change would have deepened an existing defect, so the
        recession is positional (out of the header row, into a footnote) and the colour was raised
        instead. This pins both halves: still legible, and still smaller than the learner's text.
      */
      const { browser, measure } = await open();
      try {
        const prov = await measure(PROVENANCE);
        const content = await measure(EDITABLE);
        expect(prov.present, "provenance disappeared").toBe(true);
        expect(prov.visible).toBe(true);
        expect(
          prov.contrast,
          `provenance contrast ${prov.contrast.toFixed(2)}:1 (${prov.color} on ${prov.bg})`,
        ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        // G3, in pixels: the learner's words are the taller, larger thing on the card.
        expect(content.height).toBeGreaterThan(prov.height);
      } finally {
        await browser.close();
      }
    }, 240_000);

    it("G3 — the editable field meets the touch target size and does not overflow the viewport", async () => {
      const { browser, page, measure } = await open();
      try {
        const editable = await measure(EDITABLE);
        expect(editable.height, "editable field below the 44px touch target").toBeGreaterThanOrEqual(44);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow, "horizontal overflow at 390px").toBe(false);

        /*
          R4-R2E-R3-R1 — the post-adoption "Review BTY draft" disclosure is the control G2 rests
          on, and it is tapped with a thumb. Measured at 24px on the first pass; pinned here so a
          later tidy cannot shrink it back under the target size.
        */
        await page.click('[data-testid="program-apply"]');
        await page.waitForSelector('[data-testid="program-applied-toggle"]');
        const toggle = await measure('[data-testid="program-applied-toggle"]');
        expect(toggle.height, "post-adoption draft toggle below the 44px touch target").toBeGreaterThanOrEqual(44);
        const after = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(after, "horizontal overflow after adoption").toBe(false);
      } finally {
        await browser.close();
      }
    }, 240_000);
  },
);
