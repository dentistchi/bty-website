import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import catalog from "../src/domain/clinical-pilot/catalog.json";
import { applyPilotAction, referenceFor, type AuthorCase, type PilotCase, type PilotTrace } from "../src/domain/clinical-pilot/pilot";
import { applyDiscoveryAction, discoveryTurns, initialAssessment, startDiscoveryPilot, type DiscoveryReply } from "../src/domain/clinical-pilot/discovery";

// Browser receives only UI code and public API responses. Private fixture facts
// and author references stay in this Node-side route handler, outside the bundle.
// Run with PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1, project public.
const root = path.resolve(__dirname, "..");
const source = catalog[0] as AuthorCase;
const opening = "One of my lower back teeth hurts sometimes.";
const foodAnswer = "It is a sharp pain when I eat hard food.";
const restorationAnswer = "A large MOD restoration is present on the mandibular molar.";
const publicCases: PilotCase[] = catalog.map(c => ({ caseId: c.caseId, number: c.number, version: c.version,
  title: "Patient encounter " + String(c.number).padStart(3, "0"),
  scenario: c.number === 1 ? opening : "I would like to discuss a dental concern.", findings: [],
  question: "Meet the patient and decide what to ask or examine.", available: true }));
let html: string, bundle: string;
test.beforeAll(async () => {
  const sourceFiles = ["ClinicalCasesPractice.tsx", "ClinicalDiscoveryAttempt.tsx", "ClinicalReasoningTrainer.tsx"]
    .map(name => ({ raw: readFileSync(path.join(root, "src/components/bty-arena", name), "utf8"), extension: "tsx" }));
  const css = await postcss([tailwindcss({ content: sourceFiles })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css.css + '</style><div id="app"></div>';
  bundle = buildSync({
    stdin: { resolveDir: root, loader: "tsx", contents: [
      'import { createRoot } from "react-dom/client";',
      'import { ClinicalCasesPractice } from "@/components/bty-arena/ClinicalCasesPractice";',
      'createRoot(document.getElementById("app")).render(<ClinicalCasesPractice />);',
    ].join("\n") },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
  }).outputFiles[0].text;
});

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test("discover, assess, compare, and restart at " + viewport.width + "px", async ({ page }) => {
    let trace: PilotTrace | null = null;
    const writes: Record<string, any>[] = [];
    await page.setViewportSize(viewport);
    await page.route("**/*", route => route.abort());
    await page.route("https://pilot.test/", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.route("https://pilot.test/api/bty/clinical-pilot**", async route => {
      const req = route.request();
      if (req.method() === "GET") {
        const body = req.url().includes("caseId=") ? { ok: true, traces: trace ? [{ raw_trace: trace }] : [] }
          : { ok: true, cases: publicCases, userId: "fixture-owner", isAdmin: false };
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
        return;
      }
      const body = req.postDataJSON(); writes.push(body);
      const at = new Date(Date.UTC(2026, 9, 23, 10, 0, writes.length)).toISOString();
      if (body.operation === "start") {
        trace = startDiscoveryPilot(body.traceId, publicCases[0], "fixture-hash", body.requestId, at, !!trace, "fixture-pack-v1");
      } else if (body.operation === "react") {
        trace = applyPilotAction(trace!, body, body.requestId, at, referenceFor(source));
      } else {
        const known = body.operation === "message" && body.channel === "patient" && /hard|hurt|chew/i.test(body.text)
          ? { text: foodAnswer, ids: ["symptom-trigger"] }
          : body.operation === "message" && body.channel === "exam" && /restoration|visual/i.test(body.text)
            ? { text: restorationAnswer, ids: ["restoration"] } : null;
        const reply: DiscoveryReply = { channel: body.channel, text: known?.text ?? "That information is not available in this encounter.",
          factIds: known?.ids ?? [], availableFactIds: known?.ids ?? [], unavailableFactIds: [],
          resolution: known ? "answered" : "unavailable", routing: { method: "authored-rules", version: "fixture-v1" } };
        trace = applyDiscoveryAction(trace!, body, body.requestId, at, referenceFor(source), body.operation === "message" ? reply : undefined);
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, trace }) });
    });
    await page.goto("https://pilot.test/");
    await page.addScriptTag({ content: bundle });
    await expect(page.getByText("23 available · 23 recorded cases")).toBeVisible();
    await page.getByRole("button", { name: /Case 001/ }).click();
    await page.getByRole("button", { name: "Begin encounter", exact: true }).click();
    const composer = page.getByLabel("Your question or examination request");
    await expect(composer).toBeVisible();
    await expect(page.getByText(opening, { exact: true })).toBeVisible();
    await expect(page.getByText(restorationAnswer, { exact: true })).toHaveCount(0);
    await expect(page.getByLabel(/^Evaluation/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toHaveCount(0);

    await composer.fill("What makes the tooth hurt?");
    await page.getByRole("button", { name: "Send question", exact: true }).click();
    await expect(page.getByText(foodAnswer, { exact: true })).toBeVisible();
    await expect(page.getByText(restorationAnswer, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Examine or test", exact: true }).click();
    await composer.fill("Inspect the restoration");
    await page.getByRole("button", { name: "Request examination", exact: true }).click();
    await expect(page.getByText(restorationAnswer, { exact: true })).toBeVisible();
    await expect(composer).toHaveValue("");
    await composer.scrollIntoViewIfNeeded();
    expect(await composer.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("conversation.png"), fullPage: true });

    await page.getByRole("button", { name: "Record working assessment", exact: true }).click();
    await page.getByLabel(/Your assessment and plan/).fill("A structural cause is possible. I need more information before treatment.");
    await page.getByRole("button", { name: "Save working assessment", exact: true }).click();
    await expect(composer).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Finish assessment", exact: true }).click();
    const assessment = "I would assess remaining tooth structure and the bite before deciding on restoration, and explain the uncertainty.";
    await page.getByLabel(/Your assessment and plan/).fill(assessment);
    await page.getByRole("button", { name: "Submit assessment & compare", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toBeVisible();
    await expect(page.getByText("English paraphrase · awaiting author review")).toBeVisible();
    expect(initialAssessment(trace!)).toBe(assessment);
    expect(discoveryTurns(trace!).map(turn => [turn.channel, turn.question])).toEqual([
      ["patient", "What makes the tooth hurt?"], ["exam", "Inspect the restoration"],
    ]);
    const committed = trace!;
    await page.getByLabel("Was this comparison helpful?").selectOption("partly");
    await page.getByLabel(/What stood out/).fill("The bite question changes the information I would collect.");
    await page.getByLabel(/Would you change your plan/).fill("I would ask about the bite feeling off.");
    await page.getByRole("button", { name: "Save reaction & finish", exact: true }).click();
    await expect(page.getByText("Encounter completed. Your conversation, initial assessment, and reaction are saved separately.")).toBeVisible();
    expect(trace!.events.slice(0, committed.events.length)).toEqual(committed.events);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("comparison.png"), fullPage: true });
    await page.getByRole("button", { name: "Start new attempt", exact: true }).click();
    await expect(composer).toHaveValue("");
    await expect(page.getByText(foodAnswer, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true })).toHaveCount(0);
    expect(discoveryTurns(trace!)).toHaveLength(0);
  });
}
