import { expect, test } from "@playwright/test";
import { canonicalArenaUrlPattern } from "../helpers/arena-canonical";

/**
 * Unauthenticated-only: `public` project has no `storageState` (see `playwright.config.ts`).
 * Kept separate from `arena-guards.spec.ts` (chromium + auth) so session cookies are never
 * cleared in the same project as authenticated deprecated-run coverage.
 */
test.describe("Arena deprecated run alias — unauthenticated", () => {
  /**
   * `/bty-arena/run` → **308** `/{locale}/bty-arena` (middleware). Canonical Arena is protected:
   * unauthenticated + `NEXT_PUBLIC_SUPABASE_*` → `/en/bty/login?next=/en/bty-arena` (next encodes as `%2Fen%2Fbty-arena`).
   * Without Supabase in middleware, the destination may load without a login redirect (same as `arena-hub.public.spec.ts`).
   */
  test("deprecated run alias → login (unauthenticated) or canonical (no Supabase)", async ({
    page,
  }) => {
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
});
