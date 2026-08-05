#!/usr/bin/env node
/**
 * STAGING DEPLOY WITH IMMUTABLE SOURCE IDENTITY (Slice 3.2I-R5B2-R5C-3V2).
 *
 * Every generation parent attempt recorded `2026-04-27-api-version-endpoint-v1` — a release label
 * written into `wrangler.toml` months earlier. The obvious repair, embedding the commit at build
 * time, is unavailable: `next.config.js`, `package.json`, `open-next.config.ts` and the
 * `/api/version` route are all shared with the outer repository and may not be edited.
 *
 * So identity is bound at DEPLOY time instead, by this script, and the script is the guard:
 *
 *     branch → target → clean tracked tree → SHA → build → RE-CHECK → deploy → verify live
 *
 * The re-check after the build is the part that matters. A SHA captured before a build only names
 * that build if nothing moved underneath it; without the second check this would be a claim, not a
 * measurement.
 *
 * Both `BTY_SOURCE_COMMIT_SHA` and `BTY_DEPLOY_VERSION` are injected with the SAME SHA — the first
 * because it is the canonical generation identity, the second because it is the only way the
 * unmodifiable `/api/version` route can report the real commit.
 *
 * SAFETY: every command runs through `execFileSync` with an argument ARRAY. Nothing is interpolated
 * into a shell string, the Worker name and environment are fixed constants, no argument is
 * forwarded from the caller, and no environment is ever dumped — this process inherits real
 * Cloudflare and database credentials from the operator's terminal.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---- fixed constants — never taken from argv ------------------------------
export const TARGET_WORKER = "bty-arena-staging";
export const TARGET_ENVIRONMENT = "staging";
export const REQUIRED_BRANCH = "inner-main";
export const REQUIRED_PACKAGE_NAME = "bty-website";
export const BUILD_ARTIFACT = ".open-next/worker.js";
export const SHA_PATTERN = /^[0-9a-f]{40}$/;

// ---- bounded one-hotfix authority (Slice 3.2K-BUILDER-REDESIGN-R2E-R2) ----
//
// The live Worker carries containment source that calls a 16-argument governed-admission function
// the live database does not have. Replacing it requires deploying a branch that is deliberately
// NOT inner-main — which the guard above correctly refuses.
//
// This is NOT a general release feature and must never become one. It names ONE branch and ONE
// commit as literal constants: no allowlist, no wildcard, no environment variable, no argv value.
// When this hotfix is folded back into inner-main, this block is deleted, not extended.
export const ISOLATED_HOTFIX_FLAG = "--isolated-builder-r2e-hotfix";
export const ISOLATED_HOTFIX_BRANCH = "builder-r2e-isolated-staging";
export const ISOLATED_HOTFIX_APPLICATION_SHA = "b8edd3142cb2d34b77dc0d5e39585a27f6fcbffe";
export const ISOLATED_HOTFIX_BASE_SHA = "fd0c7fc6d2ec0cb7775c496788db8c7e97f9e3d3";

/** Exactly the R2E repair. A fourth application path is a refusal, not a warning. */
export const ISOLATED_HOTFIX_APPLICATION_PATHS = [
  "src/components/foundry/event-rooms/ModuleBuilderShell.tsx",
  "src/components/foundry/event-rooms/moduleAutosave.ts",
  "src/components/foundry/event-rooms/reviewEditNavigation.test.tsx",
];

/** The only paths that may change AFTER the application commit. Neither reaches the Worker bundle. */
export const ISOLATED_HOTFIX_TOOLING_PATHS = [
  "scripts/deploy-bty-arena-staging-with-source.mjs",
  "src/lib/bty/foundry/arena/deployWrapper.test.ts",
];

/** Vocabulary that only exists in the containment commit. Any hit means the isolation leaked. */
export const CONTAINMENT_TOKENS = [
  "submissionIntentId",
  "submission_intent_id",
  "p_submission_intent_id",
  "system_blocked",
  "duplicate_existing_intent",
  "review_execution_failed",
  "foundry_practice_generation_is_system_block_v1",
];

// ==========================================================================
// PURE GUARDS — exported so the refusal rules are testable without deploying
// ==========================================================================

