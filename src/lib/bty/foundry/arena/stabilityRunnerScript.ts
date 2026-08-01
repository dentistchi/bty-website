#!/usr/bin/env npx tsx
/**
 * PRACTICE STABILITY-RUNNER SCRIPT BUILDER (Slice 3.2I-R5B1A.1-R2.23D-R3).
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
    // R2.23D-R3 — sampling is compared by the digest the manifest ALREADY computes over
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
# BTY Practice — R2.23D-R4 IMMUTABLE STABILITY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.23D-R4
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
# R2.23D-R4 — the post-credential shell no longer reconstructs the contract. R3
# cleared all 22 checks and both provider checks, then died at the EXECUTION
# block on "EXPECT_MANIFEST: unbound variable": R1 had replaced the EXPECT_*
# variables with check lines, and R3 wrote the orchestrator call against the
# older naming. The --credential-boundary-check mode exited before that line, so no
# check ever executed it. Every value now travels in ONE validated JSON config,
# written and parsed BEFORE the credential is requested, and the whole runtime
# is executed end to end against a mock first. A wiring defect can no longer be
# discovered after an operator has typed a key.
#
# There is no override flag. A stale runner is REGENERATED, never bypassed.
# =============================================================================
set -Eeuo pipefail

REPO=${shq(REPO)}
BRANCH=${shq(BRANCH)}
EXPECT_HEAD=${shq(head)}
EXPECTED_EXECUTIONS=6
MIN_HEADROOM=1.25

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_JSON='live_practice_stability_result.r2.23d-r4.json'
OUT_MD='live_practice_stability_review.r2.23d-r4.md'

# Credential-boundary mode: runs every credential-free check and stops immediately
# before the prompt. It ADDS a stop; it cannot skip a check or relax a comparison.
CHECK_ONLY=0
[ "\${1:-}" = '--credential-boundary-check' ] && CHECK_ONLY=1

die() { printf '\\n%s\\n' "$*" >&2; exit 1; }
mismatch() { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  %s\\n    expected: %s\\n    actual:   %s\\n' "$1" "$2" "$3" >&2; exit 3; }
step() { printf '  [%s] %s\\n' "$1" "$2"; }

printf '\\nR2.23D-R4 PRACTICE STABILITY CANARY — PREFLIGHT\\n\\n'

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
# R2.23D-R3 — evidence is now PER CASE, written by the orchestrator the moment a
# case terminates. R2.23D-R2 wrote one artifact after the whole loop, so a
# mid-loop kill left nothing at all.
grep -q 'writeCaseArtifact' scripts/practice-live-stability.ts \\
  || mismatch 'artifact authority' 'orchestrator writes per-case artifacts' 'absent'
grep -q 'ARTIFACT COLLISION' src/lib/bty/foundry/arena/caseArtifact.ts \\
  || mismatch 'artifact authority' 'fail-closed collision' 'absent'
grep -q 'renameSync' src/lib/bty/foundry/arena/caseArtifact.ts \\
  || mismatch 'artifact authority' 'atomic rename' 'absent'
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

printf '\\nPREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED\\n'

# =============================================================================
# RUNTIME WIRING PROOF — everything below runs BEFORE the credential prompt.
#
# R2.23D-R3 proved the CONTRACT and then died on its own EXECUTION wiring, after
# a key had been entered. So the runtime is now proven the same way the contract
# is: by executing it. The exact orchestrator, the exact collator and the exact
# config parser that the live run will use are run end to end against a mock
# transport — no network, no credential, six real immutable artifacts written and
# collated. A mock artifact carries "mock" in its filename AND in its payload, so
# it can never be read as product evidence.
# =============================================================================
printf '\\nRUNTIME WIRING PROOF (no credential, no network)\\n'

MOCK_DIR="$(mktemp -d)"
MOCK_CONFIG="$MOCK_DIR/runtime-config.mock.json"
LIVE_CONFIG="$MOCK_DIR/runtime-config.live.json"
wiring_cleanup() { rm -rf "$MOCK_DIR"; }
trap wiring_cleanup EXIT INT TERM

wiring_failed() {
  printf '\\n%s\\n' "$*" >&2
  printf '\\nRUNTIME WIRING FAILED · LIVE RUN BLOCKED\\n' >&2
  exit 7
}

# ---- W1. both runtime configs, written and validated by the tracked parser --
# The LIVE config is built here too. It carries no credential, and building it
# now is the whole point: the post-credential shell passes one --config path and
# reconstructs nothing.
MOCK_CONFIG_SHA="$(npx --yes tsx scripts/practice-runtime-config.ts \\
  --mode mock --run-id "mock-$RUN_ID" --head "$EXPECT_HEAD" \\
  --out "$MOCK_CONFIG" --artifact-dir "$MOCK_DIR")" \\
  || wiring_failed 'the mock runtime config could not be built or did not validate'
LIVE_CONFIG_SHA="$(npx --yes tsx scripts/practice-runtime-config.ts \\
  --mode live --run-id "$RUN_ID" --head "$EXPECT_HEAD" \\
  --out "$LIVE_CONFIG")" \\
  || wiring_failed 'the live runtime config could not be built or did not validate'
step W1 "runtime configs validated · mock $MOCK_CONFIG_SHA · live $LIVE_CONFIG_SHA"

# ---- W2. the exact provider-preflight program, against a mock transport -----
BTY_PREFLIGHT_MOCK=1 npx --yes tsx scripts/practice-provider-preflight.ts \\
  || wiring_failed 'the provider preflight program failed before any credential was requested'

# ---- W3. the exact orchestrator, all 6 cases, real immutable artifacts ------
set +e
BTY_LIVE_EVAL_MOCK=1 npx --yes tsx scripts/practice-live-stability.ts --config "$MOCK_CONFIG"
MOCK_STATUS=$?
set -e
[ "$MOCK_STATUS" = '0' ] \\
  || wiring_failed "the orchestrator exited with status $MOCK_STATUS on the mock transport"

# Count what EXISTS on disk. The orchestrator's own report is not the authority here.
MOCK_ARTIFACTS="$(find "$MOCK_DIR" -maxdepth 1 -name 'practice-generation.stability.mock.*.json' | wc -l | tr -d ' ')"
[ "$MOCK_ARTIFACTS" = "$EXPECTED_EXECUTIONS" ] \\
  || wiring_failed "expected $EXPECTED_EXECUTIONS mock case artifacts, found $MOCK_ARTIFACTS"
printf '\\nFULL STABILITY MOCK PASS · %s/%s CASES\\n' "$MOCK_ARTIFACTS" "$EXPECTED_EXECUTIONS"

# ---- W4. the exact collator, over those artifacts ---------------------------
npx --yes tsx scripts/practice-stability-collate.ts --config "$MOCK_CONFIG" \\
  --json "$MOCK_DIR/mock-result.json" --md "$MOCK_DIR/mock-review.md" \\
  || wiring_failed 'the collator could not collate the mock case artifacts'

printf 'LIVE PROVIDER NOT CALLED\\n'
printf 'MOCK EVIDENCE DISCARDED · LIVE PRODUCT QUALITY NOT MEASURED\\n'

if [ "$CHECK_ONLY" = '1' ]; then
  # Move the live config somewhere the wiring cleanup will not delete, so the
  # operator can inspect exactly what a live run would consume.
  cp "$LIVE_CONFIG" "./runtime-config.live.$RUN_ID.json"
  printf '\\nCREDENTIAL NOT REQUESTED\\n'
  printf '  live runtime config: ./runtime-config.live.%s.json · sha256 %s\\n\\n' "$RUN_ID" "$LIVE_CONFIG_SHA"
  exit 0
fi

# Keep the live config; drop every mock artifact so it can never be collated later.
KEEP_CONFIG="./runtime-config.live.$RUN_ID.json"
cp "$LIVE_CONFIG" "$KEEP_CONFIG"
wiring_cleanup
LIVE_CONFIG="$KEEP_CONFIG"

# =============================================================================
# CREDENTIAL — prompted only AFTER the contract AND the runtime are both proven
# =============================================================================
printf '\\nContract and runtime verified. 6 live generations will now be performed.\\n'
printf 'Provider API key (input hidden, never written to disk or history): '
read -rs LLM_API_KEY
printf '\\n'
[ -n "$LLM_API_KEY" ] || die 'no credential supplied'
export LLM_API_KEY
unset HISTFILE

cleanup() { unset LLM_API_KEY OPENAI_API_KEY || true; }
trap cleanup EXIT INT TERM

# ---- provider preflight: BOTH capability checks -----------------------------
# The same tracked entry point W2 just executed, now with a real credential.
printf '\\nPROVIDER PREFLIGHT\\n'
if ! npx --yes tsx scripts/practice-provider-preflight.ts; then
  die 'PROVIDER PREFLIGHT FAILED — no generation was attempted.'
fi

# =============================================================================
# EXECUTION — 3 cases x 2 independent passes, via the TRACKED orchestrator
#
# One argument. Every run parameter comes from the config validated in W1, by
# the same parser, so a name cannot drift between the shell and the orchestrator.
# =============================================================================
printf '\\nEXECUTION\\n'
set +e
npx --yes tsx scripts/practice-live-stability.ts --config "$LIVE_CONFIG"
EVAL_STATUS=$?
set -e
case "$EVAL_STATUS" in
  0) printf '  every scheduled case completed\\n' ;;
  4) printf '  INFRASTRUCTURE FAILURE — remaining cases were aborted; evidence for completed cases is preserved\\n' ;;
  5) printf '  ARTIFACT WRITE FAILURE — no evidence was preserved for the failing case\\n' ;;
  *) printf '  evaluation exited with status %s\\n' "$EVAL_STATUS" ;;
esac

printf '\\nCOLLATING\\n'
# The SIX case artifacts are the authority, and only the LIVE ones: the collator
# filters by the config's mode, so a mock artifact cannot enter live evidence.
#
# R2.24 — the collator is also the ONLY authority on the verdict. This script used
# to print its own pass line gated on EVAL_STATUS, but EXIT_CODES.contentFailure is
# deliberately 0 so a quality rejection keeps the remaining cases running. A run
# that generated 1 valid scenario out of 6 therefore printed GATES PASS. The shell
# no longer forms an opinion; it echoes the packet the collator wrote.
set +e
npx --yes tsx scripts/practice-stability-collate.ts --config "$LIVE_CONFIG" \\
  --json "$OUT_JSON" --md "$OUT_MD"
COLLATE_STATUS=$?
set -e

printf '\\n============================================================\\n'
# Lines 1..3 of the review packet carry the verdict the collator computed from the
# artifacts. Reproducing them here cannot disagree with the packet.
sed -n '3,5p' "$OUT_MD" 2>/dev/null || printf 'VERDICT UNAVAILABLE — the collator wrote no review packet\\n'
printf '============================================================\\n'
printf '  result:   %s\\n' "$OUT_JSON"
printf '  review:   %s\\n' "$OUT_MD"
printf '  config:   %s\\n' "$LIVE_CONFIG"
printf '  collator exit: %s (0 = hard gates passed, 6 = hard gates failed or run incomplete)\\n' "$COLLATE_STATUS"
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
