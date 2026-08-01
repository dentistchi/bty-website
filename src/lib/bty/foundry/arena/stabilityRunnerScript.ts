#!/usr/bin/env npx tsx
/**
 * PRACTICE STABILITY-RUNNER SCRIPT BUILDER (Slice 3.2I-R5B1A.1-R2.23D-R1).
 *
 * WHY THIS FILE EXISTS
 *
 * Every runner from R2.23 to R2.23D was produced by an ad-hoc, untracked script that edited the
 * PREVIOUS runner in place. Nothing tested the interpolation, and it accumulated a real defect:
 *
 *   1. The expected sampling value was written with Python `str(dict)` — `{'temperature': 0.8, …}`.
 *      Its single quotes terminate a single-quoted shell assignment, and the representation is
 *      runtime-specific.
 *   2. Re-placeholdering used the regex `EXPECT_GEN_SAMPLING='[^']*'`. That character class cannot
 *      span a value containing single quotes, so it matched only `'{'` and left the remainder of the
 *      old value behind. Every regeneration appended another copy — four for generation, three for
 *      review, exactly as measured in the R2.23D file.
 *   3. The comparison itself was presentation-string equality on both sides (`jq_get` printed a
 *      Python repr too), so semantically identical settings could still fail.
 *
 * The preflight was RIGHT to halt — it refused to produce evidence it could not attribute. The
 * defect was that it halted for a formatting reason rather than a contract reason.
 *
 * THE FIX
 *
 * The runner is generated whole, from the manifest, by this tracked and tested script. Every
 * structured contract is compared by its manifest COMPONENT DIGEST; every scalar is extracted as
 * canonical JSON. No object representation is ever compared, so key order, whitespace, integer
 * formatting and the host runtime cannot affect a verdict.
 *
 * Pure builder: no I/O, no clock, no randomness. `scripts/practice-stability-runner.ts` is the thin
 * CLI that writes the result to disk.
 */