/** Refusal reasons. Named, not collapsed, so an operator learns which precondition failed. */
export const REFUSALS = {
  branch: "refused: not on the required branch",
  worker: "refused: target worker is not the staging worker",
  environment: "refused: target environment is not staging",
  repository: "refused: not the bty-app repository",
  staged: "refused: staged tracked changes present",
  unstaged: "refused: unstaged tracked changes present",
  sha: "refused: HEAD is not a 40-character lowercase sha",
  headMoved: "refused: HEAD changed during the build",
  treeDirtied: "refused: tracked tree changed during the build",
  artifact: "refused: build produced no worker artifact",
  liveMismatch: "refused: live version does not equal the deployed source commit",
  isolatedBranch: "refused: isolated hotfix mode requires the exact hotfix branch",
  isolatedLineage: "refused: the isolated application commit is not an ancestor of HEAD",
  isolatedBase: "refused: the isolated application commit does not sit on the required base",
  isolatedApplicationDiff: "refused: the application diff is not exactly the measured hotfix",
  isolatedToolingDiff: "refused: something other than deployment tooling changed after the hotfix",
  isolatedMigration: "refused: a migration path changed in the isolated hotfix",
  isolatedContainment: "refused: containment source is present in the isolated hotfix",
};

export const isFullSha = (v) => typeof v === "string" && SHA_PATTERN.test(v);

/**
 * Would this deployment be allowed to START?
 *
 * UNTRACKED FILES ARE NOT DIRT. 54 forensic artifacts sit in this working tree and were proven in
 * R5C-2A to be outside every build input. Requiring their deletion would destroy evidence to
 * satisfy a check that does not depend on them; only TRACKED state can change what a commit means.
 */
export function checkPreconditions(state) {
  const { branch, workerName, environment, packageName, stagedCount, unstagedCount, headSha } = state;
  if (branch !== REQUIRED_BRANCH) return { ok: false, reason: REFUSALS.branch };
  if (workerName !== TARGET_WORKER) return { ok: false, reason: REFUSALS.worker };
  if (environment !== TARGET_ENVIRONMENT) return { ok: false, reason: REFUSALS.environment };
  if (packageName !== REQUIRED_PACKAGE_NAME) return { ok: false, reason: REFUSALS.repository };
  if (stagedCount > 0) return { ok: false, reason: REFUSALS.staged };
  if (unstagedCount > 0) return { ok: false, reason: REFUSALS.unstaged };
  if (!isFullSha(headSha)) return { ok: false, reason: REFUSALS.sha };
  return { ok: true };
}

/** The flag is the ONLY way to reach the bounded path. Its absence means ordinary behaviour. */
export function resolveMode(argv) {
  return (argv ?? []).includes(ISOLATED_HOTFIX_FLAG) ? "isolated-builder-r2e-hotfix" : "normal";
}

