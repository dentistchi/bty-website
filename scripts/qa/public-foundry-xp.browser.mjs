/**
 * Isolated public Foundry reward UI regression. No Next server or application
 * environment file is loaded. All API responses are fixed synthetic fixtures;
 * production/external requests are blocked. This is not a database/receipt test.
 *
 * node scripts/qa/public-foundry-xp.browser.mjs [--output-dir /absolute/new-dir]
 *   [--browser-executable /absolute/installed/chromium]
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(ROOT, "package.json"));
const { build } = require("esbuild");
const { chromium } = require("playwright");
const WIDTHS = [320, 390, 1280];
const KINDS = ["video", "document", "guidance", "discussion"];
const STATUSES = ["unavailable", "review_required"];
const API = "/api/bty/foundry/public/xp-browser";
const PENDING = "Your training is complete and saved. XP has not been confirmed.";
const REVIEW = "Your training is complete and saved. This XP claim needs review before it can be confirmed.";

function options(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert(["--output-dir", "--browser-executable"].includes(argv[i]), `Unknown option: ${argv[i]}`);
    assert(argv[i + 1] && !argv[i + 1].startsWith("--"), `Missing value: ${argv[i]}`);
    assert(path.isAbsolute(argv[i + 1]), `${argv[i]} must be an absolute path`);
    assert(!out[argv[i]], `Repeated option: ${argv[i]}`);
    out[argv[i]] = argv[i + 1];
  }
  return out;
}

function snapshot(kind, status) {
  const common = { event: { title: "A completed synthetic training", status: "open" }, participant: { display_name: "Learner" },
    stage: status === "awarded" ? "completed_awarded" : "completed_claimable", xp_status: status,
    reflection_required: false, follow_up_days: null, journey: null };
  if (kind === "video") return { ...common, training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: null, shared_question: null } };
  if (kind === "document") return { ...common, content_type: "document", document: null };
  return { ...common, content_type: kind === "discussion" ? "live_discussion" : "written_guidance", declared: true,
    guidance: { material_text: "Name the next step.", completion_prompt: null, shared_question: null } };
}
const awardedText = kind => kind === "guidance" || kind === "discussion" ? "10 Core XP added." : "+10 Core XP";
const roomPath = kind => kind === "video" ? API : `${API}/${kind === "document" ? "doc" : "guidance"}`;
const claimPath = kind => `${roomPath(kind)}/${kind === "video" ? "progress/" : ""}claim-xp`;

async function main() {
  const args = options(process.argv.slice(2));
  const output = args["--output-dir"] ?? await fs.mkdtemp(path.join(os.tmpdir(), "bty-public-xp-qa-"));
  await fs.mkdir(output, { recursive: true });
  assert.equal((await fs.readdir(output)).length, 0, "Refusing to overwrite a nonempty evidence directory");
  const harness = await fs.mkdtemp(path.join(os.tmpdir(), "bty-public-xp-harness-"));
  let server;
  let browser;
  const results = [];
  try {
    await fs.writeFile(path.join(harness, "entry.tsx"), `import React from 'react';import{createRoot}from'react-dom/client';
      import Video from ${JSON.stringify(path.join(ROOT, "src/app/f/[token]/FoundryJoinClient"))};
      import Document from ${JSON.stringify(path.join(ROOT, "src/app/f/[token]/FoundryDocumentClient"))};
      import Guidance from ${JSON.stringify(path.join(ROOT, "src/app/f/[token]/FoundryGuidanceClient"))};
      const kind=new URLSearchParams(location.search).get('kind');
      createRoot(document.getElementById('root')!).render(kind==='video'?<Video token="xp-browser" savedLocale="en"/>:kind==='document'?<Document token="xp-browser" savedLocale="en"/>:<Guidance token="xp-browser" savedLocale="en" contentType={kind==='discussion'?'live_discussion':'written_guidance'}/>);`);
    await fs.writeFile(path.join(harness, "index.html"), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    await build({ absWorkingDir: ROOT, entryPoints: [path.join(harness, "entry.tsx")], outfile: path.join(harness, "app.js"),
      bundle: true, nodePaths: [path.join(ROOT, "node_modules")], format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
      tsconfig: path.join(ROOT, "tsconfig.json"), logLevel: "error", plugins: [{ name: "terminal-pdf-only", setup(b) {
        // Canvas rendering is unrelated to this terminal-state gate. All three room clients are real.
        b.onResolve({ filter: /^\.\/PdfReader$/ }, () => ({ path: "PdfReader", namespace: "terminal-only" }));
        b.onLoad({ filter: /.*/, namespace: "terminal-only" }, () => ({ contents: "export const PdfReader=()=>null;", loader: "js" }));
      } }] });
    execFileSync(process.execPath, [require.resolve("tailwindcss/lib/cli.js"), "-c", path.join(ROOT, "tailwind.config.ts"),
      "-i", path.join(ROOT, "src/app/globals.css"), "-o", path.join(harness, "app.css"), "--content", "./src/app/f/**/*.tsx", "--minify"],
    { cwd: ROOT, stdio: "pipe", env: { PATH: path.dirname(process.execPath), NODE_ENV: "production", CI: "1" } });

    server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url, "http://local").pathname;
      const name = pathname === "/" ? "index.html" : pathname.slice(1);
      if (!["index.html", "app.js", "app.css"].includes(name)) { res.writeHead(404); res.end(); return; }
      try {
        const body = await fs.readFile(path.join(harness, name));
        res.writeHead(200, { "Content-Type": name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "application/javascript" : "text/html" });
        res.end(body);
      } catch { res.writeHead(500); res.end("Harness asset unavailable"); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(args["--browser-executable"] ? { executablePath: args["--browser-executable"] } : {}) });

    for (const width of WIDTHS) for (const kind of KINDS) for (const status of STATUSES) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const page = await context.newPage();
        let current = snapshot(kind, status);
        let claims = 0;
        const errors = [];
        const unexpected = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== base) { unexpected.push(`${request.method()} ${url.origin}${url.pathname}`); await route.abort(); return; }
          if (!url.pathname.startsWith("/api/")) { await route.continue(); return; }
          let data;
          if (request.method() === "GET" && url.pathname === "/api/auth/session") data = { ok: true, user: { email: "synthetic@example.test" } };
          else if (request.method() === "GET" && [roomPath(kind), `${roomPath(kind)}/snapshot`].includes(url.pathname)) data = current;
          else if (request.method() === "GET" && url.pathname === `${API}/quiz`) data = { ok: true, quiz: null, submitted: false };
          else if (request.method() === "POST" && url.pathname === `${API}/reflection`) data = { ok: true, reflection: null };
          else if (request.method() === "POST" && url.pathname === claimPath(kind)) {
            claims += 1; current = snapshot(kind, "awarded"); data = { ok: true, ...current };
          } else { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return; }
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
        });
        await page.goto(`${base}/?kind=${kind}`);
        const panel = page.getByTestId("completion-xp-recovery");
        await panel.waitFor({ state: "visible" });
        assert(await page.getByText(status === "unavailable" ? PENDING : REVIEW, { exact: true }).isVisible());
        assert.equal(claims, 0, "Pending/review must not initiate automatic claims");
        assert.equal(await page.getByText(awardedText(kind), { exact: true }).count(), 0, "Unconfirmed XP must not be shown as awarded");
        const metrics = await panel.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const rgba = value => {
            const channels = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
            return [channels[0], channels[1], channels[2], channels[3] ?? 1];
          };
          const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3]));
          const luminance = rgb => rgb.map(channel => {
            const x = channel / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
          const contrast = node => {
            const chain = []; for (let p = node; p; p = p.parentElement) chain.push(p);
            let background = [255, 255, 255];
            for (const p of chain.reverse()) background = over(rgba(getComputedStyle(p).backgroundColor), background);
            const foreground = over(rgba(getComputedStyle(node).color), background);
            const a = luminance(foreground), b = luminance(background);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          };
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            color: getComputedStyle(element.querySelector("p")).color, background: getComputedStyle(element).backgroundColor,
            textContrast: contrast(element.querySelector("p")),
            buttonContrast: element.querySelector("button") ? contrast(element.querySelector("button")) : null };
        });
        assert(metrics.left >= 0 && metrics.right <= width + 1 && metrics.top >= 0 && metrics.bottom <= 900);
        assert(metrics.overflow <= 1, "The recovery panel must not cause horizontal overflow");
        assert(metrics.textContrast >= 4.5, "The recovery message must remain legible");
        if (metrics.buttonContrast !== null) assert(metrics.buttonContrast >= 4.5, "The retry text must remain legible");
        if (width === 320 && kind === "guidance") await page.screenshot({ path: path.join(output, `${kind}-${status}-${width}.png`), fullPage: true });
        if (status === "unavailable") {
          const button = page.getByRole("button", { name: "Try XP again", exact: true });
          const box = await button.boundingBox();
          assert(box && box.height >= 44, "The explicit retry must remain a usable touch target");
          await button.click();
          await page.getByText(awardedText(kind), { exact: true }).waitFor({ state: "visible" });
          assert.equal(claims, 1, "One explicit retry must not initiate a duplicate silent claim");
          assert.equal(await panel.count(), 0);
        } else assert.equal(await page.getByRole("button", { name: "Try XP again", exact: true }).count(), 0);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, [], "No production, external or unexpected API request is allowed");
        results.push({ width, kind, status, claims, metrics, pass: true });
      } finally { await context.close(); }
    }
    const runtimeHashes = {};
    for (const name of ["CompletionXpRecovery.tsx", "FoundryJoinClient.tsx", "FoundryDocumentClient.tsx", "FoundryGuidanceClient.tsx", "snapshotMerge.ts"]) {
      runtimeHashes[`src/app/f/[token]/${name}`] = createHash("sha256").update(await fs.readFile(path.join(ROOT, "src/app/f/[token]", name))).digest("hex");
    }
    const report = { screens: results.length, pendingAwardTransitions: results.filter(result => result.status === "unavailable").length,
      scope: "Real room clients and Tailwind; fixed synthetic HTTP fixtures, PDF canvas stubbed; no database, auth session, model or production endpoint",
      runtimeHashes, checks: results };
    assert.equal(report.screens, 24); assert.equal(report.pendingAwardTransitions, 12);
    await fs.writeFile(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  } finally {
    try { if (browser) await browser.close(); }
    finally {
      try {
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      } finally { await fs.rm(harness, { recursive: true, force: true }); }
    }
  }
  assert.equal(await fs.stat(harness).then(() => true, () => false), false, "Harness cleanup must finish before reporting success");
  console.log(JSON.stringify({ screens: results.length, pendingAwardTransitions: 12, flowChecks: 36, pass: true, output }));
}
await main();
