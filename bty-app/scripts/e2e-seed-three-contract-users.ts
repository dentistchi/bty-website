import {
  E2E_CONTRACT_EMAILS,
  seedThreeContractUsers,
} from "../src/engine/integration/e2e-three-contract-users.service";
import { getSupabaseAdmin } from "../src/lib/supabase-admin";

function logEnvPresence(): void {
  const url = Boolean(process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const key = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  console.log(
    `[e2e-seed-three-contract-users] env: SUPABASE_URL(or NEXT_PUBLIC_*)=${url} SUPABASE_SERVICE_ROLE_KEY=${key}`,
  );
  if (!url || !key) {
    console.error(
      "[e2e-seed-three-contract-users] Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY — cannot run Admin seed.",
    );
  }
}

async function main() {
  console.log("[e2e-seed-three-contract-users] START — idempotent seed for:");
  console.log(
    `  • ${E2E_CONTRACT_EMAILS.default} (E2E_DEFAULT_USER)`,
  );
  console.log(
    `  • ${E2E_CONTRACT_EMAILS.step6Policy} (E2E_STEP6_POLICY_USER)`,
  );
  console.log(
    `  • ${E2E_CONTRACT_EMAILS.step6Forced} (E2E_STEP6_FORCED_USER)`,
  );
  logEnvPresence();

  try {
    if (process.env.CI === "true" && !getSupabaseAdmin()) {
      throw new Error(
        "[e2e-seed-three-contract-users] CI requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    await seedThreeContractUsers();
    console.log("[e2e-seed-three-contract-users] OK — all accounts seeded + verified");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint =
      /e2e_default|e2e_step6_policy|e2e_step6_forced|@test\.com/i.test(msg) ? "" : " (check which step failed in logs above)";
    console.error(`[e2e-seed-three-contract-users] FAIL${hint}:`, msg);
    process.exit(1);
  }
}

void main();
