import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Actual native Practice room and player; all network is intercepted in memory.
// No app server, login, DB, reward, canonical Arena run or learner trace is used.
const root = path.resolve(__dirname, "..");
const origin = "https://practice-completion-qa.test";
const practiceId = "practice-1";
const runId = "00000000-0000-4000-8000-000000000001";
const scenario = {
  title: "Synthetic handover decision", opening: "A handover is interrupted by a new task.",
  primary: { choices: [{ id: "p1", label: "Confirm the details" }, { id: "p2", label: "Keep moving" }] },
  tradeoff: { escalationText: "Another urgent task arrives.", choices: [{ id: "t1", label: "Ask the lead" }, { id: "t2", label: "Proceed alone" }] },
  actionDecision: { prompt: "What will you do now?", choices: [
    { id: "a1", label: "Record the next check", isActionCommitment: true },
    { id: "a2", label: "Wait until later", isActionCommitment: false },
  ] },
};
let html: string;
let bundle: string;
test.beforeAll(async () => {
  const sources = ["src/components/app-shell/ArenaRoom.tsx", "src/components/bty-arena/practice/ArenaPracticePlayer.tsx", "src/components/bty-arena/EliteArenaStep2Context.tsx"]
    .map(name => ({ raw: readFileSync(path.join(root, name), "utf8"), extension: "tsx" }));
  const css = await postcss([tailwindcss({ content: sources })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--bty-brand-navy:#0b1f3a;--bty-surface-soft:#f1eee6}body{margin:0;background:#0b1f3a;color:white}' + css.css + '</style><div id="app"></div>';
  bundle = (await build({
    stdin: { resolveDir: root, loader: "tsx", contents: [
      'import { createRoot } from "react-dom/client";',
      'import { ArenaRoom } from "@/components/app-shell/ArenaRoom";',
      'createRoot(document.getElementById("app")).render(<main style={{padding:16}}><ArenaRoom locale="en" lockedTag="Practice" lockedBody="No practice yet"/></main>);',
    ].join("\n") },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
  })).outputFiles![0]!.text;
});

for (const width of [320, 390, 1280]) {
  test.describe(width + "px native Practice completion truth", () => {
    test.use({ viewport: { width, height: 900 } });
    test("rejects a malformed HTTP200, preserves the player, retries, then returns only after canonical completion", async ({ page }) => {
      let accepted = false;
      const completions: unknown[] = [];
      const unexpected: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => { unexpected.push(route.request().url()); return route.abort(); });
      await page.route(origin + "/**", async route => {
        const req = route.request();
        const pathname = new URL(req.url()).pathname;
        const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
        if (pathname === "/" && req.method() === "GET") return route.fulfill({ contentType: "text/html", body: html });
        if (pathname === "/api/arena/practice") return json({ practices: [{ id: practiceId, practice_title: "Synthetic handover", source_training_title: "Synthetic training", completed: accepted }] });
        if (pathname === `/api/arena/practice/${practiceId}`) return json({ practice: { id: practiceId, practice_title: "Synthetic handover", source_training_title: "Synthetic training", source_module_version: 1, scenario } });
        if (pathname === `/api/arena/practice/${practiceId}/start` && req.method() === "POST") return json({ run_id: runId });
        if (pathname === `/api/arena/practice/${practiceId}/complete` && req.method() === "POST") {
          completions.push(req.postDataJSON());
          if (accepted) return json({ completed: true });
          if (width === 390) return route.fulfill({ contentType: "text/html", body: "<html>Sign in</html>" });
          return json(width === 320 ? { ok: true } : { completed: false });
        }
        unexpected.push(req.method() + " " + pathname); return route.abort();
      });
      await page.goto(origin);
      await page.addScriptTag({ content: bundle });
      await page.getByRole("button", { name: "Start practice", exact: true }).click();
      await page.getByRole("button", { name: "Begin", exact: true }).click();
      await page.getByRole("button", { name: "Confirm the details", exact: true }).click();
      await page.getByRole("button", { name: "Ask the lead", exact: true }).click();
      await page.getByRole("button", { name: "Record the next check", exact: true }).click();
      await expect(page.getByText("We couldn't save your completion.", { exact: true })).toBeVisible();
      await expect(page.getByText("Practice complete", { exact: true })).toBeVisible();
      expect(completions).toEqual([{ runId }]);
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await expect.poll(() => completions.length).toBe(2);
      await expect(page.getByText("We couldn't save your completion.", { exact: true })).toBeVisible();
      await expect(page.getByText("Practice complete", { exact: true })).toBeVisible();
      accepted = true;
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect.poll(() => completions.length).toBe(3);
      await expect(page.getByText("We couldn't save your completion.", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await expect(page.getByRole("button", { name: "Practice again", exact: true })).toBeVisible();
      expect(completions).toEqual([{ runId }, { runId }, { runId }]);
      expect(errors).toEqual([]); expect(unexpected).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}
