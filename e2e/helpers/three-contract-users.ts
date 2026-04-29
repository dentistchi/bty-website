/**
 * E2E three-account contract — constants only (no src/ imports).
 * @see docs/E2E_TEST_USER_CONTRACT.md
 */
import * as path from "node:path";

export type E2EThreeContractKey = "default" | "step6Policy" | "step6Forced";

/** Role keys (docs / CI) — maps 1:1 to {@link E2EThreeContractKey}. */
export const E2E_CONTRACT_ROLE_KEYS: Record<E2EThreeContractKey, string> = {
  default: "E2E_DEFAULT_USER",
  step6Policy: "E2E_STEP6_POLICY_USER",
  step6Forced: "E2E_STEP6_FORCED_USER",
};

export type E2EContractRoleEnvName = "E2E_DEFAULT_USER" | "E2E_STEP6_POLICY_USER" | "E2E_STEP6_FORCED_USER";

/** Inverse map: fixed role env label → contract key (default / policy / forced). */
export const E2E_CONTRACT_KEY_BY_ROLE_ENV: Record<E2EContractRoleEnvName, E2EThreeContractKey> = {
  E2E_DEFAULT_USER: "default",
  E2E_STEP6_POLICY_USER: "step6Policy",
  E2E_STEP6_FORCED_USER: "step6Forced",
};

/** Immutable UUIDs per contract §1 (must match `e2e-three-contract-users.service.ts`). */
export const E2E_CONTRACT_USER_IDS: Record<E2EThreeContractKey, string> = {
  default: "b0000000-0000-4000-8000-00000000e201",
  step6Policy: "b0000000-0000-4000-8000-00000000e202",
  step6Forced: "b0000000-0000-4000-8000-00000000e203",
};

export const E2E_CONTRACT_EMAILS: Record<E2EThreeContractKey, string> = {
  default: "e2e_default@test.com",
  step6Policy: "e2e_step6_policy@test.com",
  step6Forced: "e2e_step6_forced@test.com",
};

const FIXTURE_FALLBACK_PASSWORD = "E2eFixture-local-smoke-32chars-min!!";

export function passwordForContractUser(key: E2EThreeContractKey): string {
  const d = process.env.E2E_PASSWORD?.trim();
  const p = process.env.E2E_STEP6_POLICY_PASSWORD?.trim();
  const f = process.env.E2E_STEP6_FORCED_PASSWORD?.trim();
  if (key === "default") return d || FIXTURE_FALLBACK_PASSWORD;
  if (key === "step6Policy") return p || d || FIXTURE_FALLBACK_PASSWORD;
  return f || d || FIXTURE_FALLBACK_PASSWORD;
}

export function contractAuthDir(): string {
  return path.join(__dirname, "..", ".auth");
}

/** Per-account Playwright storageState paths (no cross-account cookie reuse). */
export function storageStatePathForContractUser(key: E2EThreeContractKey): string {
  const file =
    key === "default" ? "default-user.json" : key === "step6Policy" ? "policy-user.json" : "forced-user.json";
  return path.join(contractAuthDir(), file);
}

/** Legacy default path used by older suites; duplicated from contract default after login. */
export function legacyDefaultAuthPath(): string {
  return path.join(contractAuthDir(), "user.json");
}

/**
 * Single-line failure line for smoke/setup debugging (contract §6.3 style).
 */
export function formatContractSmokeFailure(opts: {
  email: string;
  stage: "login" | "api" | "ui";
  expected: string;
  actual: string;
}): string {
  return `E2E_CONTRACT_FAIL | email=${opts.email} | stage=${opts.stage} | expected=${opts.expected} | actual=${opts.actual}`;
}

/** Session acquisition path per contract §6.1 (must match server `ARENA_PIPELINE_DEFAULT`). */
export function arenaSessionSmokePath(): "/api/arena/session/next" | "/api/arena/n/session" {
  return process.env.ARENA_PIPELINE_DEFAULT?.trim().toLowerCase() === "new"
    ? "/api/arena/n/session"
    : "/api/arena/session/next";
}

/**
 * CI: `seedThreeContractUsers` and UI login must share secrets — base `E2E_PASSWORD` is the usual single source.
 * Local: fixture fallback passwords may apply when env is unset (see `passwordForContractUser` + service seed).
 */
export function assertE2eContractCiPasswordOrThrow(): void {
  if (process.env.CI === "true" && !process.env.E2E_PASSWORD?.trim()) {
    throw new Error(
      formatContractSmokeFailure({
        email: "(contract users)",
        stage: "login",
        expected: "E2E_PASSWORD in CI (must match seeded contract passwords; contract §1)",
        actual: "E2E_PASSWORD unset",
      }),
    );
  }
}
