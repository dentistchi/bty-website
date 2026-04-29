import { expect, test } from "@playwright/test";

/**
 * 비인증 E2E — auth storage 불필요.
 * `middleware`: `NEXT_PUBLIC_SUPABASE_*` 가 있으면 비로그인 시 `/en/bty/login?next=…` 로 보냄.
 * 로컬에서 Supabase 미주입이면 인증 스킵으로 `/en/bty-arena` 가 그대로 열릴 수 있음.
 */
test.describe("Arena hub — unauthenticated", () => {
  test("/en/bty-arena → login (when protected) or canonical load (no Supabase in middleware)", async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    await page.goto("/en/bty-arena", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/en\/bty-arena(\/beginner)?$|\/en\/bty\/login/, { timeout: 25_000 });

    const url = page.url();
    if (url.includes("/bty/login")) {
      expect(url).toContain("next=");
      expect(url).toMatch(/bty-arena/);
    } else {
      await expect(page).toHaveURL(/\/en\/bty-arena(\/beginner)?$/);
    }
  });
});
