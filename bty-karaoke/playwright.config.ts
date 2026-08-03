// BUILD 26B — browser harness owned by bty-karaoke.
//
// Self-contained by design: it starts its own Next server and its own local
// Supabase stub, injects DUMMY env, and never reads `.dev.vars`, production
// credentials or the network. `env.server.ts` skips its .dev.vars hydration when
// KARAOKE_SUPABASE_URL + KARAOKE_SUPABASE_SERVICE_ROLE_KEY are already present,
// which is exactly what the webServer env below guarantees — so a developer with
// real credentials on disk still gets a hermetic run.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 54329);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'off',        // never commit traces
    video: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node e2e/fixtures/stub-supabase.mjs`,
      env: { STUB_PORT: String(STUB_PORT) },
      url: `http://127.0.0.1:${STUB_PORT}/rest/v1/karaoke_rooms?slug=eq.harness-room`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        // Dummy, non-secret values. Their only job is to satisfy the config gates
        // so the signed-out entry renders its Google action and the console can
        // resolve its room from the stub.
        KARAOKE_SUPABASE_URL: `http://127.0.0.1:${STUB_PORT}`,
        KARAOKE_SUPABASE_SERVICE_ROLE_KEY: 'e2e-stub-key-not-a-secret',
        KARAOKE_GOOGLE_WEB_CLIENT_ID: 'e2e-client-id.apps.googleusercontent.com',
        KARAOKE_GOOGLE_WEB_CLIENT_SECRET: 'e2e-client-secret-not-a-secret',
        KARAOKE_PUBLIC_ORIGIN: BASE_URL,
      },
    },
  ],
});
