import * as path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * BTY E2E 운영 체계 v1
 * - setup: 로그인 → e2e/.auth/user.json (E2E_EMAIL / E2E_PASSWORD 필수)
 * - public: storage 없음 (리다이렉트 등)
 * - chromium: setup 의존 + 동일 storage
 * @see docs/BTY_E2E_OPERATIONS_V1.md
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const authFile = path.join(__dirname, "e2e", ".auth", "user.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: "**/*.public.spec.ts",
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts$/, /\.public\.spec\.ts$/],
      use: { storageState: authFile },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_SKIP_SERVER === "1"
      ? undefined
      : {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
