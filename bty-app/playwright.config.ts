import * as path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/$/, "") || "http://127.0.0.1:3000";
const authFile = path.join(__dirname, "e2e", ".auth", "user.json");
const comebackAuthFile = path.join(__dirname, "e2e", ".auth", "comeback-user.json");

const enableComebackE2E = Boolean(
  process.env.E2E_COMEBACK_EMAIL?.trim() && process.env.E2E_COMEBACK_PASSWORD,
);

/**
 * setup → chromium (기본 계정) / setup-comeback → chromium-comeback (@comeback-journey만)
 * Comeback 프로젝트는 E2E_COMEBACK_* 있을 때만 등록.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    ...(enableComebackE2E
      ? [{ name: "setup-comeback", testMatch: /auth-comeback\.setup\.ts$/ }]
      : []),
    { name: "public", testMatch: "**/*.public.spec.ts" },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: [
        /auth\.setup\.ts$/,
        /auth-comeback\.setup\.ts$/,
        /\.public\.spec\.ts$/,
      ],
      grepInvert: /@comeback-journey/,
      use: { storageState: authFile },
    },
    ...(enableComebackE2E
      ? [
          {
            name: "chromium-comeback",
            dependencies: ["setup-comeback"],
            testMatch: "**/journey.spec.ts",
            grep: /@comeback-journey/,
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
