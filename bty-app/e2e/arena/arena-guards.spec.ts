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
   * Use `waitUntil: "load"` (not `commit`) so the 308 → protected `/bty-arena` chain finishes like `auth.setup` / arena-hub; `commit` can resolve too early on redirects.
   */
  test("deprecated run alias → canonical Arena (authenticated)", async ({ page }) => {
    await page.goto("/en/bty-arena/run", { waitUntil: "load", timeout: 60_000 });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });
  });
});
