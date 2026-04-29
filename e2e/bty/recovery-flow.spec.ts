import { test, expect } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "../helpers/cleanup-action-contracts";
import { E2E_CONTRACT_EMAILS, E2E_CONTRACT_USER_IDS } from "../helpers/three-contract-users";

const LOCALE = "en";

test.describe("BTY Recovery flow", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupStaleE2EActionContractsBeforeTest(request, {
      userId: E2E_CONTRACT_USER_IDS.default,
      email: E2E_CONTRACT_EMAILS.default,
      label: "bty-recovery-flow:E2E_DEFAULT_USER",
    });
  });

  test("recovery entry screen visible; when prompt active, save navigates to history", async ({ page }) => {
    await page.goto(`/${LOCALE}/growth/recovery`, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/recovery`), { timeout: 10_000 });
    await expect(page.getByTestId("recovery-entry-screen")).toBeVisible({ timeout: 15_000 });

    // Prompt may be null when no recovery trigger (few signals/reflections); then form is read-only
    const hasPrompt = await page.getByTestId("recovery-prompt-title").isVisible().catch(() => false);

    if (hasPrompt) {
      await page.getByTestId("recovery-pattern-note").fill("Pressure spikes before my first response stabilizes.");
      await page.getByTestId("recovery-reset-action").fill("Pause and restore internal clarity before protecting structure.");
      await page.getByTestId("recovery-reentry-commitment").fill("I will slow the first reaction before re-entering tension.");
      await page.getByTestId("save-recovery").click();
      await expect(page).toHaveURL(new RegExp(`/${LOCALE}/growth/history`));
    } else {
      await expect(page.getByText(/No recovery prompt is active right now/i)).toBeVisible();
    }
  });
});
