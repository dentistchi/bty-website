import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILD_ARTIFACT,
  REFUSALS,
  REQUIRED_BRANCH,
  REQUIRED_PACKAGE_NAME,
  TARGET_ENVIRONMENT,
  TARGET_WORKER,
  buildVarArgs,
  checkLiveIdentity,
  checkPostBuild,
  checkPreconditions,
  isFullSha,
  readPackageName,
  CONTAINMENT_TOKENS,
  ISOLATED_HOTFIX_APPLICATION_PATHS,
  ISOLATED_HOTFIX_APPLICATION_SHA,
  ISOLATED_HOTFIX_BASE_SHA,
  ISOLATED_HOTFIX_BRANCH,
  ISOLATED_HOTFIX_FLAG,
  ISOLATED_HOTFIX_TOOLING_PATHS,
  checkIsolatedHotfix,
  resolveMode,
} from "../../../../../scripts/deploy-bty-arena-staging-with-source.mjs";

/**
 * THE DEPLOY WRAPPER'S REFUSAL RULES (Slice 3.2I-R5B2-R5C-3V2).
 *
 * The wrapper binds a commit SHA to a Worker deployment. Every property that makes that binding
 * TRUE rather than merely asserted is a guard, and each guard is a pure function so it can be
 * proven without deploying anything.
 *
 * No test here runs git, npm, wrangler or a network request.
 */

const SHA = "cf7e3720f739c952c86324a668b6ffd98f5ea6b1";
const OTHER_SHA = "27bbe605d6a9ae055608884435e6406ac6b6ee00";
const APRIL = "2026-04-27-api-version-endpoint-v1";

const clean = {
  branch: REQUIRED_BRANCH,
  workerName: TARGET_WORKER,
  environment: TARGET_ENVIRONMENT,
  packageName: REQUIRED_PACKAGE_NAME,
  stagedCount: 0,
  unstagedCount: 0,
  headSha: SHA,
};

describe("[R5C-3V2] the target is fixed, never chosen at runtime", () => {
  it("names the staging worker and environment as constants", () => {
    expect(TARGET_WORKER).toBe("bty-arena-staging");
    expect(TARGET_ENVIRONMENT).toBe("staging");
  });

  it("a clean staging state is accepted", () => {
    expect(checkPreconditions(clean)).toEqual({ ok: true });
  });

  it.each([
    ["a production target", { environment: "production" }, REFUSALS.environment],
    ["any other worker", { workerName: "bty-arena" }, REFUSALS.worker],
    ["a production worker name", { workerName: "bty-arena-production" }, REFUSALS.worker],
    ["another branch", { branch: "main" }, REFUSALS.branch],
    ["a detached head", { branch: "HEAD" }, REFUSALS.branch],
    ["the outer repository", { packageName: "btytrainingcenter" }, REFUSALS.repository],
  ])("refuses %s", (_l, over, reason) => {
    expect(checkPreconditions({ ...clean, ...over })).toEqual({ ok: false, reason });
  });
});

describe("[R5C-3V2] the repository is identified by reading package.json", () => {
  it("returns this repository's real package name", () => {
    // Regression: the first version shelled out to node and then JSON.parse'd the BARE name it
    // printed, which threw SyntaxError. The wrapper's own guard refused to deploy — correctly —
    // but the refusal named an "unexpected failure" rather than a precondition.
    expect(readPackageName()).toBe(REQUIRED_PACKAGE_NAME);
  });

  it("returns an empty name rather than throwing when package.json is unreadable", () => {
    // An unreadable manifest must reach `checkPreconditions` as a refusal, not as a crash.
    expect(readPackageName("/nonexistent-directory-for-this-test")).toBe("");
    expect(checkPreconditions({ ...clean, packageName: "" })).toEqual({ ok: false, reason: REFUSALS.repository });
  });
});

