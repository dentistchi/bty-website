/**
 * Contract §6.2 — minimal browser entry smoke per account.
 * Elite scenario is environment-dependent; non-elite / router outcomes use explicit test.skip (§3.2).
 */
import { expect, test } from "@playwright/test";
import {
  assertAuthCookiesPresentOrThrow,
  assertNotRedirectedToLoginOrThrow,
  prepareFreshArenaSessionElite,
  skipMessageForGate,
} from "./helpers/arena-step6-policy";
import {
  E2E_CONTRACT_EMAILS,
  formatContractSmokeFailure,
  storageStatePathForContractUser,
} from "./helpers/three-contract-users";

test.describe(E2E_CONTRACT_EMAILS.default, () => {
  test.use({ storageState: storageStatePathForContractUser("default") });

  test("§6.2 — /en/bty-arena reachable; not left on login; not beginner redirect", async ({ page, context }) => {
    const email = E2E_CONTRACT_EMAILS.default;
    await assertAuthCookiesPresentOrThrow(context);
    await page.goto("/en/bty-arena", { waitUntil: "load", timeout: 120_000 });
    const url = page.url();
    try {
      await assertNotRedirectedToLoginOrThrow(page, url);
    } catch (e) {
      throw new Error(
        formatContractSmokeFailure({
          email,
          stage: "ui",
          expected: "pathname without /bty/login (§6.2 default row)",
          actual: e instanceof Error ? e.message : String(e),
        }),
      );
    }
    await expect(page).toHaveURL(/\/en\/bty-arena/);
    await expect(page).not.toHaveURL(/\/bty\/login/);
    if (url.includes("/bty-arena/beginner")) {
      throw new Error(
        formatContractSmokeFailure({
          email,
          stage: "ui",
          expected: "not routed to /bty-arena/beginner (contract F2 / core-xp gate)",
          actual: url,
        }),
      );
    }
  });
});

test.describe(E2E_CONTRACT_EMAILS.step6Policy, () => {
  test.use({ storageState: storageStatePathForContractUser("step6Policy") });

  test("§6.2 — prepareFreshArenaSessionElite: proceed or contract-allowed skip", async ({ page, context }) => {
    const email = E2E_CONTRACT_EMAILS.step6Policy;
    await assertAuthCookiesPresentOrThrow(context);
    const gate = await prepareFreshArenaSessionElite(page);
    if (gate.proceed) return;

    if (gate.reason === "beginner-path") {
      throw new Error(
        formatContractSmokeFailure({
          email,
          stage: "ui",
          expected: "gate.proceed true OR skippable non-beginner reason (§6.2 policy)",
          actual: `beginner-path ${gate.detail ?? ""}`,
        }),
      );
    }
    test.skip(true, skipMessageForGate(gate.reason, gate.detail));
  });
});

test.describe(E2E_CONTRACT_EMAILS.step6Forced, () => {
  test.use({ storageState: storageStatePathForContractUser("step6Forced") });

  test("§6.2 — forced account: must not be beginner; elite entry may skip if catalog non-elite", async ({
    page,
    context,
  }) => {
    const email = E2E_CONTRACT_EMAILS.step6Forced;
    await assertAuthCookiesPresentOrThrow(context);
    const gate = await prepareFreshArenaSessionElite(page);

    if (!gate.proceed && gate.reason === "beginner-path") {
      throw new Error(
        formatContractSmokeFailure({
          email,
          stage: "ui",
          expected: "non-beginner arena (forced flow precondition §3.2 / §6.2)",
          actual: `beginner-path ${gate.detail ?? ""}`,
        }),
      );
    }

    if (!gate.proceed) {
      test.skip(true, skipMessageForGate(gate.reason, gate.detail));
    }
  });
});
