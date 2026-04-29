import * as path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/$/, "") || "http://127.0.0.1:3000";
/** Three isolated E2E accounts — see `e2e/helpers/three-contract-users.ts` + `auth-three-contract.setup.ts`. */
const authContractDefault = path.join(__dirname, "e2e", ".auth", "default-user.json");
const authContractStep6Policy = path.join(__dirname, "e2e", ".auth", "policy-user.json");
const authContractStep6Forced = path.join(__dirname, "e2e", ".auth", "forced-user.json");
const comebackAuthFile = path.join(__dirname, "e2e", ".auth", "comeback-user.json");

const enableComebackE2E = Boolean(
  process.env.E2E_COMEBACK_EMAIL?.trim() && process.env.E2E_COMEBACK_PASSWORD,
);

/**
 * Step 6 policy vs forced use **different** contract Auth users (`e2e_step6_*`) — avoids 409 from shared user.
 * Ordering: still defer Step 6 until `bty-loop` + `chromium` finish unless `PW_STEP6_ISOLATED=1`.
 */
const btyLoopStep6Dependencies =
  process.env.PW_STEP6_ISOLATED === "1" ? (["setup"] as const) : (["setup", "bty-loop", "chromium"] as const);

const threeContractSmokeIgnore = "**/three-contract.smoke.*.spec.ts";

/**
 * setup → chromium (기본 계정) / setup-comeback → chromium-comeback (@comeback-journey만)
 * Comeback 프로젝트는 E2E_COMEBACK_* 있을 때만 등록.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: path.join(__dirname, "e2e", "global-setup.ts"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /** CI: single worker reduces races on shared default contract user (bty-loop vs chromium). */
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
    ...devices["Desktop Chrome"],
  },
  projects: [
    /**
     * Three contract users → `default-user.json` / `policy-user.json` / `forced-user.json` (+ `user.json` copy from default).
     * Legacy single-user UI login: run `npx playwright test e2e/auth.setup.ts` with a custom `--project` if needed.
     */
    { name: "setup", testMatch: /auth-three-contract\.setup\.ts$/, timeout: 180_000 },
    ...(enableComebackE2E
      ? [{ name: "setup-comeback", testMatch: /auth-comeback\.setup\.ts$/ }]
      : []),
    { name: "public", testMatch: "**/*.public.spec.ts" },
    /** BTY leadership loop — Arena → Growth → My Page (uses storageState when setup exists). */
    {
      name: "bty-loop",
      testMatch: "**/e2e/bty/**/*.spec.ts",
      testIgnore: ["**/bty/elite-action-contract*.spec.ts", threeContractSmokeIgnore],
      dependencies: ["setup"],
      use: { storageState: authContractDefault },
    },
    {
      name: "bty-loop-step6-policy",
      testMatch: "**/bty/elite-action-contract.spec.ts",
      dependencies: [...btyLoopStep6Dependencies],
      workers: 1,
      use: { storageState: authContractStep6Policy },
    },
    {
      name: "bty-loop-step6-forced",
      testMatch: "**/bty/elite-action-contract.forced-elite.spec.ts",
      dependencies: [...btyLoopStep6Dependencies],
      workers: 1,
      use: { storageState: authContractStep6Forced },
    },
    {
      name: "three-contract-smoke",
      testMatch: "**/three-contract.smoke.*.spec.ts",
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: [
        /auth\.setup\.ts$/,
        /auth-three-contract\.setup\.ts$/,
        /auth-comeback\.setup\.ts$/,
        /\.public\.spec\.ts$/,
        /e2e\/bty\//,
        threeContractSmokeIgnore,
      ],
      grepInvert: /@comeback-journey/,
      use: { storageState: authContractDefault },
    },
    ...(enableComebackE2E
      ? [
          {
            name: "chromium-comeback",
            dependencies: ["setup-comeback"],
            testMatch: "**/journey.spec.ts",
            grep: /@comeback-journey/,
            retries: 0,
            use: { storageState: comebackAuthFile },
          },
        ]
      : []),
  ],
  // Do not start webServer when: CI, or PLAYWRIGHT_NO_WEB_SERVER set, or BASE_URL is https (deployed). Otherwise start dev server with reuse.
  webServer:
    process.env.CI ||
    process.env.PLAYWRIGHT_NO_WEB_SERVER === "1" ||
    baseURL.startsWith("https://")
      ? undefined
      : {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
});
