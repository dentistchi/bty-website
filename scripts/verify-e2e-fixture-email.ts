/** CI guard: `E2E_EMAIL` must match `expectedFixtureLoginEmail()` (same user as `seedFixtureUser`). */
import { expectedFixtureLoginEmail } from "../src/engine/integration/e2e-test-fixtures.service";

function main() {
  const expected = expectedFixtureLoginEmail();
  const actual = process.env.E2E_EMAIL?.trim() ?? "";
  if (actual !== expected) {
    console.error(
      `[verify-e2e-fixture-email] E2E_EMAIL must match seedFixtureUser: expected "${expected}", got "${actual}". ` +
        "Set E2E_EMAIL to that address, or set E2E_FIXTURE_USER_ID and use e2e-fixture+<uuid>@local.test for custom UUIDs.",
    );
    process.exit(1);
  }
  console.log(`[verify-e2e-fixture-email] OK (${expected})`);
}

main();