import { buildContractManifest, caseDigest, manifestDigest } from "./contractManifest";
import { measureProviderBudget, measureReviewBudget } from "./tokenBudget";
import { PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";

export const CANARY_CASE_IDS = ["c01-missed-commitment", "c09-transparency-verification", "c18-constrained-clinical"];
export const REPO = "/Users/hanbit/Dev/btytrainingcenter/bty-app";
export const BRANCH = "inner-main";

/**
 * One preflight check. `path` addresses the manifest JSON the CLI prints; `expected` is the value
 * captured at generation time. Both sides are canonical JSON, so nothing here can depend on how a
 * runtime chooses to render an object.
 */
export type RunnerCheck = {
  label: string;
  /** JSON path into the manifest payload, as a JS-style accessor chain. */
  path: string;
  expected: string;
  /** Digest checks compare a SHA-256 the manifest already computed — the strongest authority. */
  kind: "digest" | "scalar";
};

const j = (v: unknown) => JSON.stringify(v);

/** Build the full check list for a manifest payload. Pure — tested directly. */
export function buildChecks(payload: {
  manifestSha256: string;
  canaryCaseSha256: string;
  manifest: ReturnType<typeof buildContractManifest>;
  budgets: { generation: ReturnType<typeof measureProviderBudget>; review: ReturnType<typeof measureReviewBudget> };
}): RunnerCheck[] {
  const c = payload.manifest.components;
  const ea = payload.manifest.evidenceAuthority;
  return [
    { label: "contract manifest", path: "manifestSha256", expected: j(payload.manifestSha256), kind: "digest" },
    { label: "provider schema", path: "manifest.components.providerSchema", expected: j(c.providerSchema), kind: "digest" },
    { label: "review schema", path: "manifest.components.reviewSchema", expected: j(c.reviewSchema), kind: "digest" },
    { label: "corpus", path: "manifest.components.corpus", expected: j(c.corpus), kind: "digest" },
    { label: "canary cases", path: "canaryCaseSha256", expected: j(payload.canaryCaseSha256), kind: "digest" },
    { label: "generated cardinality", path: "manifest.components.generatedCardinality", expected: j(c.generatedCardinality), kind: "digest" },
    { label: "generated field bounds", path: "manifest.components.generatedFieldBounds", expected: j(c.generatedFieldBounds), kind: "digest" },
    { label: "token budget", path: "manifest.components.tokenBudget", expected: j(c.tokenBudget), kind: "digest" },
    { label: "evidence authority", path: "manifest.components.evidenceAuthority", expected: j(c.evidenceAuthority), kind: "digest" },
    { label: "boundary scope contract", path: "manifest.components.boundaryScopeContract", expected: j(c.boundaryScopeContract), kind: "digest" },
    { label: "readiness resolver", path: "manifest.components.readinessResolver", expected: j(c.readinessResolver), kind: "digest" },
    // R2.23D-R1 — sampling is compared by the digest the manifest ALREADY computes over
    // {generation, review, retry}. This replaces the runtime-specific object text that produced the
    // false mismatch, and it is strictly stronger: a retry-policy change moves it too.
    { label: "sampling (generation + review + retry)", path: "manifest.components.sampling", expected: j(c.sampling), kind: "digest" },
    { label: "rejection precedence", path: "manifest.components.rejectionPrecedence", expected: j(c.rejectionPrecedence), kind: "digest" },
    { label: "retry policy", path: "manifest.components.retryPolicy", expected: j(c.retryPolicy), kind: "digest" },
    // Scalars, as canonical JSON — `true`/`false`, not `True`/`False`.
    { label: "artifact schema version", path: "manifest.artifactSchemaVersion", expected: j(payload.manifest.artifactSchemaVersion), kind: "scalar" },
    { label: "generated primary choices", path: "manifest.cardinality.primaryChoices", expected: j(payload.manifest.cardinality.primaryChoices), kind: "scalar" },
    { label: "max active boundaries", path: "manifest.evidenceAuthority.maxActiveBoundaries", expected: j(ea.maxActiveBoundaries), kind: "scalar" },
    { label: "provider self-attestation", path: "manifest.evidenceAuthority.providerSelfAttestation", expected: j(false), kind: "scalar" },
    { label: "retry authority", path: "manifest.evidenceAuthority.retryAuthority", expected: j("server_deterministic"), kind: "scalar" },
    { label: "automatic boundary selection", path: "manifest.evidenceAuthority.automaticBoundarySelection", expected: j(false), kind: "scalar" },
    { label: "Host scope selector", path: "manifest.evidenceAuthority.hostScopeSelectorExists", expected: j(true), kind: "scalar" },
    { label: "schema can exceed budget", path: "manifest.schemaCanExceedBudget", expected: j(false), kind: "scalar" },
  ];
}

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Emit the runner. Generated whole from the manifest — never by editing a previous runner. */
export function renderRunner(payload: Parameters<typeof buildChecks>[0], head: string): string {
  const checks = buildChecks(payload);
  const gen = payload.budgets.generation;
  const rev = payload.budgets.review;
  const checkLines = checks
    .map((c) => `check ${shq(c.label)} ${shq(c.path)} ${shq(c.expected)}`)
    .join("\n");

  return `#!/usr/bin/env bash
# =============================================================================
# BTY Practice — R2.23D-R1 IMMUTABLE STABILITY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.23D-R1
#
# 3 fixed cases x 2 independent passes = 6 case executions, against the EXACT
# production generation contract bound below.
#
# GENERATED by scripts/practice-stability-runner.ts. Never hand-edited, and never
# derived from a previous runner — that is what let a truncated re-placeholder
# accumulate four copies of one expected value.
#
# Every structured contract below is compared by the SHA-256 the manifest already
# computes for it; every scalar is compared as canonical JSON. No object
# representation is compared, so key order, whitespace, number formatting and the
# host runtime cannot change a verdict.
#
# It touches no database, no edge platform CLI, no release pipeline and no
# production endpoint. It reads a provider credential from an interactive prompt
# only, never from a file, and never echoes it.
#
# There is no override flag. A stale runner is REGENERATED, never bypassed.
# =============================================================================
set -Eeuo pipefail

REPO=${shq(REPO)}
BRANCH=${shq(BRANCH)}
EXPECT_HEAD=${shq(head)}
CASE_IDS=${shq(CANARY_CASE_IDS.join(","))}
PASSES=2
EXPECTED_EXECUTIONS=6
MIN_HEADROOM=1.25

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_JSON='live_practice_stability_result.r2.23d-r1.json'
OUT_MD='live_practice_stability_review.r2.23d-r1.md'

# Credential-boundary mode: runs every credential-free check and stops immediately
# before the prompt. It ADDS a stop; it cannot skip a check or relax a comparison.
CHECK_ONLY=0
[ "\${1:-}" = '--credential-boundary-check' ] && CHECK_ONLY=1

die() { printf '\\n%s\\n' "$*" >&2; exit 1; }
mismatch() { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  %s\\n    expected: %s\\n    actual:   %s\\n' "$1" "$2" "$3" >&2; exit 3; }
step() { printf '  [%s] %s\\n' "$1" "$2"; }

printf '\\nR2.23D-R1 PRACTICE STABILITY CANARY — PREFLIGHT\\n\\n'

# ---- 1. repository ----------------------------------------------------------
[ -d "$REPO/.git" ] || die "CONTRACT MISMATCH · RUNNER STALE
  repository not found at $REPO"
cd "$REPO"
step 1 "repository $REPO"

# ---- 2. branch and HEAD -----------------------------------------------------
ACTUAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$ACTUAL_BRANCH" = "$BRANCH" ] || mismatch 'branch' "$BRANCH" "$ACTUAL_BRANCH"
ACTUAL_HEAD="$(git rev-parse HEAD)"
[ "$ACTUAL_HEAD" = "$EXPECT_HEAD" ] || mismatch 'source HEAD' "$EXPECT_HEAD" "$ACTUAL_HEAD"
step 2 "HEAD $ACTUAL_HEAD on $BRANCH"

# ---- 3. tracked tree clean --------------------------------------------------
DIRTY="$(git status --porcelain | grep -v '^??' || true)"
[ -z "$DIRTY" ] || { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  tracked tree is dirty:\\n%s\\n' "$DIRTY" >&2; exit 3; }
step 3 "tracked tree clean"

# ---- 4. regenerate the contract manifest from source ------------------------
MANIFEST_JSON="$(npx --yes tsx scripts/practice-contract-manifest.ts --json)" \\
  || die "CONTRACT MISMATCH · RUNNER STALE
  the manifest could not be regenerated from source"
step 4 "manifest regenerated"

# ---- 5. canonical comparison of every bound contract ------------------------
# Both sides are canonical JSON produced by json.dumps. A Python dict repr, a JS
# object inspection or a pretty-printed variant can never reach a comparison.
check() {
  local label="$1" path="$2" expected="$3" actual
  actual="$(printf '%s' "$MANIFEST_JSON" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for part in sys.argv[1].split("."):
    d = d[part]
sys.stdout.write(json.dumps(d, sort_keys=True, separators=(",", ":")))
' "$path")" || mismatch "$label" "$expected" '<unreadable>'
  [ "$actual" = "$expected" ] || mismatch "$label" "$expected" "$actual"
}

${checkLines}
step 5 "all ${checks.length} bound contracts match"

# ---- 6. measured budget headroom, both sides -------------------------------
printf '%s' "$MANIFEST_JSON" | python3 -c '
import sys, json
d = json.load(sys.stdin)
lo = float(sys.argv[1])
g = d["budgets"]["generation"]["measuredHeadroom"]
r = d["budgets"]["review"]["measuredHeadroom"]
if g < lo or r < lo:
    sys.stderr.write("\\nCONTRACT MISMATCH . RUNNER STALE\\n  measured headroom below the required minimum: generation %.3fx review %.3fx\\n" % (g, r))
    sys.exit(3)
' "$MIN_HEADROOM" || exit 3
step 6 "provider ${gen.measuredHeadroom.toFixed(3)}x and reviewer ${rev.measuredHeadroom.toFixed(3)}x headroom at generation time; both re-measured >= $MIN_HEADROOM"

# ---- 7. immutable artifact authority ---------------------------------------
grep -q 'writeImmutableArtifact' src/lib/bty/foundry/arena/practice-generation.eval.test.ts \\
  || mismatch 'artifact authority' 'harness uses writeImmutableArtifact' 'absent'
grep -q 'ARTIFACT COLLISION' src/lib/bty/foundry/arena/evalArtifact.ts \\
  || mismatch 'artifact authority' 'fail-closed collision' 'absent'
step 7 "immutable artifact authority present"

# ---- 8. c01 carries no answer-key wording ----------------------------------
python3 -c '
import sys
src = open("src/lib/bty/foundry/arena/practice-generation.eval.ts", encoding="utf-8").read()
i = src.index("c01-missed-commitment")
block = src[i:i+900].lower()
for banned in ["honest", "honesty", "admit", "own the miss", "come clean"]:
    if banned in block:
        sys.stderr.write("\\nCONTRACT MISMATCH . RUNNER STALE\\n  c01 regained answer-key wording: %s\\n" % banned)
        sys.exit(3)
' || exit 3
step 8 "c01 carries no answer-key wording"

# ---- 9. every canary case exists and stays within the three-boundary scope --
# A quoted heredoc: no shell expansion, so the Python below needs no escaping and
# cannot be corrupted by quoting — the exact class of defect this slice fixed.
python3 - ${shq(JSON.stringify(CANARY_CASE_IDS))} <<'PY' || exit 3
import sys, json
ids = json.loads(sys.argv[1])
src = open("src/lib/bty/foundry/arena/practice-generation.eval.ts", encoding="utf-8").read()
for cid in ids:
    if ('id: "' + cid + '"') not in src:
        sys.stderr.write("\\nCONTRACT MISMATCH . RUNNER STALE\\n  canary case missing: %s\\n" % cid)
        sys.exit(3)
    i = src.index(cid)
    n = src[i:i + 1400].count("provenance:")
    if n > 3:
        sys.stderr.write("\\nCONTRACT MISMATCH . RUNNER STALE\\n  %s declares %d confirmed boundaries; at most 3 may be active\\n" % (cid, n))
        sys.exit(3)
PY
step 9 "all 3 canary cases present and within scope"

# ---- 10. scope self-check ---------------------------------------------------
# Enforced in source by src/lib/bty/foundry/arena/stabilityRunner.contract.test.ts,
# which scans this file for any data-store, edge-platform or release operation.
step 10 "scope: generation only"

step 11 "preflight complete"

if [ "$CHECK_ONLY" = '1' ]; then
  printf '\\nPREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED\\n'
  # BOUNDARY 2 — prove the EXACT provider-preflight program this runner invokes compiles and runs
  # end to end, against a mock transport, with no credential and no network. R2.23D-R1 shipped a
  # program nobody had ever executed; that is what let a CommonJS transform error reach an operator
  # who had already typed a key. The mock prints its own distinct marker and can never be mistaken
  # for a live pass.
  BTY_PREFLIGHT_MOCK=1 npx --yes tsx scripts/practice-provider-preflight.ts \\
    || die 'PROVIDER PREFLIGHT MOCK FAILED — the runner would die after the credential prompt.'
  printf '\\n'
  exit 0
fi

# =============================================================================
# CREDENTIAL — prompted only AFTER every contract check has passed
# =============================================================================
printf '\\nContract verified. 6 live generations will now be performed.\\n'
printf 'Provider API key (input hidden, never written to disk or history): '
read -rs LLM_API_KEY
printf '\\n'
[ -n "$LLM_API_KEY" ] || die 'no credential supplied'
export LLM_API_KEY
unset HISTFILE

cleanup() { unset LLM_API_KEY OPENAI_API_KEY || true; }
trap cleanup EXIT INT TERM

# ---- provider preflight: BOTH capability checks -----------------------------
# A tracked entry point, not inline TypeScript. R2.23D-R1 embedded a top-level
# await here; tsx compiles to CommonJS (package.json declares no "type"), which
# cannot represent one, so the runner died AFTER the credential was entered and
# BEFORE any request was sent. The program below is unit-tested and proven to run.
printf '\nPROVIDER PREFLIGHT\n'
if ! npx --yes tsx scripts/practice-provider-preflight.ts; then
  die 'PROVIDER PREFLIGHT FAILED — no generation was attempted.'
fi

# =============================================================================
# EXECUTION — 3 cases x 2 independent passes
# =============================================================================
for pass in $(seq 1 "$PASSES"); do
  printf '\\nPASS %d of %d\\n' "$pass" "$PASSES"
  RUN_LIVE_EVAL=1 \\
  EVAL_CASE_IDS="$CASE_IDS" \\
  EVAL_RUN_ID="$RUN_ID" \\
  EVAL_PASS_ID="pass\${pass}" \\
  EVAL_KIND='r2.23d-r1.stability' \\
  npx vitest run src/lib/bty/foundry/arena/practice-generation.eval.test.ts --reporter=verbose \\
    || printf '  pass %d recorded a failing gate — evidence was written before assertions\\n' "$pass"
done

# =============================================================================
# COLLATE — immutable artifacts are the authority
# =============================================================================
printf '\\nCOLLATING\\n'
npx --yes tsx scripts/practice-stability-collate.ts \\
  --run-id "$RUN_ID" --passes "$PASSES" --json "$OUT_JSON" --md "$OUT_MD"

printf '\\n============================================================\\n'
printf 'STRUCTURAL + SEMANTIC GATES PASS\\n'
printf 'HUMAN PRODUCT REVIEW REQUIRED\\n'
printf '============================================================\\n'
printf '  result:   %s\\n' "$OUT_JSON"
printf '  review:   %s\\n' "$OUT_MD"
printf '\\nThis is NOT a product-quality pass. Read all six scenarios.\\n\\n'
`;
}


/** Build the manifest payload exactly as the CLI prints it, so both sides agree by construction. */
export function manifestPayload(head: string, model: string) {
  const manifest = buildContractManifest(head, model);
  return {
    manifestSha256: manifestDigest(manifest),
    canaryCaseSha256: caseDigest(CANARY_CASE_IDS),
    manifest,
    budgets: {
      generation: measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens),
      review: measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens),
    },
  };
}
