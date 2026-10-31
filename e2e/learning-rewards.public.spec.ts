import { test, expect, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import path from "node:path";
import { projectLearningRewards } from "../src/domain/learning-rewards/summary";
import type { LearningRewardCompletion, LearningRewardLedgerEntry } from "../src/domain/learning-rewards/types";

// Real React component + CSS + domain projection; fictional in-memory records only.
// Every browser request is intercepted. No server, auth/session setup, model, or DB.
// PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1 \
//   npx playwright test e2e/learning-rewards.public.spec.ts --project=public
const root = path.resolve(__dirname, "..");
const origin = "https://learning-rewards-qa.test";
const endpoint = "/api/me/learning-rewards";
const NOW = new Date("2026-10-30T20:00:00.000Z");
const TIMEZONE = "America/Los_Angeles";
let html: string;
let bundle: string;

test.beforeAll(() => {
  const output = buildSync({
    stdin: { resolveDir: root, loader: "tsx", contents: `
      import { createRoot } from "react-dom/client";
      import LearningRewards from "@/components/app-shell/LearningRewards";
      createRoot(document.getElementById("rewards-root")).render(<LearningRewards locale="en" />);
    ` },
    bundle: true, write: false, outfile: "learning-rewards.js", format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
    loader: { ".module.css": "local-css" },
  }).outputFiles;
  bundle = output.find(file => file.path.endsWith(".js"))!.text;
  const css = output.find(file => file.path.endsWith(".css"))!.text;
  // Standards mode matters for CSS module class names. Host-level black tag styles
  // deliberately reproduce the earlier navy/black text integration problem.
  html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;background:#fff;font-family:Arial,sans-serif}*{box-sizing:border-box}
    p,h1,h2,h3,h4,span,strong,small,button{color:#161616}
    #rewards-root{max-width:420px;margin:20px auto}${css}
  </style></head><body><div id="rewards-root"></div></body></html>`;
});

function completion(id: string, at: string, practice = false): LearningRewardCompletion {
  return {
    id, policy_version: "learning-rewards/v1", source_type: practice ? "clinical_practice" : "foundry_learn",
    source_id: `source-${id}`, assignment_key: `assignment-${id}`, content_key: practice ? "drchi-001" : `module-${id}`,
    content_version: "fictional-qa-v1", action: practice ? "practice" : "learn", completed_at: at, timezone: TIMEZONE,
    metadata: practice ? { clinicalCaseId: "drchi-001" } : {}, bty_day: at.slice(0, 10), xp: practice ? 20 : 10, disposition: "awarded",
  };
}
function ledgerEntry(row: LearningRewardCompletion): LearningRewardLedgerEntry {
  return { id: `ledger-${row.id}`, completion_id: row.id, xp: row.xp, occurred_at: row.completed_at, bty_day: row.bty_day, timezone: row.timezone };
}
function initialCompletions() {
  // 206 separate earlier Learn days + three Learn completions this week = 2,090.
  // Actual badge names, frames, conditions, availability and milestones are projected
  // by production domain code rather than duplicated in a fixture catalogue.
  const lastEarlier = Date.parse("2026-10-23T19:00:00.000Z");
  return [
    ...Array.from({ length: 206 }, (_, i) => completion(`earlier-${i}`, new Date(lastEarlier - (205 - i) * 86_400_000).toISOString())),
    ...[26, 27, 28].map(day => completion(`week-${day}`, `2026-10-${day}T19:00:00.000Z`)),
  ];
}

async function setup(page: Page) {
  const completions = initialCompletions();
  const state = {
    completions, ledger: completions.map(ledgerEntry), featuredBadgeId: null as string | null, seenAchievementIds: [] as string[],
    completePracticeOnSync: false, operations: [] as { method: string; body: Record<string, unknown> | null }[],
    errors: [] as string[], blockedRequests: [] as string[],
  };
  const project = () => projectLearningRewards({ completions: state.completions, ledger: state.ledger, now: NOW, timezone: TIMEZONE, featuredBadgeId: state.featuredBadgeId, seenAchievementIds: state.seenAchievementIds });
  state.seenAchievementIds = project().recentAchievements.map(achievement => achievement.id);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("**/*", route => { state.blockedRequests.push(route.request().url()); return route.abort(); });
  await page.route(origin + "/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
    if (pathname !== endpoint) { state.blockedRequests.push(request.url()); return route.abort(); }
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
    state.operations.push({ method, body });
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify(value) });
    if (method === "GET") return json({ ok: true, enabled: true, summary: project() });
    if (method !== "POST") return json({ ok: false }, 405);
    if (body?.operation === "feature") {
      const earned = project().badges.find(badge => badge.id === body.badgeId && badge.earnedAt);
      if (!earned) return json({ ok: false }, 403);
      state.featuredBadgeId = earned.id;
      return json({ ok: true, enabled: true, summary: project() });
    }
    if (body?.operation === "acknowledge") {
      const ids = Array.isArray(body.achievementIds) ? body.achievementIds.filter((id): id is string => typeof id === "string") : [];
      const allowed = new Set(project().recentAchievements.map(achievement => achievement.id));
      if (ids.some(id => !allowed.has(id))) return json({ ok: false }, 400);
      state.seenAchievementIds = [...new Set([...state.seenAchievementIds, ...ids])];
      return json({ ok: true, enabled: true, summary: project() });
    }
    if (body?.operation !== "sync") return json({ ok: false }, 400);
    let xpAwarded = 0;
    const before = new Set(project().recentAchievements.map(achievement => achievement.id));
    if (state.completePracticeOnSync) {
      state.completePracticeOnSync = false;
      const row = completion("practice-1", "2026-10-30T19:00:00.000Z", true);
      state.completions.push(row); state.ledger.push(ledgerEntry(row)); xpAwarded = row.xp;
    }
    const summary = project();
    return json({ ok: true, enabled: true, summary, xpAwarded, awards: [], newAchievements: summary.recentAchievements.filter(achievement => !before.has(achievement.id)) });
  });
  const mount = async (fresh = false) => {
    if (fresh) await page.reload(); else await page.goto(origin + "/");
    await page.addScriptTag({ content: bundle });
    await expect(page.getByTestId("learning-total-xp")).toBeVisible();
    await expect(page.getByText("Checking your recent learning…", { exact: true })).toHaveCount(0);
  };
  await mount();
  return { state, project, mount };
}

async function verifyGeometryAndContrast(page: Page) {
  const result = await page.getByTestId("learning-rewards").evaluate(rootElement => {
    type Color = { r: number; g: number; b: number; a: number };
    const color = (value: string): Color => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const composite = (front: Color, back: Color): Color => ({ r: front.r * front.a + back.r * (1 - front.a), g: front.g * front.a + back.g * (1 - front.a), b: front.b * front.a + back.b * (1 - front.a), a: 1 });
    const luminance = (c: Color) => [c.r, c.g, c.b].map(channel => { const n = channel / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const lowContrast: { text: string; ratio: number }[] = [];
    for (const element of Array.from(rootElement.querySelectorAll<HTMLElement>("*"))) {
      if (!element.getClientRects().length || !Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden") continue;
      const ancestors: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      let background = { r: 255, g: 255, b: 255, a: 1 };
      for (const ancestor of ancestors) background = composite(color(getComputedStyle(ancestor).backgroundColor), background);
      const foreground = composite(color(style.color), background);
      const l1 = luminance(foreground), l2 = luminance(background);
      const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) lowContrast.push({ text: element.textContent?.slice(0, 60) ?? "", ratio });
    }
    return { overflow: document.documentElement.scrollWidth > innerWidth, lowContrast };
  });
  expect(result.overflow).toBe(false);
  expect(result.lowContrast).toEqual([]);
}

for (const width of [320, 390, 1280]) for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Learning rewards: ${width}px, motion ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion });
    const { state, project, mount } = await setup(page);
    await expect(page.getByTestId("learning-total-xp")).toHaveText("2,090");
    await expect(page.getByTestId("learning-weekly-xp")).toHaveText("30 / 60 XP");
    await expect(page.getByTestId("learning-level")).toHaveText("9");
    await page.getByRole("button", { name: /Explore all badges/ }).click();
    await expect(page.getByTestId("learning-badge-grid").getByRole("button")).toHaveCount(12);
    await verifyGeometryAndContrast(page);
    await page.screenshot({ path: test.info().outputPath("collection.png"), fullPage: true });

    for (const badge of project().badges) {
      const status = badge.earnedAt ? "Earned" : badge.available ? "In progress" : "Not available yet";
      const button = page.getByRole("button", { name: `${badge.name} · ${status}`, exact: true });
      await button.click();
      const detail = page.getByTestId("learning-badge-detail");
      await expect(detail.getByRole("heading", { name: badge.name, exact: true })).toBeFocused();
      await expect(detail.getByText(badge.description, { exact: true })).toBeVisible();
      await expect(detail.getByRole("button", { name: "Feature on my profile", exact: true })).toHaveCount(badge.earnedAt ? 1 : 0);
      await verifyGeometryAndContrast(page);
      await page.getByRole("button", { name: "← Back to your collection", exact: true }).click();
      await expect(button).toBeFocused();
    }

    await page.getByRole("button", { name: "First Step · Earned", exact: true }).click();
    await page.getByRole("button", { name: "Feature on my profile", exact: true }).click();
    await expect(page.getByText("Featured on your profile", { exact: true })).toBeVisible();
    expect(state.operations.filter(operation => operation.body?.operation === "feature").map(operation => operation.body)).toEqual([{ operation: "feature", badgeId: "first" }]);
    expect(project().totalXp).toBe(2090);

    state.completePracticeOnSync = true;
    await mount(true);
    const celebration = page.getByTestId("learning-celebration");
    await expect(celebration).toBeVisible();
    await expect(page.getByTestId("learning-total-xp")).toHaveText("2,110");
    await expect(page.getByTestId("learning-level")).toHaveText("10");
    await expect(celebration.getByText("Level 10", { exact: true })).toHaveCount(1);
    await expect(celebration).toContainText("+20 Learning XP");
    const writesBeforeReplay = state.operations.filter(operation => operation.method === "POST").length;
    await page.getByRole("button", { name: "Replay animation", exact: true }).click();
    expect(state.operations.filter(operation => operation.method === "POST")).toHaveLength(writesBeforeReplay);
    if (reducedMotion === "reduce") await expect(celebration).toHaveCSS("animation-name", "none");
    else await expect(celebration).not.toHaveCSS("animation-name", "none");
    await verifyGeometryAndContrast(page);
    await page.screenshot({ path: test.info().outputPath("level-milestone.png"), fullPage: true });

    await page.getByRole("button", { name: "Continue learning", exact: true }).click();
    await expect(celebration).toHaveCount(0);
    expect(state.operations.filter(operation => operation.body?.operation === "acknowledge").map(operation => operation.body)).toEqual([{ operation: "acknowledge", achievementIds: ["badge:level10", "level:10"] }]);
    await mount(true);
    await expect(page.getByTestId("learning-celebration")).toHaveCount(0);
    await expect(page.getByTestId("learning-total-xp")).toHaveText("2,110");
    await expect(page.getByText("Featured on your profile: First Step", { exact: true })).toBeVisible();
    expect(state.errors).toEqual([]);
    expect(state.blockedRequests).toEqual([]);
    expect(state.operations.every(operation => operation.method === "GET" || ["sync", "feature", "acknowledge"].includes(String(operation.body?.operation)))).toBe(true);
    await verifyGeometryAndContrast(page);
  });
}
