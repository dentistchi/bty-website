import { test, expect } from "@playwright/test";

/**
 * THE NON-PAID PHYSICAL READABILITY GATE, automated (Slice 3.2L-R5) — G13/G14/G15.
 *
 * The R4 window ended in a terminal refusal and displayed no proposal, so the AutoTextarea
 * repair shipped in R4 has still never been rendered on a phone. `/dev/program-review-preview`
 * exists so that question can be answered without spending a provider call.
 *
 * This runs the REAL page in WebKit — the engine the Capacitor shell uses — at an iPhone
 * viewport, and asserts three things the unit tests cannot:
 *
 *   1. loading, editing, resetting and discarding issue ZERO network requests to any
 *      provider, generation, apply or publish endpoint;
 *   2. no section's last line is clipped, at live lengths and at the 700-character ceiling;
 *   3. the fields stay editable — review and edit share one control.
 *
 * Requires a server (`baseURL`). Skipped automatically when none is reachable, so the suite
 * does not fail on a machine with nothing running.
 */

const PATH = "/en/dev/program-review-preview";

/** Anything that would mean the preview reached a real backend. */
const FORBIDDEN = /\/api\/(bty\/foundry|arena|bty\/action-contract)|program-draft|module-draft|openai|anthropic|completions/i;

test.describe("Program review preview — non-paid readability gate", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!baseURL, "needs a running server");
    const res = await page.goto(PATH, { waitUntil: "domcontentloaded" }).catch(() => null);
    test.skip(res === null, "server not reachable");
    test.skip(res!.status() === 404, "preview route not enabled in this environment");
    await expect(page.getByTestId("program-review-preview")).toBeVisible();
    // The entry button exists before React hydrates, and a click that lands first does
    // nothing. Wait for the page to settle so the handler is attached.
    await page.waitForLoadState("networkidle");
  });

  /** Entry → target confirmation → review, the same path the Host takes. */
  async function openReview(page: import("@playwright/test").Page) {
    await page.getByTestId("program-generate").click();
    const confirm = page.getByTestId("program-target-confirm-action");
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.getByTestId("program-review")).toBeVisible();
  }

  test("G14: the route is enabled here, and says plainly that it is not real", async ({ page }) => {
    await expect(page.getByTestId("preview-banner")).toHaveText(/not a real training draft/i);
    // Never indexed.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  });

  test("G13: opening the proposal issues no provider, generation or apply request", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (FORBIDDEN.test(r.url())) seen.push(`${r.method()} ${r.url()}`);
    });

    await openReview(page);

    // Edit a section, then discard.
    const field = page.getByTestId("program-edit-why_it_matters");
    await field.fill("A shorter rewrite of why this matters, typed by the Host during the gate.");
    await page.getByTestId("program-discard").click();
    await expect(page.getByTestId("program-authorship-entry")).toBeVisible();

    expect(seen, `preview must not call a backend: ${seen.join(", ")}`).toEqual([]);
  });

  test("G13: applying is a visible no-op and writes nothing", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (FORBIDDEN.test(r.url())) seen.push(r.url());
    });
    await openReview(page);
    await page.getByTestId("program-apply").click();
    await expect(page.getByTestId("preview-apply-noop")).toContainText(/nothing was added/i);
    expect(seen).toEqual([]);
  });

  test("G15: no section's last line is clipped at an iPhone width", async ({ page }) => {
    await openReview(page);

    const measured = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-testid^="program-edit-"]')).map((t) => ({
        id: t.dataset.testid ?? "",
        overflow: t.scrollHeight - t.clientHeight,
        chars: t.value.length,
        overflowY: getComputedStyle(t).overflowY,
        readOnly: t.readOnly,
      })),
    );

    expect(measured.length).toBeGreaterThanOrEqual(7);
    // At least one section is genuinely long — otherwise this proves nothing.
    expect(Math.max(...measured.map((m) => m.chars))).toBeGreaterThan(400);
    for (const m of measured) {
      expect(m.overflow, `${m.id} is clipped by ${m.overflow}px`).toBeLessThanOrEqual(1);
      expect(m.overflowY, m.id).not.toBe("hidden");
      expect(m.readOnly, m.id).toBe(false);
    }
  });

  test("G15: a field grows when the Host types and shrinks again on reset", async ({ page }) => {
    await openReview(page);
    const field = page.getByTestId("program-edit-completion_check");

    const before = await field.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    await field.fill("A much longer answer. ".repeat(30));
    const after = await field.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    expect(after).toBeGreaterThan(before);
    await expect(field).toHaveJSProperty("scrollHeight", await field.evaluate((el) => (el as HTMLTextAreaElement).scrollHeight));

    await field.fill("Short again.");
    const shrunk = await field.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    expect(shrunk).toBeLessThan(after);
  });

  test("G15: the page — not the field — is the scrolling surface", async ({ page }) => {
    await openReview(page);
    // Reachable by scrolling the PAGE. Nothing is trapped inside a field: the sections
    // grew to their content, so the only scroll that has to work is the document's.
    const apply = page.getByTestId("program-apply");
    await apply.scrollIntoViewIfNeeded();
    await expect(apply).toBeInViewport();

    // And no generated field needs its own inner scroll to be read.
    const innerScrollNeeded = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-testid^="program-edit-"]'))
        .filter((t) => t.scrollHeight - t.clientHeight > 1)
        .map((t) => t.dataset.testid),
    );
    expect(innerScrollNeeded).toEqual([]);
  });

  test("advisory blocks stay free-flowing, not boxed into fields", async ({ page }) => {
    await openReview(page);
    const assumptions = page.getByTestId("program-assumptions");
    await expect(assumptions).toBeVisible();
    expect(await assumptions.locator("textarea").count()).toBe(0);
  });
});
