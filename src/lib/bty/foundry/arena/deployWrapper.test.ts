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
    // `process.argv` is read ONLY to decide whether the module was invoked directly.
    const argvUses = code.match(/process\.argv/g) ?? [];
    expect(argvUses.length).toBeLessThanOrEqual(2);
    expect(code).not.toMatch(/process\.argv\.slice\(2\)/);
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
