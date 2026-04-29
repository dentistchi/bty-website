/**
 * Playwright global setup: DB+Auth seed for the three contract users (fail-fast).
 * Invokes the same entry as `npm run e2e:seed-three-contract-users` so `tsx` resolves `@/` in src.
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";

export default async function globalSetup(): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === "1") {
    console.log("[e2e-global-setup] SKIP — PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 (no DB seed)");
    return;
  }
  const root = path.resolve(__dirname, "..");
  console.log("[e2e-global-setup] START — seedThreeContractUsers (npm run e2e:seed-three-contract-users)");
  console.log("[e2e-global-setup] cwd:", root);

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npmCmd, ["run", "e2e:seed-three-contract-users"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  if (r.error) {
    console.error("[e2e-global-setup] spawn error:", r.error);
    throw r.error;
  }
  if (r.status !== 0) {
    throw new Error(
      `[e2e-global-setup] seedThreeContractUsers FAILED | stage=seed | expected=exit 0 | actual=exit ${r.status ?? "unknown"}`,
    );
  }
  console.log("[e2e-global-setup] OK — three contract users seeded and verified");
}
