import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Mount the real trainer and its generated Tailwind CSS inside the shell's height/
// scroll contract. The shell chrome is a fixture, not a Teams device certification.
// All persistence is an in-memory mock; this test cannot write to a real backend.
// Run with PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1 and
// playwright test e2e/clinical-encounter-geometry.public.spec.ts --project=public
const root = path.resolve(__dirname, "..");
const trainer = readFileSync(path.join(root, "src/components/bty-arena/ClinicalReasoningTrainer.tsx"), "utf8");
const shell = `
  <div class="flex h-[100dvh] flex-col overflow-hidden bg-slate-900">
    <header class="h-20 shrink-0 bg-white p-6">BTY</header>
    <main id="shell-scroll" class="flex-1 overflow-y-auto px-5 pb-4 pt-8">
      <div class="flex flex-col gap-4">
        <button class="self-start text-white">Back</button>
        <div class="overflow-hidden rounded-2xl bg-white text-slate-900" id="trainer"></div>
      </div>
    </main>
    <nav id="dock" class="h-16 shrink-0 p-4 text-white">Today · Learn · Practice · Me</nav>
    <footer class="h-16 shrink-0 bg-white p-4">Teams navigation</footer>
  </div><script id="writes" type="application/json">[]</script>`;
let html: string;
let bundle: string;

test.beforeAll(async () => {
  const css = await postcss([tailwindcss({ content: [{ raw: trainer + shell, extension: "tsx" }] })])
    .process("@tailwind base; @tailwind utilities;", { from: undefined });
  html = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style>${shell}`;
  bundle = buildSync({
    stdin: {
      resolveDir: root, loader: "tsx", contents: `
        import { createRoot } from "react-dom/client";
        import { ClinicalReasoningTrainer } from "@/components/bty-arena/ClinicalReasoningTrainer";
        import { startEncounter, submit } from "@/domain/clinical-encounter/session";
        const writes = [];
        let rows = [{status: "active", raw_trace: submit(startEncounter("original"), "When did this happen?")}];
        window.fetch = async (_url, init) => {
          if (init?.method !== "POST") return Response.json({ok: true, traces: rows});
          const body = JSON.parse(init.body);
          writes.push(body);
          document.getElementById("writes").textContent = JSON.stringify(writes);
          if (body.operation === "restart") {
            const trace = startEncounter("replacement-" + writes.length);
            rows = [{status: "active", raw_trace: trace}];
            return Response.json({ok: true, status: "active", trace});
          }
          return Response.json({ok: true, status: body.operation === "complete" ? "completed" : "active"});
        };
        createRoot(document.getElementById("trainer")).render(<ClinicalReasoningTrainer />);
      `,
    },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(root, "src") }, define: { "process.env.NODE_ENV": '"test"' },
  }).outputFiles[0].text;
});

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`new attempt exposes a usable composer at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/*", route => route.abort());
    await page.setContent(html);
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "Start new attempt", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Started new attempt");

    const input = page.getByLabel("Clinical encounter message");
    // This is the regression: the old 100vh/mt-auto layout hides the composer.
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByText(/It happened about two hours ago/)).toHaveCount(0);
    const geometry = await input.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const scroll = document.getElementById("shell-scroll")!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, bottom: rect.bottom, scrollBottom: scroll.bottom };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(viewport.width);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.scrollBottom);

    await input.fill("When did this happen?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/It happened about two hours ago/)).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Saved to server");
    const writes = JSON.parse((await page.locator("#writes").textContent())!);
    expect(writes.filter((w: { operation: string }) => w.operation === "restart")).toHaveLength(1);
    expect(writes.at(-1).trace.traceId).toBe("replacement-1");
    expect(writes.at(-1).trace.events.some((e: { doctorMessage?: string }) => e.doctorMessage === "When did this happen?")).toBe(true);
    await page.screenshot({ path: test.info().outputPath("new-attempt.png") });
  });
}

test("confirmed Start over returns to the first usable question", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/*", route => route.abort());
  await page.setContent(html);
  await page.addScriptTag({ content: bundle });
  await page.getByRole("button", { name: "Continue previous attempt" }).click();
  await expect(page.getByText(/It happened about two hours ago/)).toBeVisible();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByText("Abandon this attempt and start a new one?")).toBeVisible();
  await page.getByRole("button", { name: "Start new attempt", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Started new attempt");
  await expect(page.getByText("Abandon this attempt and start a new one?")).toHaveCount(0);
  await expect(page.getByText(/It happened about two hours ago/)).toHaveCount(0);
  const input = page.getByLabel("Clinical encounter message");
  await expect(input).toBeInViewport({ ratio: 1 });
  await input.fill("When did this happen?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/It happened about two hours ago/)).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Saved to server");
  const writes = JSON.parse((await page.locator("#writes").textContent())!);
  expect(writes.filter((w: { operation: string }) => w.operation === "restart")).toHaveLength(1);
  expect(writes.at(-1).trace.traceId).toBe("replacement-1");
});