const sameSet = (a, b) => {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * May THIS ONE hotfix deploy from a branch that is not inner-main?
 *
 * Nine independent conditions, all literal. The shared preconditions are NOT re-implemented here —
 * they are delegated with the branch substituted, so the isolated path stays at least as strict as
 * the ordinary one and any future tightening of that guard applies to both.
 */
export function checkIsolatedHotfix(state) {
  const {
    branch,
    applicationIsAncestorOfHead,
    applicationParentSha,
    applicationDiffPaths,
    toolingDiffPaths,
    containmentHits,
  } = state;

  if (branch !== ISOLATED_HOTFIX_BRANCH) return { ok: false, reason: REFUSALS.isolatedBranch };

  const shared = checkPreconditions({ ...state, branch: REQUIRED_BRANCH });
  if (!shared.ok) return shared;

  // Condition 2 — the measured application commit is genuinely in this history, not merely named.
  if (applicationIsAncestorOfHead !== true) return { ok: false, reason: REFUSALS.isolatedLineage };
  // Condition 3 — and it sits directly on the last known-safe base, so containment cannot precede it.
  if (applicationParentSha !== ISOLATED_HOTFIX_BASE_SHA) return { ok: false, reason: REFUSALS.isolatedBase };
  // Condition 4 — exactly the three measured paths: not a subset, not a superset.
  if (!sameSet(applicationDiffPaths ?? [], ISOLATED_HOTFIX_APPLICATION_PATHS)) {
    return { ok: false, reason: REFUSALS.isolatedApplicationDiff };
  }
  // Condition 5 — after the hotfix, only deployment tooling. An application edit here is refused.
  if ((toolingDiffPaths ?? []).some((p) => !ISOLATED_HOTFIX_TOOLING_PATHS.includes(p))) {
    return { ok: false, reason: REFUSALS.isolatedToolingDiff };
  }
  // Condition 6 — stated separately from 4 and 5 because a migration is the one thing that would
  // make a deployed Worker and a live database disagree, which is the defect being repaired.
  const everyPath = [...(applicationDiffPaths ?? []), ...(toolingDiffPaths ?? [])];
  if (everyPath.some((p) => p.startsWith("supabase/migrations/"))) {
    return { ok: false, reason: REFUSALS.isolatedMigration };
  }
  // Condition 7 — content, not just paths. A containment token anywhere in the diff is a refusal.
  if ((containmentHits ?? []).length > 0) return { ok: false, reason: REFUSALS.isolatedContainment };

  return { ok: true };
}

/**
 * Does the built artifact still describe the commit it was started from?
 *
 * Re-measured AFTER the build, because a build takes minutes and a working tree is a moving target.
 */
export function checkPostBuild(state) {
  const { expectedSha, headSha, stagedCount, unstagedCount, artifactExists } = state;
  if (headSha !== expectedSha) return { ok: false, reason: REFUSALS.headMoved };
  if (stagedCount > 0 || unstagedCount > 0) return { ok: false, reason: REFUSALS.treeDirtied };
  if (!artifactExists) return { ok: false, reason: REFUSALS.artifact };
  return { ok: true };
}

/** The live endpoint must echo the exact SHA, or the deployment is not identity-valid. */
export function checkLiveIdentity(liveVersion, expectedSha) {
  if (liveVersion !== expectedSha) return { ok: false, reason: REFUSALS.liveMismatch };
  return { ok: true };
}

/** `--var KEY:VALUE` pairs. Measured in R5C-3V2: a CLI var REPLACES the same-named wrangler value. */
export function buildVarArgs(sha) {
  if (!isFullSha(sha)) throw new Error(REFUSALS.sha);
  return ["--var", `BTY_SOURCE_COMMIT_SHA:${sha}`, "--var", `BTY_DEPLOY_VERSION:${sha}`];
}

// ==========================================================================
// EXECUTION
// ==========================================================================

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const countLines = (s) => (s === "" ? 0 : s.split("\n").length);

/** The package name, or "" when it cannot be read — either way `checkPreconditions` decides. */
export function readPackageName(root = ROOT) {
  try {
    const parsed = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return typeof parsed?.name === "string" ? parsed.name : "";
  } catch {
    return "";
  }
}

function observe() {
  return {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    headSha: git(["rev-parse", "HEAD"]),
    stagedCount: countLines(git(["diff", "--cached", "--name-only"])),
    unstagedCount: countLines(git(["diff", "--name-only"])),
  };
}

/**
 * The extra facts the bounded path needs. Read only when the flag is present, so the ordinary
 * deployment does not gain a single new git invocation.
 */
function observeIsolated() {
  const tryGit = (args) => {
    try {
      return git(args);
    } catch {
      return null;
    }
  };
  const names = (a, b) => {
    const out = tryGit(["diff", "--name-only", a, b]);
    return out === null ? null : out === "" ? [] : out.split("\n");
  };
  let ancestor = false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ISOLATED_HOTFIX_APPLICATION_SHA, "HEAD"], { cwd: ROOT });
    ancestor = true;
  } catch {
    ancestor = false;
  }
  // Search the DIFF, not the tree: this asks what this hotfix introduced, not what already existed.
  //
  // Scoped to the APPLICATION diff, with the tooling paths excluded — this very file names the
  // containment tokens in order to search for them, and an unscoped scan would refuse itself.
  const diffText =
    tryGit([
      "diff",
      ISOLATED_HOTFIX_BASE_SHA,
      "HEAD",
      "--",
      ".",
      ...ISOLATED_HOTFIX_TOOLING_PATHS.map((p) => `:(exclude)${p}`),
    ]) ?? "";
  return {
    applicationIsAncestorOfHead: ancestor,
    applicationParentSha: tryGit(["rev-parse", `${ISOLATED_HOTFIX_APPLICATION_SHA}^`]),
    applicationDiffPaths: names(ISOLATED_HOTFIX_BASE_SHA, ISOLATED_HOTFIX_APPLICATION_SHA) ?? [],
    toolingDiffPaths: names(ISOLATED_HOTFIX_APPLICATION_SHA, "HEAD") ?? [],
    containmentHits: CONTAINMENT_TOKENS.filter((t) => diffText.includes(t)),
  };
}

