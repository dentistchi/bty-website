import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Retained protected Healing clients, real components with synthetic in-memory
// APIs. Authentication chrome/router are substituted; no user session is created.
const root = path.resolve(__dirname, "..");
const origin = "https://healing-feedback-qa.test";
const pageSource = "src/app/[locale]/bty/(protected)/healing/awakening/page.client.tsx";
const trackSource = "src/components/bty/healing/AwakeningActsTrack.tsx";
let html: string;
let bundle: string;
const ritual = {
  eligible: true, completed: false, userDay: 28, sessionCount: 12,
  ritual: {
    act1: { name: "Review", sessionCount: 12, repairLoopCount: 2, oFnRCount: 3, coreHighlight: [], patternNote: "Synthetic reflection." },
    act2: { name: "Identity", identityStatement: "Synthetic identity statement.", phaseIiIntro: "Synthetic next phase." },
    act3: { name: "Continue", unlockGranted: null, unlockLabel: "Continue your practice." },
  },
};
const acts = { ok: true, acts: { "1": "Reflect", "2": "Acknowledge", "3": "Continue" }, eligible: true, completedActs: [], trigger: { day: 28, requires_min_sessions: 12 } };

test.beforeAll(async () => {
  const css = await postcss([tailwindcss({ content: [pageSource, trackSource].map(p => ({ raw: readFileSync(path.join(root, p), "utf8"), extension: "tsx" })) })])
    .process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:white;color:#1e2a38}' + css.css + '</style><div id="app"></div>';
  bundle = (await build({
    stdin: { resolveDir: root, loader: "tsx", contents: [
      'import { createRoot } from "react-dom/client";',
      'import SecondAwakening from "@/app/[locale]/bty/(protected)/healing/awakening/page.client";',
      'import { AwakeningActsTrack } from "@/components/bty/healing/AwakeningActsTrack";',
      'createRoot(document.getElementById("app")).render(new URLSearchParams(location.search).get("view")==="second"?<SecondAwakening/>:<main style={{padding:16}}><AwakeningActsTrack locale="en"/></main>);',
    ].join("\n") },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "isolated-chrome", setup(builder) {
      builder.onResolve({ filter: /(?:^@\/components\/AuthGate$|\/src\/components\/AuthGate(?:\.tsx)?$)/ }, () => ({ path: "auth", namespace: "qa" }));
      builder.onResolve({ filter: /(?:^@\/components\/ThemeBody$|\/src\/components\/ThemeBody(?:\.tsx)?$)/ }, () => ({ path: "theme", namespace: "qa" }));
      builder.onResolve({ filter: /(?:^@\/components\/bty-arena$|\/src\/components\/bty-arena(?:\/index)?(?:\.tsx)?$)/ }, () => ({ path: "loading", namespace: "qa" }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "qa" }));
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, args => ({ resolveDir: root, loader: "tsx", contents:
        args.path === "auth" ? 'export const AuthGate=({children})=><>{children}</>;'
          : args.path === "theme" ? 'export const ThemeBody=()=>null;'
          : args.path === "loading" ? 'export const CardSkeleton=()=>null; export const LoadingFallback=()=> <p>Loading</p>;'
          : args.path === "router" ? 'export const usePathname=()=>"/en/bty/healing/awakening";export const useRouter=()=>({refresh:()=>{window.__refreshCount=(window.__refreshCount||0)+1}});'
          : 'export default function Link({href,children,...rest}){return <a href={href} {...rest}>{children}</a>}' }));
    } }],
  })).outputFiles![0]!.text;
});

for (const width of [320, 390, 1280]) test.describe(width + "px Healing response truth", () => {
  test.use({ viewport: { width, height: 900 } });
  for (const view of ["second", "acts"] as const) test(view + " distinguishes failed reads, failed writes, review and successful retry", async ({ page }) => {
    let readFails = true;
    let write: "http" | "review" | "valid" = "http";
    const posts: unknown[] = [];
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => { unexpected.push(route.request().url()); return route.abort(); });
    await page.route(origin + "/**", route => {
      const req = route.request(); const url = new URL(req.url());
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (req.method() === "GET" && url.pathname === "/api/emotional-stats/second-awakening") return json(readFails ? { error: "INTERNAL_READ_MARKER", eligible: false, completed: false } : ritual, readFails ? 503 : 200);
      if (req.method() === "GET" && url.pathname === "/api/bty/awakening") return json(view === "acts" && readFails ? { error: "INTERNAL_READ_MARKER" } : acts, view === "acts" && readFails ? 503 : 200);
      const target = view === "second" ? "/api/emotional-stats/second-awakening/complete" : "/api/bty/healing/progress";
      if (url.pathname === target && req.method() === "POST") {
        posts.push(req.postData() ? req.postDataJSON() : null);
        if (write === "http") return json(view === "second" ? { ok: true, idempotent: false } : { ok: true, completedActs: [1] }, 500);
        if (write === "review") return json(view === "second" ? { ok: false, code: "HEALING_COMPLETION_REVIEW_REQUIRED" } : { error: "HEALING_COMPLETION_REVIEW_REQUIRED" }, 409);
        return json(view === "second" ? { ok: true, idempotent: false } : { ok: true, completedActs: [1] });
      }
      unexpected.push(req.method() + " " + url.pathname); return route.abort();
    });
    await page.goto(origin + "/?view=" + view); await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("INTERNAL_READ_MARKER")).toHaveCount(0);
    readFails = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
    const action = () => view === "second" ? page.getByRole("button", { name: /Enter next phase|Retry/i }) : page.getByRole("button", { name: /record next act/i });
    await action().click();
    await expect(page.getByText(view === "second" ? /Could not confirm your completion/ : /Could not confirm your progress/)).toBeVisible();
    await expect(page.getByText("Phase II", { exact: true })).toHaveCount(0);
    if (view === "acts") await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    write = "review"; await action().click();
    await expect(page.getByText(/This completion needs review/).first()).toBeVisible();
    await expect(page.getByText("Phase II", { exact: true })).toHaveCount(0);
    if (view === "acts") await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    write = "valid"; await action().click();
    if (view === "second") await expect(page.getByText("Phase II", { exact: true })).toBeVisible();
    else await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    expect(posts).toEqual(view === "second" ? [null, null, null] : [{ actId: 1 }, { actId: 1 }, { actId: 1 }]);
    expect(errors).toEqual([]); expect(unexpected).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
