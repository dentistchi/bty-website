/**
 * Three contract users → separate storageState files (no shared cookie jar).
 * Session: UI login once per account; reuse storage in later projects (contract §1, §6.2).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { test as setup, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { cleanupStaleE2EActionContractsBeforeTest } from "./helpers/cleanup-action-contracts";
import { loginBtyArenaAndOptionalStorage } from "./helpers/login-bty-arena-storage";
import {
  assertE2eContractCiPasswordOrThrow,
  E2E_CONTRACT_EMAILS,
  E2E_CONTRACT_USER_IDS,
  formatContractSmokeFailure,
  legacyDefaultAuthPath,
  passwordForContractUser,
  storageStatePathForContractUser,
  type E2EThreeContractKey,
} from "./helpers/three-contract-users";

const KEYS: E2EThreeContractKey[] = ["default", "step6Policy", "step6Forced"];

setup.beforeAll(() => {
  assertE2eContractCiPasswordOrThrow();
});

async function seedOneContractUser(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
  key: E2EThreeContractKey,
): Promise<void> {
  const email = E2E_CONTRACT_EMAILS[key];
  const password = passwordForContractUser(key);
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/$/, "") || "http://127.0.0.1:3000";
  const storageStatePath = storageStatePathForContractUser(key);
  const userId = E2E_CONTRACT_USER_IDS[key];

  await cleanupStaleE2EActionContractsBeforeTest(request, {
    userId,
    email: E2E_CONTRACT_EMAILS[key],
    label: `${E2E_CONTRACT_EMAILS[key]}:pre`,
  });

  try {
    await loginBtyArenaAndOptionalStorage(page, context, {
      email,
      password,
      baseUrl,
      storageStatePath,
      label: `contract-${key}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      formatContractSmokeFailure({
        email,
        stage: "login",
        expected: "successful POST /api/auth/login → /en/bty-arena with cookies + storageState written",
        actual: msg,
      }),
    );
  }

  await cleanupStaleE2EActionContractsBeforeTest(request, {
    userId,
    email: E2E_CONTRACT_EMAILS[key],
    label: `${E2E_CONTRACT_EMAILS[key]}:post`,
  });

  if (key === "default") {
    const legacy = legacyDefaultAuthPath();
    await fs.mkdir(path.dirname(legacy), { recursive: true }).catch(() => {});
    await fs.copyFile(storageStatePath, legacy);
    console.log(`[auth-three-contract] copied default storageState → ${legacy}`);
  }
}

for (const key of KEYS) {
  setup(`authenticate ${E2E_CONTRACT_EMAILS[key]}`, async ({ page, context, request }) => {
    await seedOneContractUser(page, context, request, key);
  });
}
