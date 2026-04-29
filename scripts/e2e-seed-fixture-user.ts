import { getSupabaseAdmin } from "../src/lib/supabase-admin";
import { seedFixtureUser } from "../src/engine/integration/e2e-test-fixtures.service";

async function main() {
  try {
    if (process.env.CI === "true" && !getSupabaseAdmin()) {
      throw new Error(
        "[e2e-seed-fixture-user] CI requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    await seedFixtureUser();
    console.log("[e2e-seed-fixture-user] OK");
  } catch (err) {
    console.error(
      "[e2e-seed-fixture-user] FAIL:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

main();
