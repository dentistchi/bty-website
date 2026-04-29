/**
 * Local-only E2E orchestrator — **do not import from `src/app` routes or API handlers.**
 *
 * Run: `npm run e2e` (script uses `tsx` for `@/` path resolution; plain `ts-node` needs `tsconfig-paths`).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { bindE2EFixtureEnv, restoreE2EFixtureEnv } from "@/engine/integration/e2e-fixture-user";
import { runExtendedHealthCheck } from "@/engine/integrity/e2e-loop-validator.service";
import { runFinalWiringCheck } from "@/engine/integration/final-wiring-check";
import { runSmokeTest } from "@/engine/integration/full-system-smoke-test";
import { runI18nAudit } from "@/engine/integration/i18n-completeness-validator";
import { runReleaseReadinessCheck } from "@/engine/integration/release-readiness-check";

export class E2eFailure extends Error {
  constructor(
    public readonly step: string,
    public readonly blockers: string[],
  ) {
    super(`E2E failed at ${step}`);
    this.name = "E2eFailure";
  }
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[e2e] ${label}: ${Date.now() - t0}ms`);
  }
}

function blockersFromSmoke(errors: string[]): string[] {
  return errors.length ? [...errors] : ["smoke: overallOk is false"];
}

function blockersFromExtendedHealth(): string[] {
  return ["extended_health: report.ok is false"];
}

function blockersFromWiring(): string[] {
  return ["final_wiring: all_ok is false"];
}

function blockersFromI18n(missingKo: number, missingEn: number): string[] {
  return [`i18n_audit: missing_ko_count=${missingKo} missing_en_count=${missingEn} (expected 0)`];
}

/**
 * Runs fixture seed → smoke → extended health → final wiring → i18n → release readiness (sequential).
 * Throws {@link E2eFailure} on the first failed step (after {@link restoreE2EFixtureEnv} in `finally`).
 */
export async function runE2E(): Promise<void> {
  const totalStart = Date.now();
  try {
    await timed("bindE2EFixtureEnv", () => bindE2EFixtureEnv());

    const smoke = await timed("runSmokeTest", () => runSmokeTest());
    if (!smoke.overallOk) {
      console.error("[e2e] FAIL runSmokeTest blockers:", blockersFromSmoke(smoke.errors));
      throw new E2eFailure("runSmokeTest", blockersFromSmoke(smoke.errors));
    }

    const ext = await timed("runExtendedHealthCheck", () => runExtendedHealthCheck());
    if (!ext.ok) {
      const failed = [...ext.base.checks, ...ext.extendedChecks].filter((c) => c.status !== "PASS");
      const blockers =
        failed.length > 0
          ? failed.map((c) => `${c.key}: ${c.detail ?? c.status}`)
          : blockersFromExtendedHealth();
      console.error("[e2e] FAIL runExtendedHealthCheck blockers:", blockers);
      throw new E2eFailure("runExtendedHealthCheck", blockers);
    }

    const wiring = await timed("runFinalWiringCheck", () => runFinalWiringCheck());
    if (!wiring.all_ok) {
      const blockers = wiring.results
        .filter((r) => r.status === "ERROR")
        .map((r) => `${r.service_name}: ${r.error ?? JSON.stringify(r.detail) ?? "ERROR"}`);
      const out = blockers.length ? blockers : blockersFromWiring();
      console.error("[e2e] FAIL runFinalWiringCheck blockers:", out);
      throw new E2eFailure("runFinalWiringCheck", out);
    }

    const i18nAudit = await timed("runI18nAudit", () => runI18nAudit());
    if (i18nAudit.missingKoCount !== 0 || i18nAudit.missingEnCount !== 0) {
      const b = blockersFromI18n(i18nAudit.missingKoCount, i18nAudit.missingEnCount);
      console.error("[e2e] FAIL runI18nAudit blockers:", b);
      throw new E2eFailure("runI18nAudit", b);
    }

    const release = await timed("runReleaseReadinessCheck", () => runReleaseReadinessCheck());
    if (!release.allClear) {
      console.error("[e2e] FAIL runReleaseReadinessCheck blockers:", release.blockers);
      throw new E2eFailure("runReleaseReadinessCheck", release.blockers);
    }

    console.log(
      `[e2e] PASS ReleaseReadinessReport.all_clear=true total_elapsed_ms=${Date.now() - totalStart}`,
    );
  } finally {
    await restoreE2EFixtureEnv().catch((e) => console.warn("[e2e] restoreE2EFixtureEnv:", e));
  }
}

function isRunAsMain(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const resolved = path.resolve(argv1);
  const self = path.resolve(fileURLToPath(import.meta.url));
  return resolved === self;
}

if (isRunAsMain()) {
  void runE2E()
    .then(() => process.exit(0))
    .catch((e: unknown) => {
      if (e instanceof E2eFailure) {
        console.error(`[e2e] aborted at ${e.step}`);
      } else {
        console.error("[e2e] fatal:", e);
      }
      process.exit(1);
    });
}
