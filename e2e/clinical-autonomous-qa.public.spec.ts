import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import journeysJson from "../scripts/fixtures/clinical-discovery-journeys.v1.json";
import historyJson from "../scripts/fixtures/clinical-discovery-history-regression.v1.json";
import { createQaEncounter, type QaJourney } from "../src/lib/bty/clinical-pilot/discovery-qa.server";
import { discoveryTurns, initialAssessment, type DiscoveryReply } from "../src/domain/clinical-pilot/discovery";
import { releasedReference, type Reaction } from "../src/domain/clinical-pilot/pilot";

// Synthetic full-flow QA. The browser receives the real UI bundle and only the
// public card / issued API replies. Patient packs and references stay in Node.
// No app server, global seed, production auth, database or real model is used.
// PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1, --project=public.
const root = path.resolve(__dirname, "..");
const journeys = journeysJson as QaJourney[];
const normalizeText = (value: string) => value.replace(/\s+/gu, " ").trim();
type QaSession = ReturnType<typeof createQaEncounter>;
let html: string;
let bundle: string;

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

const runs = [
  ...journeys.map(journey => ({ journey, width: 390, height: 844, label: "original-journey" })),
  ...(historyJson as QaJourney[]).flatMap(journey => [320, 390, 1280].map(width => ({
    journey, width, height: 844, label: "reported-history-regression",
  }))),
  ...["drchi-006", "drchi-017"].flatMap(caseId => {
    const journey = journeys.find(j => j.caseId === caseId)!;
    return [{ journey, width: 320, height: 740, label: "original-journey" }, { journey, width: 1280, height: 900, label: "original-journey" }];
  }),
];

