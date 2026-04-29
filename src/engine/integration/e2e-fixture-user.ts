/**
 * Local E2E fixture wiring only — **do not import from Next.js routes or API handlers.**
 * Sets `SMOKE_TEST_USER_ID` / `LOOP_HEALTH_TEST_USER_ID` from {@link E2E_FIXTURE_USER_ID}.
 */

export const E2E_FIXTURE_USER_ID_ENV = "E2E_FIXTURE_USER_ID" as const;

let savedSmoke: string | undefined;
let savedLoop: string | undefined;
let seeded = false;

/**
 * Binds smoke / loop health env to the fixture user id (required for {@link runSmokeTest} et al.).
 * For DB row seeding use `seedFixtureUser` in `e2e-test-fixtures.service`.
 */
export async function bindE2EFixtureEnv(): Promise<{ userId: string }> {
  const userId = process.env[E2E_FIXTURE_USER_ID_ENV]?.trim();
  if (!userId) {
    throw new Error(
      `[e2e] Set ${E2E_FIXTURE_USER_ID_ENV} to a real auth user UUID (same as local smoke test user).`,
    );
  }
  savedSmoke = process.env.SMOKE_TEST_USER_ID;
  savedLoop = process.env.LOOP_HEALTH_TEST_USER_ID;
  process.env.SMOKE_TEST_USER_ID = userId;
  process.env.LOOP_HEALTH_TEST_USER_ID = userId;
  seeded = true;
  return { userId };
}

/**
 * Restores previous `SMOKE_TEST_USER_ID` / `LOOP_HEALTH_TEST_USER_ID` if {@link bindE2EFixtureEnv} ran.
 */
export async function restoreE2EFixtureEnv(): Promise<void> {
  if (!seeded) return;
  if (savedSmoke !== undefined) process.env.SMOKE_TEST_USER_ID = savedSmoke;
  else delete process.env.SMOKE_TEST_USER_ID;
  if (savedLoop !== undefined) process.env.LOOP_HEALTH_TEST_USER_ID = savedLoop;
  else delete process.env.LOOP_HEALTH_TEST_USER_ID;
  savedSmoke = undefined;
  savedLoop = undefined;
  seeded = false;
}
