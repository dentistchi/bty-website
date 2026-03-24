import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern } from "../helpers/arena-canonical";

/**
 * Deprecated paths must redirect to canonical Arena (`/[locale]/bty-arena` or `/beginner`).
 * Requests use old URLs only to assert HTTP redirect behavior.
 */
test.describe("Arena deprecated path redirects", () => {
  test("deprecated result path → canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/result", { waitUntil: "commit" });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });
  });

  test("deprecated play path → canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/play", { waitUntil: "commit" });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });
  });

  test("deprecated play/resolve path → canonical Arena", async ({ page }) => {
    await page.goto("/en/bty-arena/play/resolve", { waitUntil: "commit" });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });
  });

  /**
   * Unauthenticated run alias lives in `arena-guards-deprecated-unauth.public.spec.ts` (`public` project).
   * Only `/bty-arena/run` gets middleware **308 → /bty-arena** before `getUser()` on that first hop (`middleware.ts`).
   *
   * **CI quarantine:** default `CI` (Playwright against `next dev`) flakes on this authenticated 308 chain (session not applied on follow-up → `/bty/login`).
   * Not a product regression; local `next start` passes. Skip unless `E2E_USE_NEXT_START=true` so a job that runs Playwright against **`next start`** can opt in.
   * Canonical Arena behavior remains covered by `arena-play.spec.ts`, `arena-hub.spec.ts`, and other deprecated-path tests above.
   */
  test("deprecated run alias → canonical Arena (authenticated)", async ({ page }) => {
    test.skip(
      Boolean(process.env.CI && process.env.E2E_USE_NEXT_START !== "true"),
      "Quarantined on CI next dev (auth+308 race). Set E2E_USE_NEXT_START=true when BASE_URL uses next start.",
    );

    await page.goto("/en/bty/dashboard", { waitUntil: "load", timeout: 90_000 });
    await expect(page).not.toHaveURL(/\/bty\/login/);
    await expect(page).toHaveURL(/\/en\/bty\/dashboard/, { timeout: 30_000 });

    await page.goto("/en/bty-arena/run", { waitUntil: "load", timeout: 90_000 });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 30_000 });
  });
});
