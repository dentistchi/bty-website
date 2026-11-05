import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Real components, compiled Tailwind and synthetic HTTP only. No server,
// credentials, database, Teams notification or learner record is used.
const root = path.resolve(__dirname, "..");
const origin = "https://employee-track-ux.test";
let html: string;
let bundle: string;

test.beforeAll(async () => {
  const sources = ["TrackingSent", "AnnouncementTrackingSummary", "TodaySwipeAction", "SwipeAction", "TrackConversation"]
    .map(name => ({ raw: readFileSync(path.join(root, "src/components/app-shell", name + ".tsx"), "utf8"), extension: "tsx" }));
  const css = await postcss([tailwindcss({ content: sources })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0b1f3a;color:white}'
    + css.css + '</style><main class="mx-auto max-w-3xl p-4"><div id="app"></div></main>';
  const built = await build({
    stdin: { resolveDir: root, loader: "tsx", contents: [
      'import { createRoot } from "react-dom/client";',
      'import TrackingSent from "@/components/app-shell/TrackingSent";',
      'createRoot(document.getElementById("app")).render(<TrackingSent locale="en"/>);',
    ].join("\n") },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "synthetic-browser-auth", setup(builder) {
      builder.onResolve({ filter: /(?:^@\/lib\/supabase$|\/src\/lib\/supabase(?:\.ts)?$)/ }, () => ({ path: "auth", namespace: "synthetic" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({ contents: "export const supabase = null;", loader: "js" }));
    } }],
  });
  bundle = built.outputFiles![0]!.text;
});

for (const width of [320, 390, 1280]) {
  for (const mode of ["acknowledgment", "response"] as const) {
    test(`${width}px ${mode}: compact card and optional people details`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 850 });
      const unexpected: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => { unexpected.push(route.request().url()); return route.abort(); });
      await page.route(origin + "/**", route => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (request.method() === "GET" && pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
        if (request.method() === "GET" && pathname === "/api/bty/announcements/host") return route.fulfill({
          contentType: "application/json", body: JSON.stringify({ ok: true, items: [{
            id: "qa-announcement", hostFraming: "Please review this update.", previewText: null,
            sourceUrl: "https://teams.microsoft.com/l/message/synthetic", createdAt: "2026-11-05T20:00:00Z", status: "active",
            trackingMode: mode, tracking: { targeted: 1, opened: 0, acknowledged: 0, responded: 0, remaining: 1 },
            audience: [{ recipientId: "qa-recipient", display: "QA colleague", responseText: null,
              trackingMode: mode, openedAt: null, acknowledgedAt: null, responseSubmittedAt: null }],
            funnel: { announcedTo: 1, gotIt: 0, question: 0, needHelp: 0, noResponse: 1, notYetActivated: 0 },
            responders: { acknowledged: [], question: [], needHelp: [], noResponse: [] },
          }] }),
        });
        unexpected.push(request.method() + " " + pathname);
        return route.abort();
      });
      await page.goto(origin + "/");
      await page.addScriptTag({ content: bundle });
      await expect(page.getByTestId("tracking-progress")).toHaveText(mode === "response" ? "0 of 1 replied" : "0 of 1 confirmed");
      await expect(page.getByTestId("tracking-pending")).toHaveText(mode === "response" ? "1 awaiting reply" : "1 awaiting confirmation");
      await expect(page.getByTestId("tracking-funnel")).toHaveCount(0);
      await expect(page.getByText("QA colleague", { exact: true })).not.toBeVisible();
      expect(await page.getByTestId("tracking-item").evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(340);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 && mode === "acknowledgment") await page.screenshot({ path: testInfo.outputPath("compact-track.png"), fullPage: true });
      await page.getByText("View people", { exact: true }).click();
      await expect(page.getByText("QA colleague", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      expect(unexpected).toEqual([]);
    });
  }
}