for (const { journey, width, height, label } of runs) {
  test(`synthetic full encounter ${journey.caseId} ${label} at ${width}px`, async ({ page }) => {
    test.setTimeout(45_000);
    // The preview provides the neutral public card. Its in-memory trace is not
    // returned by GET; Begin encounter creates the actual UI-selected session.
    const preview = createQaEncounter(journey, { mode: "rules" });
    const card = preview.snapshot;
    let session: QaSession | null = null;
    let issuedReply: DiscoveryReply | null = null;
    const operations: string[] = [];
    const pageErrors: string[] = [];
    const current = (): QaSession => {
      if (!session) throw new Error("The browser has not begun the synthetic encounter");
      return session;
    };
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.route("**/*", route => route.abort());
    await page.route("https://clinical-qa.test/", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.route("https://clinical-qa.test/api/bty/clinical-pilot**", async route => {
      const req = route.request();
      const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (req.method() === "GET") {
        return respond(req.url().includes("caseId=")
          ? { ok: true, traces: session ? [{ raw_trace: session.trace }] : [] }
          : { ok: true, cases: [card], userId: "synthetic-browser-qa", isAdmin: false });
      }
      if (req.method() !== "POST") return respond({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
      const body = req.postDataJSON();
      operations.push(body.operation);
      if (body.operation === "start") {
        if (session || body.caseId !== card.caseId || body.caseVersion !== card.version) {
          return respond({ ok: false, error: "CONFLICT" }, 409);
        }
        session = createQaEncounter(journey, { mode: "rules", traceId: body.traceId, requestId: body.requestId });
      } else {
        if (!session || body.traceId !== session.trace.traceId) return respond({ ok: false, error: "NOT_FOUND" }, 404);
        if (["message", "decision", "conclude"].includes(body.operation)
          && body.expectedEventCount !== session.trace.events.length) return respond({ ok: false, error: "CONFLICT" }, 409);
        if (body.operation === "message") issuedReply = await session.message(body.text, body.channel);
        else if (body.operation === "decision") session.working(body.text);
        else if (body.operation === "conclude") session.conclude(body.text);
        else if (body.operation === "react") session.react(body.reaction as Reaction);
        else return respond({ ok: false, error: "INVALID_OPERATION" }, 400);
      }
      return respond({ ok: true, trace: current().trace });
    });

    await page.goto("https://clinical-qa.test/");
    await page.addScriptTag({ content: bundle });
    await expect(page.getByText("1 available · 1 recorded cases", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`Case ${String(card.number).padStart(3, "0")}`) }).click();
    await page.getByRole("button", { name: "Begin encounter", exact: true }).click();
    const composer = page.getByLabel("Your question or examination request");
    const conversation = page.getByRole("log", { name: "Patient conversation" });
    const renderedArticles = conversation.getByRole("article");
    const referenceHeading = page.getByRole("heading", { name: "Dr. Chi’s recorded approach", exact: true });
    await expect(composer).toBeVisible();
    await expect(conversation.getByText(card.scenario, { exact: true })).toBeVisible();
    await expect(referenceHeading).toHaveCount(0);
    expect(releasedReference(current().trace)).toBeNull();

    for (const [index, turn] of journey.turns.entries()) {
      await page.getByRole("button", { name: turn.channel === "patient" ? "Ask patient" : "Examine or test", exact: true }).click();
      await composer.fill(turn.question);
      issuedReply = null;
      await page.getByRole("button", { name: turn.channel === "patient" ? "Send question" : "Request examination", exact: true }).click();
      await expect(composer).toHaveValue("");
      await expect(renderedArticles).toHaveCount(1 + 2 * (index + 1));
      const saved = discoveryTurns(current().trace).at(-1)!;
      expect(saved.question).toBe(turn.question);
      expect(saved.channel).toBe(turn.channel);
      expect(saved.reply).toEqual(issuedReply);
      // Check the fixed semantic oracle as well as DOM/transport agreement. A
      // faithfully rendered wrong reply must not make an encounter test pass.
      const permitted = [...turn.expectedFactIds, ...(turn.acceptedFactIds ?? [])];
      expect(saved.reply.factIds.filter(id => !permitted.includes(id)), turn.question).toEqual([]);
      expect(turn.expectedFactIds.filter(id => !saved.reply.factIds.includes(id)), turn.question).toEqual([]);
      expect(turn.expectedAvailableFactIds.filter(id => !saved.reply.availableFactIds.includes(id)), turn.question).toEqual([]);
      if (turn.expectedResolution) expect(saved.reply.resolution, turn.question).toBe(turn.expectedResolution);
      for (const pattern of turn.answerPatterns ?? []) expect(saved.reply.text, turn.question).toMatch(new RegExp(pattern, "iu"));
      await expect(renderedArticles.nth(1 + 2 * index).locator("p").nth(1)).toHaveText(normalizeText(turn.question));
      await expect(renderedArticles.nth(2 + 2 * index).locator("p").nth(1)).toHaveText(normalizeText(saved.reply.text));
      await expect(referenceHeading).toHaveCount(0);
      expect(releasedReference(current().trace)).toBeNull();

      if (index === Math.floor(journey.turns.length / 2)) {
        await page.getByRole("button", { name: "Record working assessment", exact: true }).click();
        await page.getByLabel(/Your assessment and plan/).fill("Synthetic QA: more information is needed before choosing treatment.");
        await page.getByRole("button", { name: "Save working assessment", exact: true }).click();
        await expect(composer).toBeVisible();
        expect(current().trace.events.some(event => event.type === "working_assessment")).toBe(true);
        await expect(referenceHeading).toHaveCount(0);
      }
    }
    expect(discoveryTurns(current().trace).map(turn => [turn.channel, turn.question])).toEqual(journey.turns.map(turn => [turn.channel, turn.question]));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Finish assessment", exact: true }).click();
    const assessment = "Synthetic QA: retain the information obtained and acknowledge unanswered questions before selecting treatment.";
    await page.getByLabel(/Your assessment and plan/).fill(assessment);
    await page.getByRole("button", { name: "Submit assessment & compare", exact: true }).click();
    await expect(referenceHeading).toBeVisible();
    expect(initialAssessment(current().trace)).toBe(assessment);
    expect(current().trace.phase).toBe("submitted");
    const comparison = page.getByRole("region", { name: "Approach comparison" });
    await expect(comparison.getByText(normalizeText(releasedReference(current().trace)!.paraphrase), { exact: true })).toBeVisible();
    const turns = discoveryTurns(current().trace);
    const unavailable = turns.filter(({ reply }) => reply.resolution !== "clarify"
      && (reply.resolution === "unavailable" || reply.unavailableFactIds.length > 0 || !!reply.unavailableTopicIds?.length));
    const unresolved = turns.filter(({ reply }) => reply.resolution === "clarify");
    const unavailableHeading = comparison.getByRole("heading", { name: "Information you requested but the case could not provide", exact: true });
    if (unavailable.length) {
      await expect(unavailableHeading).toBeVisible();
      const items = unavailableHeading.locator("..").getByRole("listitem");
      await expect(items).toHaveCount(unavailable.length);
      for (const [index, turn] of unavailable.entries()) {
        await expect(items.nth(index).locator("p").nth(0)).toHaveText(normalizeText(turn.question));
        await expect(items.nth(index).locator("p").nth(1)).toHaveText(normalizeText(turn.reply.text));
      }
    } else await expect(unavailableHeading).toHaveCount(0);
    const unresolvedSummary = comparison.getByText("Requests the simulator could not interpret", { exact: true });
    if (unresolved.length) {
      await expect(unresolvedSummary).toBeVisible();
      await unresolvedSummary.click();
      const items = unresolvedSummary.locator("..").getByRole("listitem");
      await expect(items).toHaveCount(unresolved.length);
      for (const [index, turn] of unresolved.entries()) {
        await expect(items.nth(index).locator("p").nth(0)).toHaveText(normalizeText(turn.question));
        await expect(items.nth(index).locator("p").nth(1)).toHaveText(normalizeText(turn.reply.text));
      }
    } else await expect(unresolvedSummary).toHaveCount(0);
    await expect(comparison.getByText("This is a recorded reference, not feedback that you missed these questions.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const beforeReaction = structuredClone(current().trace);
    const reaction: Reaction = { helpful: "partly", comment: "Synthetic QA verifies the flow; this is not a doctor's training response.",
      revisedPlan: "Retain uncertainty where the case lacks information." };
    await page.getByLabel("Was this comparison helpful?").selectOption(reaction.helpful);
    await page.getByLabel("What stood out, or what do you disagree with? (optional)", { exact: true })
      .fill(reaction.comment);
    await page.getByLabel("Would you change your plan? (optional)", { exact: true }).fill(reaction.revisedPlan);
    await page.getByRole("button", { name: "Save reaction & finish", exact: true }).click();
    await expect(page.getByText("Encounter completed. Your conversation, initial assessment, and reaction are saved separately.", { exact: true })).toBeVisible();
    expect(current().trace.phase).toBe("completed");
    expect(current().trace.events.slice(0, beforeReaction.events.length)).toEqual(beforeReaction.events);
    expect(initialAssessment(current().trace)).toBe(assessment);
    expect(current().trace.events.at(-1)!.payload.reaction).toEqual(reaction);
    expect(current().invariantErrors).toEqual([]);
    expect(operations.filter(operation => operation === "message")).toHaveLength(journey.turns.length);
    expect(operations).toEqual(["start", ...journey.turns.flatMap((_, index) => index === Math.floor(journey.turns.length / 2) ? ["message", "decision"] : ["message"]), "conclude", "react"]);
    expect(pageErrors).toEqual([]);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
