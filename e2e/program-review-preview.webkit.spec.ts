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

  test("G10: derived sections render as free-flowing text — clipping is structurally impossible", async ({ page }) => {
    await openReview(page);
    // R6.1 replaced six free textareas with read-only derived text plus structured controls.
    // A paragraph cannot clip the way a fixed-height textarea did.
    const derived = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="program-derived-"]')).map((el) => ({
        id: (el as HTMLElement).dataset.testid ?? "",
        tag: el.tagName,
        chars: (el.textContent ?? "").length,
        overflow: el.scrollHeight - el.clientHeight,
      })),
    );
    expect(derived.length).toBeGreaterThanOrEqual(5);
    for (const d of derived) {
      expect(d.tag, d.id).toBe("P");
      expect(d.overflow, `${d.id} overflows by ${d.overflow}px`).toBeLessThanOrEqual(1);
      expect(d.chars, d.id).toBeGreaterThan(20);
    }
  });

  test("G10: the narrative field still grows and shrinks with its content", async ({ page }) => {
    await openReview(page);
    const field = page.getByTestId("program-edit-why_it_matters");
    const long = await field.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { h: t.clientHeight, overflow: t.scrollHeight - t.clientHeight, chars: t.value.length };
    });
    // The preview fixture's narrative sits near the 700-character ceiling on purpose.
    expect(long.chars).toBeGreaterThan(400);
    expect(long.overflow).toBeLessThanOrEqual(1);

    await field.fill("Short again.");
    const short = await field.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    expect(short).toBeLessThan(long.h);
  });

  test("G9: structured controls propagate to every dependent section, with zero network", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (FORBIDDEN.test(r.url())) seen.push(r.url());
    });
    await openReview(page);

    const standard = page.getByTestId("program-derived-observable_standard");
    const apply = page.getByTestId("program-derived-field_application");
    const beforeStandard = await standard.textContent();
    const beforeApply = await apply.textContent();

    await page.getByTestId("program-details-toggle-observable_standard").click();
    await page.getByTestId("program-field-actor").fill("the duty pharmacist");

    await expect(standard).toContainText("the duty pharmacist");
    await expect(apply).toContainText("the duty pharmacist");
    expect(await standard.textContent()).not.toBe(beforeStandard);
    expect(await apply.textContent()).not.toBe(beforeApply);
    await expect(page.getByTestId("program-section-observable_standard")).toContainText("Adjusted by you");

    // Reset restores BTY's draft exactly.
    await page.getByTestId("program-reset").click();
    expect(await standard.textContent()).toBe(beforeStandard);
    await expect(page.getByTestId("program-section-observable_standard")).toContainText("Drafted by BTY");

    expect(seen, `preview must not call a backend: ${seen.join(", ")}`).toEqual([]);
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
