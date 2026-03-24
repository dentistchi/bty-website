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
   * CI `next dev` can surface a race when the **first** navigation in a test is straight to `/run`: the 308 chain may run
   * before Supabase session cookies are fully applied to the follow-up GET `/en/bty-arena`, so middleware sends `/bty/login`.
   * Warm up like `auth.setup.ts`: **load a protected route first** (session + cookies bound), then hit the deprecated alias.
   */
  test("deprecated run alias → canonical Arena (authenticated)", async ({ page }) => {
    await page.goto("/en/bty-arena", { waitUntil: "load", timeout: 60_000 });
    await expect(page).not.toHaveURL(/\/bty\/login/);
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });

    await page.goto("/en/bty-arena/run", { waitUntil: "load", timeout: 60_000 });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });
  });
});
