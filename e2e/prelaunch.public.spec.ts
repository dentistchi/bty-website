import { test, expect, type Page, type Locator } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Isolated UI contracts: actual TodayHome/SavedForLater/TrackingSent modules;
// synthetic in-memory API responses only. No server, auth, database or learner record.
// PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1 --project=public.
const root = path.resolve(__dirname, "..");
const origin = "https://prelaunch-qa.test";
let html: string, bundle: string;
type Item = Record<string, any>;
const overdue = () => ({ stableId: "FOLLOW_UP_OVERDUE:event-qa:person-qa", category: "FOLLOW_UP_OVERDUE",
  eventId: "event-qa", focusId: "person-qa", participantDisplayName: "Synthetic colleague",
  trainingTitle: "Synthetic closed training", reason: "7-day follow-up has not been answered",
  canRemoveTraining: true, deepLink: "/en/app?tab=learn&eventId=event-qa&section=followup&focusId=person-qa" });
const savedItem = () => ({ id: "capture-qa", sourceType: "teams_message", previewText: "Synthetic saved message",
  sourceUrl: null, sourceMetadata: { tenant_id: "tenant-qa", conversation_id: "conversation-qa" },
  status: "captured", capturedAt: "2026-10-01T00:00:00Z", triageChoice: "soon", triagedAt: "2026-10-02T00:00:00Z" });