describe("[R5C-3V2] only a CLEAN TRACKED tree may be deployed", () => {
  it("refuses staged tracked changes", () => {
    expect(checkPreconditions({ ...clean, stagedCount: 1 })).toEqual({ ok: false, reason: REFUSALS.staged });
  });

  it("refuses unstaged tracked changes", () => {
    expect(checkPreconditions({ ...clean, unstagedCount: 3 })).toEqual({ ok: false, reason: REFUSALS.unstaged });
  });

  it("UNTRACKED files alone do not block — the 54 forensic artifacts are not dirt", () => {
    // Requiring their deletion would destroy evidence to satisfy a check that does not depend on
    // them. Only TRACKED state can change what a commit means.
    expect(checkPreconditions({ ...clean, stagedCount: 0, unstagedCount: 0 })).toEqual({ ok: true });
    // The guard has no untracked input at all, by construction.
    expect(Object.keys(clean)).not.toContain("untrackedCount");
  });
});

describe("[R5C-3V2] the SHA must be a real commit", () => {
  it.each([
    ["a short sha", "cf7e3720"],
    ["the April label", APRIL],
    ["a branch name", "inner-main"],
    ["empty", ""],
    ["uppercase", SHA.toUpperCase()],
  ])("refuses %s as HEAD", (_l, headSha) => {
    expect(checkPreconditions({ ...clean, headSha })).toEqual({ ok: false, reason: REFUSALS.sha });
  });

  it("isFullSha accepts only 40 lowercase hex", () => {
    expect(isFullSha(SHA)).toBe(true);
    expect(isFullSha(`${SHA}a`)).toBe(false);
    expect(isFullSha(undefined)).toBe(false);
  });
});

describe("[R5C-3V2] the post-build re-check is what makes the SHA a fact", () => {
  const built = { expectedSha: SHA, headSha: SHA, stagedCount: 0, unstagedCount: 0, artifactExists: true };

  it("an unchanged tree with an artifact passes", () => {
    expect(checkPostBuild(built)).toEqual({ ok: true });
  });

  it("refuses a HEAD that moved during the build", () => {
    // A build takes minutes; a working tree is a moving target. Without this the SHA would be a
    // claim about the build's START, not about the artifact.
    expect(checkPostBuild({ ...built, headSha: OTHER_SHA })).toEqual({ ok: false, reason: REFUSALS.headMoved });
  });

  it.each([
    ["staged", { stagedCount: 1 }],
    ["unstaged", { unstagedCount: 1 }],
  ])("refuses a tree dirtied (%s) during the build", (_l, over) => {
    expect(checkPostBuild({ ...built, ...over })).toEqual({ ok: false, reason: REFUSALS.treeDirtied });
  });

  it("refuses a missing build artifact", () => {
    expect(checkPostBuild({ ...built, artifactExists: false })).toEqual({ ok: false, reason: REFUSALS.artifact });
    expect(BUILD_ARTIFACT).toBe(".open-next/worker.js");
  });
});

describe("[R5C-3V2] both runtime variables carry the SAME sha", () => {
  it("injects the canonical identity and the route-visible label together", () => {
    expect(buildVarArgs(SHA)).toEqual([
      "--var",
      `BTY_SOURCE_COMMIT_SHA:${SHA}`,
      "--var",
      `BTY_DEPLOY_VERSION:${SHA}`,
    ]);
  });

  it("refuses to build var arguments from anything but a real sha", () => {
    // A malformed value must never reach the deploy command line.
    for (const bad of [APRIL, "cf7e3720", "", "inner-main"]) expect(() => buildVarArgs(bad)).toThrow();
  });
});

describe("[R5C-3V2] the live endpoint is the proof, not the deploy exit code", () => {
  it("accepts only an exact match", () => {
    expect(checkLiveIdentity(SHA, SHA)).toEqual({ ok: true });
  });

  it.each([
    ["the April label", APRIL],
    ["a different commit", OTHER_SHA],
    ["a truncated sha", SHA.slice(0, 12)],
    ["nothing readable", null],
  ])("refuses %s", (_l, live) => {
    expect(checkLiveIdentity(live, SHA)).toEqual({ ok: false, reason: REFUSALS.liveMismatch });
  });
});

