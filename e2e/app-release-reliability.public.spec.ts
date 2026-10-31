import { test, expect, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import type { SavedCapture } from "../src/components/app-shell/SavedForLater";

// Actual components in an isolated browser, with literal synthetic API fixtures.
// PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1 --project=public.
// No application server, auth session, database, real model, or external request.
const root = path.resolve(__dirname, "..");
const origin = "https://release-reliability-qa.test";
const savedPath = "/api/bty/action-capture/mine";
const trackingPath = "/api/bty/announcements/host";
let html: string;
let bundle: string;

const capture = (choice: SavedCapture["triageChoice"]): SavedCapture => ({
  id: "capture-1", sourceType: "teams_message", previewText: "Synthetic saved message", sourceUrl: null,
  sourceMetadata: {}, status: "captured", capturedAt: "2026-10-01T00:00:00Z", triageChoice: choice,
  triagedAt: choice === null ? null : "2026-10-01T00:01:00Z",
});
const announcement = () => ({
  id: "announcement-1", hostFraming: "Synthetic QA announcement", previewText: null, sourceUrl: null,
  createdAt: "2026-10-01T00:00:00Z", status: "active",
  funnel: { announcedTo: 1, gotIt: 1, question: 0, needHelp: 0, noResponse: 0, notYetActivated: 0 },
  responders: { acknowledged: [{ recipientId: "recipient-1", display: "Synthetic colleague", questionText: null,
    respondedAt: "2026-10-01T00:00:00Z", handledAt: null, unreadCount: 0, messageCount: 0, needsAttention: false }],
    question: [], needHelp: [], noResponse: [] },
});

test.beforeAll(async () => {
  const sources = ["SavedForLater", "TrackingSent", "TodaySwipeAction", "SwipeAction", "TrackConversation", "AnnouncementTrackingSummary"]
    .map(name => ({ raw: readFileSync(path.join(root, "src/components/app-shell", name + ".tsx"), "utf8"), extension: "tsx" }));
  const css = await postcss([tailwindcss({ content: sources })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0b1f3a;color:white}'
    + css.css + '</style><div id="app"></div>';
  const built = await build({
    stdin: { resolveDir: root, loader: "tsx", contents: [
      'import { createRoot } from "react-dom/client";',
      'import { StrictMode, useState } from "react";',
      'import SavedForLater from "@/components/app-shell/SavedForLater";',
      'import TrackingSent from "@/components/app-shell/TrackingSent";',
      'function Harness(){const [refresh,setRefresh]=useState(0);const saved=new URLSearchParams(location.search).get("view")==="saved";',
      'return <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-5">',
      '{saved?<SavedForLater locale="en"/>:<>',
      '<button data-testid="qa-refresh" onClick={()=>setRefresh(value=>value+1)}>Refresh tracking</button>',
      '<TrackingSent locale="en" refreshKey={refresh}/></>}</main>}',
      'createRoot(document.getElementById("app")).render(new URLSearchParams(location.search).get("view")==="saved"?<StrictMode><Harness/></StrictMode>:<Harness/>);',
    ].join("\n") },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
    // Only the browser auth dependency is substituted. All UI, domain rules,
    // request sequencing and mutation handlers come from production modules.
    plugins: [{ name: "isolated-null-supabase", setup(builder) {
      builder.onResolve({ filter: /(?:^@\/lib\/supabase$|\/src\/lib\/supabase(?:\.ts)?$)/ }, () => ({
        path: "null-auth", namespace: "synthetic-auth",
      }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic-auth" }, () => ({ contents: "export const supabase = null;", loader: "js" }));
    } }],
  });
  bundle = built.outputFiles![0]!.text;
});

type Reply = { body: unknown; status?: number };
async function setup(page: Page, options: { view: "saved" | "tracking"; choice?: SavedCapture["triageChoice"]; holdRead: number }) {
  const state = {
    reads: 0, mutations: [] as { path: string; body: unknown }[],
    failMutation: true, failRead: false, saved: [capture(options.choice ?? null)], tracks: [announcement()],
    unexpected: [] as string[], errors: [] as string[],
    releaseOld: null as null | ((reply: Reply) => Promise<void>),
  };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("**/*", route => {
    state.unexpected.push(route.request().url());
    return route.abort();
  });
  await page.route(origin + "/**", async route => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname === "/" && req.method() === "GET") return route.fulfill({ contentType: "text/html", body: html });
    if (req.method() === "GET" && pathname === (options.view === "saved" ? savedPath : trackingPath)) {
      state.reads++;
      if (state.reads === options.holdRead) {
        // Capture the old response before any mutation. The test releases it
        // only after the newer result is already visible in the actual UI.
        return new Promise<void>(resolve => {
          state.releaseOld = async ({ body, status = 200 }) => { await json(body, status); resolve(); };
        });
      }
      if (state.failRead) return json({ ok: false, error: "SYNTHETIC_READ_FAILURE" }, 500);
      return json({ ok: true, items: options.view === "saved" ? state.saved : state.tracks });
    }
    const allowed = ["/api/bty/action-capture/capture-1/triage", "/api/bty/action-capture/capture-1/remove", "/api/me/today/dismiss"];
    if (req.method() === "POST" && allowed.includes(pathname)) {
      const body = req.postData() ? req.postDataJSON() : null;
      state.mutations.push({ path: pathname, body });
      if (state.failMutation) return json({ ok: false, error: "SYNTHETIC_WRITE_FAILURE" }, 500);
      if (pathname.endsWith("/triage")) {
        state.saved = [{ ...capture(body.choice), triagedAt: "2026-10-31T12:00:00Z" }];
        return json({ ok: true, capture: state.saved[0] });
      }
      if (pathname.endsWith("/remove")) state.saved = [];
      else state.tracks = [];
      return json({ ok: true, changed: true });
    }
    state.unexpected.push(req.method() + " " + pathname);
    return route.abort();
  });
  await page.goto(origin + "/?view=" + options.view);
  await page.addScriptTag({ content: bundle });
  return state;
}

async function settleBrowser(page: Page) {
  // Let the fulfilled response's JSON promise and React render cross two paint
  // boundaries before checking that a stale reply has not changed the state.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function clickMutation(page: Page, button: Locator, pathname: string) {
  const responded = page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === "POST");
  // These are the real accessible alternatives to swipe-only removal. Focus
  // reveals the production control; no forced click or direct handler call.
  await button.focus();
  await page.keyboard.press("Enter");
  await (await responded).finished();
  await settleBrowser(page);
}
async function releaseOld(page: Page, state: Awaited<ReturnType<typeof setup>>, body: unknown, status = 200) {
  expect(state.releaseOld).not.toBeNull();
  const responded = page.waitForResponse(response => new URL(response.url()).pathname === (new URL(page.url()).searchParams.get("view") === "saved" ? savedPath : trackingPath));
  await state.releaseOld!({ body, status });
  await (await responded).finished();
  await settleBrowser(page);
}
async function finish(page: Page, state: Awaited<ReturnType<typeof setup>>) {
  expect(state.errors).toEqual([]);
  expect(state.unexpected).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [320, 390, 1280]) {
  test.describe(width + "px isolated release reliability", () => {
    test.use({ viewport: { width, height: 900 } });

    test("Saved triage rolls back, retries, and survives the earlier mount response", async ({ page }) => {
      const state = await setup(page, { view: "saved", choice: null, holdRead: 1 });
      await expect(page.getByTestId("saved-item")).toHaveAttribute("data-triage", "none");
      expect(state.reads).toBe(2);
      const endpoint = "/api/bty/action-capture/capture-1/triage";
      await clickMutation(page, page.getByTestId("saved-triage-later"), endpoint);
      await expect(page.getByTestId("saved-triage-error")).toHaveText("That didn't save.");
      await expect(page.getByTestId("saved-item")).toHaveAttribute("data-triage", "none");
      await expect(page.getByTestId("saved-triage-later")).toBeEnabled();
      expect(state.saved[0]!.triageChoice).toBeNull();
      state.failMutation = false;
      await clickMutation(page, page.getByTestId("saved-triage-later"), endpoint);
      await expect(page.getByTestId("saved-group-later").getByTestId("saved-item")).toHaveAttribute("data-triage", "later");
      await releaseOld(page, state, { ok: true, items: [capture(null)] });
      await expect(page.getByTestId("saved-item")).toHaveCount(1);
      await expect(page.getByTestId("saved-item")).toHaveAttribute("data-triage", "later");
      await expect(page.getByTestId("saved-group-new")).toHaveCount(0);
      await expect(page.getByTestId("saved-triage-controls")).toHaveCount(0);
      await expect(page.getByTestId("saved-triage-error")).toHaveCount(0);
      expect(state.mutations).toEqual([{ path: endpoint, body: { choice: "later" } }, { path: endpoint, body: { choice: "later" } }]);
      expect(state.saved[0]!.triageChoice).toBe("later");
      await finish(page, state);
    });

    test("Saved removal preserves a failed item, retries, and cannot be undone by an old read", async ({ page }) => {
      const state = await setup(page, { view: "saved", choice: "soon", holdRead: 1 });
      await expect(page.getByTestId("saved-item")).toHaveAttribute("data-triage", "soon");
      expect(state.reads).toBe(2);
      const endpoint = "/api/bty/action-capture/capture-1/remove";
      await clickMutation(page, page.getByTestId("saved-remove"), endpoint);
      await expect(page.getByTestId("saved-triage-error")).toHaveText("Couldn't remove that.");
      await expect(page.getByTestId("saved-item")).toHaveAttribute("data-triage", "soon");
      expect(state.saved).toHaveLength(1);
      state.failMutation = false;
      await clickMutation(page, page.getByTestId("saved-remove"), endpoint);
      await expect(page.getByTestId("saved-empty")).toHaveText("Nothing saved for later.");
      await releaseOld(page, state, { ok: true, items: [capture("soon")] });
      await expect(page.getByTestId("saved-item")).toHaveCount(0);
      await expect(page.getByTestId("saved-empty")).toBeVisible();
      await expect(page.getByTestId("saved-error")).toHaveCount(0);
      expect(state.saved).toEqual([]);
      expect(state.mutations).toEqual([{ path: endpoint, body: null }, { path: endpoint, body: null }]);
      await finish(page, state);
    });

    test("Tracking removal retries and rejects a late success, failure, or malformed read", async ({ page }) => {
      const state = await setup(page, { view: "tracking", holdRead: 2 });
      await expect(page.getByTestId("tracking-item")).toHaveAttribute("data-removable", "1");
      await page.getByTestId("qa-refresh").click();
      await expect.poll(() => state.reads).toBe(2);
      const endpoint = "/api/me/today/dismiss";
      await clickMutation(page, page.getByTestId("tracking-remove"), endpoint);
      await expect(page.getByRole("alert")).toHaveText("Couldn’t remove this from Today. Please try again.");
      await expect(page.getByTestId("tracking-item")).toContainText("Synthetic QA announcement");
      expect(state.tracks).toHaveLength(1);
      state.failMutation = false;
      await clickMutation(page, page.getByTestId("tracking-remove"), endpoint);
      await expect.poll(() => state.reads).toBe(3);
      await expect(page.getByTestId("tracking-item")).toHaveCount(0);
      // The three widths also exercise three distinct stale response classes.
      await releaseOld(page, state, width === 320 ? { ok: true, items: [announcement()] }
        : width === 390 ? { ok: false, error: "SYNTHETIC_OLD_FAILURE" } : { ok: true, items: "invalid" }, width === 390 ? 500 : 200);
      await expect(page.getByTestId("tracking-item")).toHaveCount(0);
      await expect(page.getByTestId("tracking-sent-error")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(state.tracks).toEqual([]);
      expect(state.mutations).toEqual([
        { path: endpoint, body: { itemKind: "track_host", itemId: "announcement-1" } },
        { path: endpoint, body: { itemKind: "track_host", itemId: "announcement-1" } },
      ]);
      await finish(page, state);
    });

    test("Tracking keeps the newer read error until Retry succeeds despite an old successful response", async ({ page }) => {
      const state = await setup(page, { view: "tracking", holdRead: 2 });
      await expect(page.getByTestId("tracking-item")).toBeVisible();
      await page.getByTestId("qa-refresh").click();
      await expect.poll(() => state.reads).toBe(2);
      state.failRead = true;
      await page.getByTestId("qa-refresh").click();
      await expect(page.getByTestId("tracking-sent-error")).toContainText("Couldn't load what you're tracking.");
      await releaseOld(page, state, { ok: true, items: [announcement()] });
      await expect(page.getByTestId("tracking-sent-error")).toBeVisible();
      await expect(page.getByTestId("tracking-item")).toHaveCount(0);
      state.failRead = false;
      state.tracks = [{ ...announcement(), hostFraming: "New confirmed tracking response" }];
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByTestId("tracking-framing")).toHaveText("New confirmed tracking response");
      await expect(page.getByTestId("tracking-sent-error")).toHaveCount(0);
      expect(state.reads).toBe(4);
      expect(state.mutations).toEqual([]);
      await finish(page, state);
    });
  });
}