const track = (kind: "settled" | "question") => {
  const person = { recipientId: "recipient-qa", display: "Synthetic colleague", questionText: kind === "question" ? "Can you clarify?" : null,
    respondedAt: "2026-10-01T00:00:00Z", handledAt: null, unreadCount: 0, messageCount: 0, needsAttention: kind === "question" };
  return { id: "track-qa", hostFraming: "Synthetic tracking notice", previewText: null, sourceUrl: null,
    createdAt: "2026-10-01T00:00:00Z", status: "active",
    funnel: { announcedTo: 1, gotIt: kind === "settled" ? 1 : 0, question: kind === "question" ? 1 : 0, needHelp: 0, noResponse: 0, notYetActivated: 0 },
    responders: { acknowledged: kind === "settled" ? [person] : [], question: kind === "question" ? [person] : [], needHelp: [], noResponse: [] } };
};
test.beforeAll(async () => {
  const sourceFiles = ["TodayHome", "SavedForLater", "TrackingSent", "TrackConversation", "TodaySwipeAction", "SwipeAction", "NeedsYourResponse", "AnnouncementTrackingSummary"]
    .map(name => ({ raw: readFileSync(path.join(root, "src/components/app-shell", name + ".tsx"), "utf8"), extension: "tsx" }));
  const css = await postcss([tailwindcss({ content: sourceFiles })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0b1f3a;color:white}' + css.css + '</style><div id="app"></div>';
  bundle = buildSync({ stdin: { resolveDir: root, loader: "tsx", contents: [
    'import { createRoot } from "react-dom/client";', 'import { useState } from "react";',
    'import TodayHome from "@/components/app-shell/TodayHome";',
    'import SavedForLater from "@/components/app-shell/SavedForLater";',
    'import TrackingSent from "@/components/app-shell/TrackingSent";',
    'function Harness(){ const [view,setView]=useState(new URLSearchParams(location.search).get("view")||"today"); const [refresh,setRefresh]=useState(0);',
    'const go=(next)=>{setView(next);setRefresh(v=>v+1)};',
    'return <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-5"><nav aria-label="QA navigation" className="flex gap-3">',
    '<button data-testid="qa-today" onClick={()=>go("today")}>Today</button><button data-testid="qa-saved" onClick={()=>go("saved")}>Saved</button><button data-testid="qa-tracking" onClick={()=>go("tracking")}>Tracking</button></nav>',
    '{view==="today"?<TodayHome locale="en" refreshKey={refresh} onOpenSaved={()=>go("saved")} onNavigate={()=>{}}/>:view==="saved"?<SavedForLater locale="en" onBack={()=>go("today")}/>:<TrackingSent locale="en" refreshKey={refresh}/>}</main>}',
    'createRoot(document.getElementById("app")).render(<Harness/>);',
  ].join("\n") }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", alias: { "@": path.join(root, "src") },
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_SUPABASE_URL": '""', "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""' } }).outputFiles[0].text;
});

async function setup(page: Page, view = "today") {
  const state = { attention: [overdue()] as Item[], saved: [savedItem()] as Item[], tracks: [] as Item[],
    failTraining: false, failTrack: false, failSaved: false,
    operations: [] as { path: string; method: string; body: unknown }[], briefReads: 0, errors: [] as string[] };
  page.on("pageerror", error => state.errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/*", route => route.abort());
  await page.route(origin + "/**", async route => {
    const request = route.request(); const url = new URL(request.url()); const p = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/") return route.fulfill({ contentType: "text/html", body: html });
    state.operations.push({ path: p, method: request.method(), body: request.postData() ? request.postDataJSON() : null });
    if (request.method() === "GET") {
      if (p === "/api/me/today/brief") { state.briefReads++; return json({ ok: true, reminders: [], hostAttention: state.attention }); }
      if (p === "/api/bty/action-capture/mine") return json({ ok: true, items: state.saved });
      if (p === "/api/bty/announcements/host") return json({ ok: true, items: state.tracks });
      if (p === "/api/bty/announcements/mine") return json({ ok: true, items: [] });
      if (p === "/api/me/today/yesterday-activity") return json({ counts: null });
      if (p === "/api/arena/action-review-queue") return json({ items: [] });
      if (p === "/api/me/daily-trace") return json({ dailyTrace: [] });
      if (p === "/api/arena/practice") return json({ practices: [] });
      if (p === "/api/bty/foundry/learning-path") return json({ ok: true, programs: [] });
      return json({ ok: false, error: "UNEXPECTED_QA_READ" }, 404);
    }
    if (request.method() !== "POST") return json({ ok: false }, 405);
    if (p === "/api/bty/foundry/event-history/event-qa/dismiss") {
      if (state.failTraining) return json({ ok: false, error: "NOT_REMOVABLE" }, 409);
      state.attention = []; return json({ ok: true, changed: true });
    }
    if (p === "/api/me/today/dismiss") {
      if (state.failTrack) return json({ ok: false, error: "SERVER_ERROR" }, 500);
      state.tracks = []; return json({ ok: true, dismissedAt: "2026-10-30T12:00:00Z" });
    }
    if (p === "/api/bty/announcements/recipients/recipient-qa/handle") {
      if (state.failTrack) return json({ ok: false, error: "SERVER_ERROR" }, 500);
      return json({ ok: true });
    }
    if (p === "/api/bty/action-capture/capture-qa/remove") {
      if (state.failSaved) return json({ ok: false, error: "SERVER_ERROR" }, 500);
      state.saved = []; return json({ ok: true, changed: true });
    }
    return json({ ok: false, error: "UNEXPECTED_QA_MUTATION" }, 400);
  });
  const mount = async (fresh = false) => {
    if (fresh) await page.reload(); else await page.goto(origin + "/?view=" + view);
    await page.addScriptTag({ content: bundle });
  };
  await mount();
  return { state, mount };
}
async function swipeLeft(surface: Locator) {
  const touch = async (type: string, x: number) => surface.evaluate((node, value) => {
    const event = new Event(value.type, { bubbles: true });
    Object.defineProperty(event, "touches", { value: value.type === "touchend" ? [] : [{ clientX: value.x, clientY: 100 }] });
    node.dispatchEvent(event);
  }, { type, x });
  await touch("touchstart", 240); await touch("touchmove", 120);
  await expect(surface).toHaveCSS("transform", /matrix\(1, 0, 0, 1, -120, 0\)/);
  await touch("touchend", 120);
}
async function finish(page: Page, errors: string[]) {
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("verified.png"), fullPage: true });
}

for (const width of [390, 1280]) {
  test.describe(width + "px prelaunch core flows", () => {
    test.use({ viewport: { width, height: 900 } });
    test("closed overdue training removal survives a fresh mount", async ({ page }) => {
      const { state, mount } = await setup(page);
      await expect(page.getByTestId("today-followup-row")).toContainText("Synthetic closed training");
      await page.getByTestId("today-followup-remove").click();
      await expect(page.getByTestId("today-followup-row")).toHaveCount(0);
      expect(state.attention).toEqual([]);
      expect(state.operations.filter(op => op.method === "POST").map(op => op.path)).toEqual(["/api/bty/foundry/event-history/event-qa/dismiss"]);
      await mount(true);
      await expect(page.getByText("Find a program", { exact: true })).toBeVisible();
      await expect(page.getByTestId("today-followup-row")).toHaveCount(0);
      await finish(page, state.errors);
    });
    test("failed overdue removal explains the failure and preserves the card", async ({ page }) => {
      const { state } = await setup(page); state.failTraining = true;
      await page.getByTestId("today-followup-remove").click();
      await expect(page.getByRole("alert")).toContainText("Couldn’t remove this training");
      await expect(page.getByTestId("today-followup-row")).toContainText("Synthetic closed training");
      expect(state.attention).toHaveLength(1);
      await expect(page.getByTestId("today-followup-remove")).toBeEnabled();
      await finish(page, state.errors);
    });
    test("reselecting Today refreshes a changed follow-up brief", async ({ page }) => {
      const { state } = await setup(page);
      await expect(page.getByTestId("today-followup-row")).toHaveCount(1);
      const previous = state.briefReads; state.attention = [];
      await page.getByTestId("qa-today").click();
      await expect(page.getByTestId("today-followup-row")).toHaveCount(0);
      expect(state.briefReads).toBeGreaterThan(previous);
      expect(state.operations.filter(op => op.method !== "GET")).toEqual([]);
      await finish(page, state.errors);
    });
    test("Track handle and removal failures remain visible with the Track intact", async ({ page }) => {
      const { state } = await setup(page, "tracking"); state.tracks = [track("question")]; state.failTrack = true;
      await page.getByTestId("qa-tracking").click();
      await page.getByTestId("tracking-toggle").click();
      await page.getByTestId("tracking-handle").click();
      await expect(page.getByRole("alert")).toContainText("Couldn’t save that change");
      await expect(page.getByTestId("tracking-person")).toHaveAttribute("data-handled", "0");
      state.tracks = [track("settled")];
      await page.getByTestId("qa-tracking").click();
      await expect(page.getByTestId("tracking-item")).toHaveAttribute("data-removable", "1");
      await swipeLeft(page.getByTestId("today-swipe-surface"));
      await page.getByTestId("today-swipe-action").click();
      await expect(page.getByRole("alert")).toContainText("Couldn’t remove this from Today");
      await expect(page.getByTestId("tracking-item")).toBeVisible();
      expect(state.tracks).toHaveLength(1);
      await finish(page, state.errors);
    });
    test("Saved removal rolls back on failure and persists after successful retry", async ({ page }) => {
      const { state, mount } = await setup(page, "saved"); state.failSaved = true;
      await expect(page.getByTestId("saved-item")).toContainText("Synthetic saved message");
      await swipeLeft(page.getByTestId("saved-swipe-surface"));
      await page.getByTestId("saved-swipe-action").click();
      await expect(page.getByTestId("saved-triage-error")).toContainText("Couldn't remove that.");
      await expect(page.getByTestId("saved-item")).toBeVisible();
      expect(state.saved).toHaveLength(1); state.failSaved = false;
      await swipeLeft(page.getByTestId("saved-swipe-surface"));
      await page.getByTestId("saved-swipe-action").click();
      await expect(page.getByTestId("saved-item")).toHaveCount(0);
      expect(state.saved).toEqual([]);
      await mount(true);
      await expect(page.getByText("Nothing saved for later.", { exact: true })).toBeVisible();
      await expect(page.getByTestId("saved-item")).toHaveCount(0);
      await finish(page, state.errors);
    });
  });
}
