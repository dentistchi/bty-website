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
   * `/bty-arena/run` → **308** `/{locale}/bty-arena` (middleware). Canonical Arena is protected:
   * unauthenticated + `NEXT_PUBLIC_SUPABASE_*` → `/en/bty/login?next=/en/bty-arena` (next encodes as `%2Fen%2Fbty-arena`).
   * Without Supabase in middleware, the destination may load without a login redirect (same as `arena-hub.public.spec.ts`).
   */
  test("deprecated run alias → login (unauthenticated) or canonical (no Supabase)", async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    await page.goto("/en/bty-arena/run", { waitUntil: "commit" });
    await expect(page).toHaveURL(
      /\/en\/bty\/login|\/en\/bty-arena(\/beginner)?$/,
      { timeout: 15_000 },
    );
    const url = page.url();
    if (url.includes("/bty/login")) {
      expect(new URL(url).searchParams.get("next")).toBe("/en/bty-arena");
    } else {
      await expect(page).toHaveURL(canonicalArenaUrlPattern("en"));
    }
  });

  test("deprecated run alias → canonical Arena (authenticated)", async ({ page }) => {
    await page.goto("/en/bty-arena/run", { waitUntil: "commit" });
    await expect(page).toHaveURL(canonicalArenaUrlPattern("en"), { timeout: 15_000 });
  });
});
