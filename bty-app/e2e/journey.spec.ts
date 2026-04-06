import { expect, test } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "./helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "./helpers/three-contract-users";

const COMEBACK_DAY = Number(process.env.E2E_COMEBACK_JOURNEY_DAY ?? 8);

test.describe("Journey", () => {
  test.describe("default user flow", () => {
    test.use({ storageState: "e2e/.auth/user.json" });

    test.beforeEach(async ({ request }) => {
      await cleanupStaleE2EActionContractsBeforeTest(request, {
        userId: E2E_CONTRACT_USER_IDS.default,
        email: E2E_CONTRACT_EMAILS.default,
        label: "journey-default:E2E_DEFAULT_USER",
      });
    });

    test("opens Journey from Growth and navigates to current day step", async ({ page }) => {
      await page.goto("/en/growth");

      await expect(page.getByTestId("growth-journey-card")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("growth-journey-card").click();

      await expect(page).toHaveURL(/\/en\/growth\/journey/);
      await expect(page.getByTestId("journey-board")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("journey-current-day")).toBeVisible();
      await expect(page.getByTestId("journey-continue-button")).toBeVisible();

      /** 기본 계정도 DB에서 comeback 조건을 만족하면 모달이 위에 떠서 Continue 클릭이 막힘 */
      const comebackModal = page.getByTestId("comeback-modal");
      try {
        await comebackModal.waitFor({ state: "visible", timeout: 4_000 });
        await page.getByTestId("close-comeback-button").click();
        await expect(comebackModal).not.toBeVisible({ timeout: 8_000 });
      } catch {
        /* 모달 없음 */
      }

      await page.getByTestId("journey-continue-button").click();

      await expect(page).toHaveURL(/\/en\/growth\/journey\/day\/\d+/);
      await expect(page.getByTestId("journey-day-step")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("journey-complete-button")).toBeVisible();
      await expect(page.getByTestId("journey-back-button")).toBeVisible();
    });
  });

  test.describe("comeback user flow", () => {
    /** Resume Journey가 updated_at을 갱신하면 재시도 시 모달이 안 뜸 → 이 describe만 retry 끔 */
    test.describe.configure({ retries: 0 });
    test.use({ storageState: "e2e/.auth/comeback-user.json" });

    test(
      "shows comeback modal, resumes journey, and advances to next day",
      { tag: "@comeback-journey" },
      async ({ page }) => {
        const bounceBackResponses: number[] = [];

        page.on("response", async (response) => {
          if (response.url().includes("/api/journey/bounce-back")) {
            bounceBackResponses.push(response.status());
          }
        });

        await page.goto("/en/growth/journey");

        await expect(page.getByTestId("comeback-modal")).toBeVisible({ timeout: 25_000 });
        await expect(page.getByTestId("comeback-modal-title")).toBeVisible();
        await expect(page.getByTestId("resume-journey-button")).toBeVisible();

        await page.getByTestId("resume-journey-button").click();

        await expect(page.locator('[data-testid="comeback-modal"]')).toHaveCount(0);
        await expect(page.getByTestId("journey-board")).toBeVisible();
        await expect(page.getByTestId("journey-current-day")).toHaveText(
          new RegExp(`Day\\s+${COMEBACK_DAY}`, "i"),
        );

        await expect.poll(() => bounceBackResponses.length).toBeGreaterThan(0);
        expect(bounceBackResponses.some((status) => status >= 200 && status < 300)).toBeTruthy();

        await page.getByTestId("journey-continue-button").click();

        await expect(page).toHaveURL(new RegExp(`/en/growth/journey/day/${COMEBACK_DAY}`));
        await expect(page.getByTestId("journey-day-step")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId("journey-complete-button")).toBeVisible();

        await page.getByTestId("journey-complete-button").click();

        await expect(page).toHaveURL(/\/en\/growth\/journey/, { timeout: 30_000 });
        await expect(page.getByTestId("journey-board")).toBeVisible();
        const nextDay = COMEBACK_DAY + 1;
        await expect(page.getByTestId("journey-current-day")).toHaveText(
          new RegExp(`Day\\s+${nextDay}`, "i"),
          { timeout: 20_000 },
        );
      },
    );
  });
});
