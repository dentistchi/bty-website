/**
 * Seeds the authoritative E2E fixture (auth user + onboarding step 5 + arena profile + difficulty + avatar + min scenario).
 * Run before `scripts/arena-release-gate.sh` when `SUPABASE_SERVICE_ROLE_KEY` + Supabase URL are available.
 *
 * Env: `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
 * Optional: `E2E_FIXTURE_USER_ID` (else default fixture UUID in e2e-test-fixtures.service).
 */
import { seedFixtureUser } from "@/engine/integration/e2e-test-fixtures.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function main(): Promise<void> {
  if (!getSupabaseAdmin()) {
    console.error(
      "[seed-arena-release-gate-fixture] Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }
  await seedFixtureUser();
  console.log("[seed-arena-release-gate-fixture] seedFixtureUser completed");
}

main().catch((e) => {
  console.error("[seed-arena-release-gate-fixture]", e instanceof Error ? e.message : e);
  process.exit(1);
});