describe("[R5C-3V2] the wrapper is safe to run with real credentials in the environment", () => {
  const src = readFileSync(join(process.cwd(), "scripts/deploy-bty-arena-staging-with-source.mjs"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|\*).*$/gm, "");

  it("never builds a shell string from interpolated values", () => {
    // This process inherits Cloudflare and database credentials from the operator's terminal.
    expect(code).not.toMatch(/execSync\s*\(/);
    expect(code).not.toMatch(/shell\s*:\s*true/);
    expect(code).toMatch(/execFileSync/);
  });

  it("never prints the environment", () => {
    expect(code).not.toMatch(/console\.\w+\([^)]*process\.env[^)]*\)/);
    expect(code).not.toMatch(/JSON\.stringify\(\s*process\.env/);
  });

  it("forwards no caller-supplied deploy arguments", () => {
    // R2E-R2 widened this from "argv is never read" to the property that actually mattered all
    // along: argv MAY select a mode, but no argv-derived value may reach a command. The mode is
    // decided by comparing against a literal flag, and `resolveMode` returns a fixed string rather
    // than anything the caller wrote.
    for (const call of code.match(/execFileSync\([\s\S]*?\)\s*;/g) ?? []) {
      expect(call, "no argv value may reach a subprocess").not.toMatch(/argv/);
    }
    expect(code).toMatch(/includes\(ISOLATED_HOTFIX_FLAG\)/);
    // The deploy argument array is still built only from the SHA.
    expect(code).toMatch(/"deploy",\s*\.\.\.buildVarArgs\(SOURCE_SHA\)/);
  });

  it("attempts no rollback and no redeploy of its own", () => {
    // Asserted against INVOCATIONS, not against the word: the failure message deliberately says
    // "no rollback ... were attempted", and a naive word search would flag the very sentence that
    // documents the guarantee.
    const invocations = code.match(/execFileSync\(\s*"([^"]+)"\s*,\s*\[([^\]]*)\]/g) ?? [];
    for (const call of invocations) {
      expect(call, "no rollback subcommand may be invoked").not.toMatch(/"rollback"|"versions"/);
    }
    // Exactly one deploy invocation. Polling a propagating deployment is not redeploying it.
    expect((code.match(/"deploy"/g) ?? []).length).toBe(1);
    expect((code.match(/execFileSync\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("exits non-zero on every refusal", () => {
    expect(code).toMatch(/process\.exit\(1\)/);
  });
});

/**
 * THE BOUNDED ONE-HOTFIX AUTHORITY (Slice 3.2K-BUILDER-REDESIGN-R2E-R2).
 *
 * The live Worker carries containment source that calls a governed-admission function the live
 * database does not have. Replacing it means deploying a branch that is deliberately NOT inner-main,
 * which the R5C-3V2 guard refuses — correctly.
 *
 * These tests exist to prove the escape hatch is a KEYHOLE and not a door: one branch, one commit,
 * one base, three application paths, and no way in without the explicit flag. The most important
 * assertions here are the ones that prove the ORDINARY path did not change.
 */

const isolatedClean = {
  branch: ISOLATED_HOTFIX_BRANCH,
  workerName: TARGET_WORKER,
  environment: TARGET_ENVIRONMENT,
  packageName: REQUIRED_PACKAGE_NAME,
  stagedCount: 0,
  unstagedCount: 0,
  headSha: SHA,
  applicationIsAncestorOfHead: true,
  applicationParentSha: ISOLATED_HOTFIX_BASE_SHA,
  applicationDiffPaths: [...ISOLATED_HOTFIX_APPLICATION_PATHS],
  toolingDiffPaths: ["scripts/deploy-bty-arena-staging-with-source.mjs"],
  containmentHits: [],
};

describe("[R2E-R2] the default inner-main guard is unchanged", () => {
  it("still admits inner-main with no flag", () => {
    expect(resolveMode([])).toBe("normal");
    expect(checkPreconditions(clean)).toEqual({ ok: true });
  });

  it("still refuses the hotfix branch on ordinary invocation", () => {
    // The exact command an operator would type by habit must still be refused.
    expect(resolveMode([])).toBe("normal");
    expect(checkPreconditions({ ...clean, branch: ISOLATED_HOTFIX_BRANCH })).toEqual({
      ok: false,
      reason: REFUSALS.branch,
    });
  });

  it("still refuses any other branch, flag or no flag", () => {
    for (const branch of ["main", "feature/x", "builder-r2e-isolated-staging-2", ""]) {
      expect(checkPreconditions({ ...clean, branch })).toEqual({ ok: false, reason: REFUSALS.branch });
    }
  });
});

describe("[R2E-R2] the bounded path requires the explicit flag", () => {
  it("is unreachable without the flag", () => {
    expect(resolveMode([])).toBe("normal");
    expect(resolveMode(["--isolated"])).toBe("normal");
    expect(resolveMode(["--isolated-builder-r2e-hotfix-2"])).toBe("normal");
  });

  it("is selected only by the exact flag", () => {
    expect(resolveMode([ISOLATED_HOTFIX_FLAG])).toBe("isolated-builder-r2e-hotfix");
    expect(ISOLATED_HOTFIX_FLAG).toBe("--isolated-builder-r2e-hotfix");
  });
});

describe("[R2E-R2] the authority is exact-branch and exact-SHA bounded", () => {
  it("admits the measured hotfix", () => {
    expect(checkIsolatedHotfix(isolatedClean)).toEqual({ ok: true });
  });

  it("refuses another branch even WITH the flag", () => {
    for (const branch of ["main", "inner-main", "builder-r2e-isolated-staging-x", "builder-anything"]) {
      expect(checkIsolatedHotfix({ ...isolatedClean, branch })).toEqual({
        ok: false,
        reason: REFUSALS.isolatedBranch,
      });
    }
  });

  it("refuses the exact branch at the wrong SHA", () => {
    // The named commit is not in this history at all.
    expect(checkIsolatedHotfix({ ...isolatedClean, applicationIsAncestorOfHead: false })).toEqual({
      ok: false,
      reason: REFUSALS.isolatedLineage,
    });
  });

  it("refuses a hotfix built on any base but the known-safe one", () => {
    expect(checkIsolatedHotfix({ ...isolatedClean, applicationParentSha: OTHER_SHA })).toEqual({
      ok: false,
      reason: REFUSALS.isolatedBase,
    });
    // Specifically: rebuilt on the containment commit.
    expect(checkIsolatedHotfix({ ...isolatedClean, applicationParentSha: "7657a97f5bbdc275ae4c6e252383d74863d15913" })).toEqual({
      ok: false,
      reason: REFUSALS.isolatedBase,
    });
  });

  it("names one branch, one commit and one base as literals, never as patterns", () => {
    // Comments stripped first: the wrapper's own header says "no allowlist, no wildcard" in order
    // to document the constraint, and an unscoped search would match that sentence rather than code.
    const src = readFileSync(join(process.cwd(), "scripts", "deploy-bty-arena-staging-with-source.mjs"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*(\/\/|\*).*$/gm, "");
    expect(ISOLATED_HOTFIX_BRANCH).toBe("builder-r2e-isolated-staging");
    expect(ISOLATED_HOTFIX_APPLICATION_SHA).toBe("b8edd3142cb2d34b77dc0d5e39585a27f6fcbffe");
    expect(ISOLATED_HOTFIX_BASE_SHA).toBe("fd0c7fc6d2ec0cb7775c496788db8c7e97f9e3d3");
    // No wildcard, no allowlist, no environment override.
    expect(src).not.toMatch(/builder-\*|startsWith\("builder|ALLOWED_BRANCHES|allowlist/i);
    expect(src).not.toMatch(/process\.env\.[A-Z_]*(BRANCH|HOTFIX|ALLOW|SHA)/);
    // The branch is compared for EQUALITY against the literal — never matched as a pattern.
    expect(src).toMatch(/branch !== ISOLATED_HOTFIX_BRANCH/);
  });
});

describe("[R2E-R2] the deployed application source must equal the measured hotfix", () => {
  it("refuses an extra application file", () => {
    expect(
      checkIsolatedHotfix({
        ...isolatedClean,
        applicationDiffPaths: [...ISOLATED_HOTFIX_APPLICATION_PATHS, "src/lib/bty/foundry/arena/extra.ts"],
      }),
    ).toEqual({ ok: false, reason: REFUSALS.isolatedApplicationDiff });
  });

  it("refuses a MISSING application file, not only an extra one", () => {
    expect(
      checkIsolatedHotfix({ ...isolatedClean, applicationDiffPaths: ISOLATED_HOTFIX_APPLICATION_PATHS.slice(0, 2) }),
    ).toEqual({ ok: false, reason: REFUSALS.isolatedApplicationDiff });
  });

  it("refuses an application edit made after the hotfix commit", () => {
    expect(
      checkIsolatedHotfix({
        ...isolatedClean,
        toolingDiffPaths: ["scripts/deploy-bty-arena-staging-with-source.mjs", "src/components/foundry/x.tsx"],
      }),
    ).toEqual({ ok: false, reason: REFUSALS.isolatedToolingDiff });
  });

  it("permits only the wrapper and its own test to change afterwards", () => {
    expect(checkIsolatedHotfix({ ...isolatedClean, toolingDiffPaths: [...ISOLATED_HOTFIX_TOOLING_PATHS] })).toEqual({
      ok: true,
    });
    expect(ISOLATED_HOTFIX_TOOLING_PATHS).toHaveLength(2);
  });
});

describe("[R2E-R2] migrations and containment source are refused", () => {
  it("refuses a migration change in the application diff", () => {
    expect(
      checkIsolatedHotfix({
        ...isolatedClean,
        applicationDiffPaths: [
          ...ISOLATED_HOTFIX_APPLICATION_PATHS,
          "supabase/migrations/20260805050000_foundry_practice_generation_spend_containment_v1.sql",
        ],
      }),
      // Caught as a diff mismatch first; either refusal is correct, neither may be an admission.
    ).not.toEqual({ ok: true });
  });

  it("refuses a migration change made after the hotfix commit", () => {
    expect(
      checkIsolatedHotfix({
        ...isolatedClean,
        toolingDiffPaths: ["supabase/migrations/20260805050000_x.sql"],
      }),
    ).toEqual({ ok: false, reason: REFUSALS.isolatedToolingDiff });
  });

  it("refuses containment vocabulary found in the application diff", () => {
    for (const token of CONTAINMENT_TOKENS) {
      expect(checkIsolatedHotfix({ ...isolatedClean, containmentHits: [token] })).toEqual({
        ok: false,
        reason: REFUSALS.isolatedContainment,
      });
    }
  });

  it("names the containment vocabulary that must never ship with this hotfix", () => {
    expect(CONTAINMENT_TOKENS).toContain("p_submission_intent_id");
    expect(CONTAINMENT_TOKENS).toContain("system_blocked");
    expect(CONTAINMENT_TOKENS).toContain("duplicate_existing_intent");
  });
});

describe("[R2E-R2] every ordinary safety property still applies to the bounded path", () => {
  it("refuses a dirty tree", () => {
    expect(checkIsolatedHotfix({ ...isolatedClean, stagedCount: 1 })).toEqual({ ok: false, reason: REFUSALS.staged });
    expect(checkIsolatedHotfix({ ...isolatedClean, unstagedCount: 2 })).toEqual({
      ok: false,
      reason: REFUSALS.unstaged,
    });
  });

  it("refuses a non-staging target and a foreign repository", () => {
    expect(checkIsolatedHotfix({ ...isolatedClean, workerName: "bty-arena" })).toEqual({
      ok: false,
      reason: REFUSALS.worker,
    });
    expect(checkIsolatedHotfix({ ...isolatedClean, packageName: "btytrainingcenter" })).toEqual({
      ok: false,
      reason: REFUSALS.repository,
    });
  });

  it("refuses source movement during the build through the SAME post-build check", () => {
    expect(
      checkPostBuild({ expectedSha: SHA, headSha: OTHER_SHA, stagedCount: 0, unstagedCount: 0, artifactExists: true }),
    ).toEqual({ ok: false, reason: REFUSALS.headMoved });
    expect(
      checkPostBuild({ expectedSha: SHA, headSha: SHA, stagedCount: 1, unstagedCount: 0, artifactExists: true }),
    ).toEqual({ ok: false, reason: REFUSALS.treeDirtied });
  });

  it("still injects the REAL head sha, never the application sha", () => {
    // Part 3: the deployment repository identity is the tooling commit. Reporting the application
    // commit as the deployed SHA would be a falsification, so the wrapper must not special-case it.
    const src = readFileSync(
      join(process.cwd(), "scripts", "deploy-bty-arena-staging-with-source.mjs"),
      "utf8",
    );
    expect(src).toMatch(/const SOURCE_SHA = before\.headSha;/);
    expect(src).not.toMatch(/SOURCE_SHA\s*=\s*ISOLATED_HOTFIX_APPLICATION_SHA/);
    expect(buildVarArgs(SHA)).toEqual([
      "--var",
      `BTY_SOURCE_COMMIT_SHA:${SHA}`,
      "--var",
      `BTY_DEPLOY_VERSION:${SHA}`,
    ]);
  });
});