function die(message) {
  console.error(`\n✗ ${message}`);
  console.error("  No deployment was made. Nothing was rolled back and nothing was retried.");
  process.exit(1);
}

async function main() {
  // Read to prove this is bty-app and not the outer repository. Read from the FILE rather than
  // through a subprocess: a subprocess writes a bare name, and parsing that as JSON throws.
  const packageName = readPackageName();

  const mode = resolveMode(process.argv.slice(2));
  const before = observe();
  const shared = {
    ...before,
    workerName: TARGET_WORKER,
    environment: TARGET_ENVIRONMENT,
    packageName,
  };

  const pre =
    mode === "normal" ? checkPreconditions(shared) : checkIsolatedHotfix({ ...shared, ...observeIsolated() });
  if (!pre.ok) die(pre.reason);

  const SOURCE_SHA = before.headSha;
  console.log(`source commit    ${SOURCE_SHA}`);
  console.log(`target worker    ${TARGET_WORKER} (${TARGET_ENVIRONMENT})`);
  if (mode !== "normal") {
    // Stated at every deploy so the two identities are never conflated in a report.
    console.log(`mode             ${ISOLATED_HOTFIX_FLAG}`);
    console.log(`application      ${ISOLATED_HOTFIX_APPLICATION_SHA}`);
    console.log(`base             ${ISOLATED_HOTFIX_BASE_SHA}`);
  }

  // ---- build, with identity in the environment ----------------------------
  console.log("\n· building …");
  try {
    execFileSync("npm", ["run", "cf:build"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, BTY_SOURCE_COMMIT_SHA: SOURCE_SHA, BTY_DEPLOY_VERSION: SOURCE_SHA },
    });
  } catch {
    die("build failed");
  }

  // ---- the measurement that makes the SHA a fact, not a claim -------------
  const after = observe();
  const post = checkPostBuild({
    expectedSha: SOURCE_SHA,
    headSha: after.headSha,
    stagedCount: after.stagedCount,
    unstagedCount: after.unstagedCount,
    artifactExists: existsSync(join(ROOT, BUILD_ARTIFACT)),
  });
  if (!post.ok) die(post.reason);

  // ---- deploy, injecting the same identity into the Worker runtime --------
  console.log("\n· deploying …");
  try {
    execFileSync("npx", ["opennextjs-cloudflare", "deploy", ...buildVarArgs(SOURCE_SHA)], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, BTY_SOURCE_COMMIT_SHA: SOURCE_SHA, BTY_DEPLOY_VERSION: SOURCE_SHA },
    });
  } catch {
    die("deploy failed");
  }

  // ---- prove it on the live endpoint --------------------------------------
  console.log("\n· verifying live identity …");
  const url = `https://${TARGET_WORKER}.ywamer2022.workers.dev/api/version`;
  let live = null;
  for (let attempt = 1; attempt <= 6 && live !== SOURCE_SHA; attempt++) {
    // Polling a propagating deployment is not a retry of the deployment itself.
    if (attempt > 1) await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) live = (await res.json()).version ?? null;
    } catch {
      live = null;
    }
  }

  const identity = checkLiveIdentity(live, SOURCE_SHA);
  if (!identity.ok) {
    console.error(`\n✗ ${identity.reason}`);
    console.error(`  expected ${SOURCE_SHA}`);
    console.error(`  live     ${live ?? "(unreadable)"}`);
    console.error("  The deployment EXISTS but is NOT identity-valid. No rollback and no redeploy were attempted.");
    process.exit(1);
  }

  console.log(`\n✓ staging deployed and identity-verified`);
  console.log(`  source commit  ${SOURCE_SHA}`);
  console.log(`  live version   ${live}`);
}

// Only run when invoked directly, so the pure guards above can be imported by tests.
if (process.argv[1] && process.argv[1].endsWith("deploy-bty-arena-staging-with-source.mjs")) {
  main().catch((e) => die(`unexpected failure: ${e instanceof Error ? e.name : "unknown"}`));
}
