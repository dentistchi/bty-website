import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Real React view + generated CSS; in-memory API fixture only. No server,
// authentication seeding, external service, or production write is possible.
const root = path.resolve(__dirname, "..");
let html: string, bundle: string;
test.beforeAll(async () => {
  const source = readFileSync(path.join(root, "src/components/bty-arena/ClinicalCasesPractice.tsx"), "utf8");
  const css = await postcss([tailwindcss({ content: [{ raw: source, extension: "tsx" }] })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><div id="app"></div>`;
  bundle = buildSync({
    stdin: { resolveDir: root, loader: "tsx", contents: `
      import { createRoot } from "react-dom/client";
      import { ClinicalCasesPractice } from "@/components/bty-arena/ClinicalCasesPractice";
      import catalog from "@/domain/clinical-pilot/catalog.json";
      import { applyPilotAction, publicCase, referenceFor, startPilot } from "@/domain/clinical-pilot/pilot";
      let trace = null;
      window.fetch = async (url, init) => {
        if (!init?.body) return Response.json(String(url).includes("caseId=") ? {ok:true,traces:trace?[{raw_trace:trace}]:[]}
          : {ok:true,cases:catalog.map(publicCase),userId:"fixture-user",isAdmin:false});
        const body = JSON.parse(init.body);
        const c = catalog.find(c => c.caseId === (body.caseId ?? trace.caseId));
        if (body.operation === "start") trace = startPilot(body.traceId, publicCase(c), "fixture", body.requestId, new Date().toISOString(), false);
        else trace = applyPilotAction(trace, body, body.requestId, new Date().toISOString(), referenceFor(c));
        return Response.json({ok:true,trace});
      };
      createRoot(document.getElementById("app")).render(<ClinicalCasesPractice />);
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
  }).outputFiles[0].text;
});
for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`capture, compare, and react at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/*", route => route.abort());
    // A local document gives browser draft recovery a same-origin storage context.
    await page.route("https://pilot.test/", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto("https://pilot.test/");
    await page.addScriptTag({ content: bundle });
    await expect(page.getByText("23 available · 23 recorded cases")).toBeVisible();
    await page.getByRole("button", { name: /Case 023/ }).click();
    await page.getByRole("button", { name: "Start case", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toHaveCount(0);
    for (const [label, value] of [["Evaluation", "Inspect contact and occlusion"], ["Working diagnosis", "Open contact; cause uncertain"], ["Treatment plan", "Assess #29 restoration"], ["Reasoning", "Discuss options before correcting the contact"]]) await page.getByLabel(new RegExp("^" + label)).fill(value);
    await page.getByRole("button", { name: "Submit & compare" }).click();
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toBeVisible();
    await expect(page.getByText("English paraphrase · awaiting author review")).toBeVisible();
    await page.getByLabel("Was this comparison helpful?").selectOption("partly");
    await page.getByLabel(/What stood out/).fill("The contact may be corrected on #29.");
    await page.getByLabel(/Would you change your plan/).fill("I would compare the contours first.");
    await page.getByRole("button", { name: "Save reaction & finish" }).click();
    await expect(page.getByText("Case completed. Your initial response and reaction are saved separately.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("comparison.png"), fullPage: true });
    await page.getByRole("button", { name: "Start new attempt" }).click();
    await expect(page.getByLabel(/^Evaluation/)).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toHaveCount(0);
  });
}
