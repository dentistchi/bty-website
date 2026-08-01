#!/usr/bin/env npx tsx
/**
 * CORRECTED-BOUNDARY REPLAY RUNNER BUILDER (Slice 3.2I-R5B1A.1-R2.27).
 *
 * Generates the runner WHOLE from tracked source, and binds it to every digest that could change
 * what the reviewer is asked. PREPARED in R2.27, deliberately not executed.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildContractManifest, manifestDigest } from "@/lib/bty/foundry/arena/contractManifest";
import { buildReviewSubjectContract } from "@/lib/bty/foundry/arena/reviewSubjectContract";
import { subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { PRACTICE_SAMPLING, REVIEW_SYSTEM_PROMPT } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";
import { SEMANTIC_REVIEW_JSON_SCHEMA } from "@/domain/foundry/arena-draft/semanticReview";
import { buildC18Subject, SOURCE_ARTIFACT, SOURCE_ARTIFACT_SHA256 } from "./practice-c18-boundary-replay";

const REPO = "/Users/hanbit/Dev/btytrainingcenter/bty-app";
const BRANCH = "inner-main";
const BOUNDARY_ID = "c1_verify";
const BOUNDARY_TEXT = "Two identifiers must be verified before treatment";

const d = (v: unknown) => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const shq = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = manifestDigest(buildContractManifest(head, process.env.LLM_MODEL ?? "gpt-4o-mini"));
const subject = buildC18Subject(process.cwd(), join(process.cwd(), ".eval-artifacts"));
const digests = subjectDigests(subject.subject);
const provenance = subject.subject.boundaryProvenance!;
const runtime = [
  "src/lib/bty/foundry/arena/reviewReplay.ts",
  "src/lib/bty/foundry/arena/reviewFrozenSubject.ts",
  "src/lib/bty/foundry/arena/replayArtifact.ts",
  "src/lib/bty/foundry/arena/historicalBoundaryReconstruction.ts",
  "src/domain/foundry/arena-draft/boundaryProvenance.ts",
  "scripts/practice-c18-boundary-replay.ts",
].map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");

const binding = {
  head,
  manifestSha256: manifest,
  sourceArtifact: SOURCE_ARTIFACT,
  sourceArtifactSha256: SOURCE_ARTIFACT_SHA256,
  reconstructionSourceSha256: provenance.reconstructionSources.map((s) => s.sha256),
  reconstructedSubjectSha256: digests.reviewSubjectSha256,
  boundaryProvenanceSha256: boundaryProvenanceSha256(provenance),
  scenarioSha256: digests.scenarioSha256,
  reviewContractSha256: buildReviewSubjectContract().sha256,
  reviewPromptSha256: d(REVIEW_SYSTEM_PROMPT),
  reviewSchemaSha256: d(SEMANTIC_REVIEW_JSON_SCHEMA),
  reviewSamplingSha256: d(PRACTICE_SAMPLING.review),
  activeBoundaryIds: provenance.activeBoundaryIds,
  boundaryText: provenance.confirmedBoundaries.map((b) => b.statement),
  artifactSchemaVersion: "practice-review-replay/1",
  replayRuntimeSha256: d(runtime),
};

const CHECKS: Array<[string, string]> = [
  ["contract manifest", "manifestSha256"],
  ["source artifact", "sourceArtifactSha256"],
  ["reconstruction sources", "reconstructionSourceSha256"],
  ["reconstructed subject", "reconstructedSubjectSha256"],
  ["boundary provenance", "boundaryProvenanceSha256"],
  ["frozen scenario", "scenarioSha256"],
  ["review contract", "reviewContractSha256"],
  ["review prompt", "reviewPromptSha256"],
  ["review schema", "reviewSchemaSha256"],
  ["review sampling", "reviewSamplingSha256"],
  ["active boundary ids", "activeBoundaryIds"],
  ["boundary text", "boundaryText"],
  ["replay runtime", "replayRuntimeSha256"],
];

const checkLines = CHECKS.map(([label, path]) =>
  `check ${shq(label)} ${shq(path)} ${shq(JSON.stringify((binding as Record<string, unknown>)[path]))}`,
).join("\n");

const script = `#!/usr/bin/env bash
# =============================================================================
# BTY Practice — R2.27 CORRECTED-BOUNDARY REVIEWER REPLAY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.27
#
# ONE reconstructed c18 subject x exactly ONE reviewer call. ZERO generation
# calls — the replay program imports no generation function.
#
# THE QUESTION R2.26 PROVED WAS NEVER ASKED
#   The R2.25 c18 replay was handed confirmedBoundaries: [] and the reviewer
#   answered boundaryIdsConsidered: []. Every boundary derivation was inert, so
#   its accept said nothing about boundary compliance. This run puts the rule in
#   front of it:
#
#     [${BOUNDARY_ID}] ${BOUNDARY_TEXT}
#
# THIS SUBJECT IS RECONSTRUCTED. It is NOT evidence of what the historical
# reviewer received. It is rebuilt from two independent agreeing sources so the
# question can finally be asked.
#
# A consistent accept means the REVIEWER accepted with the rule present. It is
# never a product-quality pass.
#
# No database, no edge platform CLI, no release pipeline, no production endpoint.
# The credential is read from an interactive prompt only, never echoed.
# There is no override flag. A stale runner is REGENERATED, never bypassed.
# =============================================================================
set -Eeuo pipefail

REPO=${shq(REPO)}
BRANCH=${shq(BRANCH)}
EXPECT_HEAD=${shq(head)}
EXPECTED_SUBJECTS=1
EXPECTED_GENERATION_CALLS=0
OUT_DIR='.eval-artifacts'

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
CHECK_ONLY=0
[ "\${1:-}" = '--credential-boundary-check' ] && CHECK_ONLY=1

die() { printf '\\n%s\\n' "$*" >&2; exit 1; }
mismatch() { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  %s\\n    expected: %s\\n    actual:   %s\\n' "$1" "$2" "$3" >&2; exit 3; }
step() { printf '  [%s] %s\\n' "$1" "$2"; }

printf '\\nR2.27 CORRECTED-BOUNDARY REVIEWER REPLAY — PREFLIGHT\\n\\n'

[ -d "$REPO/.git" ] || die "CONTRACT MISMATCH · RUNNER STALE
  repository not found at $REPO"
cd "$REPO"
step 1 "repository $REPO"

ACTUAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$ACTUAL_BRANCH" = "$BRANCH" ] || mismatch 'branch' "$BRANCH" "$ACTUAL_BRANCH"
ACTUAL_HEAD="$(git rev-parse HEAD)"
[ "$ACTUAL_HEAD" = "$EXPECT_HEAD" ] || mismatch 'source HEAD' "$EXPECT_HEAD" "$ACTUAL_HEAD"
step 2 "HEAD $ACTUAL_HEAD on $BRANCH"

DIRTY="$(git status --porcelain | grep -v '^??' || true)"
[ -z "$DIRTY" ] || { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  tracked tree is dirty:\\n%s\\n' "$DIRTY" >&2; exit 3; }
step 3 "tracked tree clean"

BINDING_JSON="$(npx --yes tsx scripts/practice-c18-boundary-replay-runner.ts --binding-json)" \\
  || die "CONTRACT MISMATCH · RUNNER STALE
  the replay binding could not be regenerated from source"
step 4 "binding regenerated from tracked source"

check() {
  local label="$1" path="$2" expected="$3" actual
  actual="$(printf '%s' "$BINDING_JSON" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for part in sys.argv[1].split("."):
    d = d[part]
sys.stdout.write(json.dumps(d, sort_keys=True, separators=(",", ":")))
' "$path")" || mismatch "$label" "$expected" '<unreadable>'
  [ "$actual" = "$expected" ] || mismatch "$label" "$expected" "$actual"
}

${checkLines}
step 5 "all ${CHECKS.length} bound contracts match, including the exact boundary text"

# ---- 6. the replay program cannot call generation ---------------------------
for f in src/lib/bty/foundry/arena/reviewReplay.ts \\
         src/lib/bty/foundry/arena/reviewFrozenSubject.ts \\
         scripts/practice-c18-boundary-replay.ts; do
  if grep -qE 'generateArenaScenarioDraft|generateWithLlm|buildTemplateScenarioDraft' "$f"; then
    mismatch 'replay scope' 'no generation import' "$f imports generation"
  fi
done
step 6 "zero generation entry points in the replay path"

step 7 "scope: one reconstructed subject, reviewer only"
step 8 "preflight complete"

printf '\\nPREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED\\n'

printf '\\nRUNTIME WIRING PROOF (no credential, no network)\\n'
MOCK_DIR="$(mktemp -d)"
wiring_cleanup() { rm -rf "$MOCK_DIR"; }
trap wiring_cleanup EXIT INT TERM
wiring_failed() {
  printf '\\n%s\\n' "$*" >&2
  printf '\\nRUNTIME WIRING FAILED · LIVE REPLAY BLOCKED\\n' >&2
  exit 7
}

BTY_C18_REPLAY_MOCK=1 npx --yes tsx scripts/practice-c18-boundary-replay.ts \\
  --replay-run-id "mock-$RUN_ID" --artifact-dir "$MOCK_DIR" --mock-outcome 'reject' \\
  || wiring_failed 'the corrected-boundary replay program failed on the mock transport'

MOCK_ARTIFACTS="$(find "$MOCK_DIR" -maxdepth 1 -name 'practice-review.reviewreplay.mock.*.json' | wc -l | tr -d ' ')"
[ "$MOCK_ARTIFACTS" = "$EXPECTED_SUBJECTS" ] \\
  || wiring_failed "expected $EXPECTED_SUBJECTS mock replay artifact, found $MOCK_ARTIFACTS"
printf '\\nREPLAY MOCK PASS · %s/%s SUBJECT\\n' "$MOCK_ARTIFACTS" "$EXPECTED_SUBJECTS"
printf 'LIVE PROVIDER NOT CALLED\\n'
wiring_cleanup
trap - EXIT INT TERM

if [ "$CHECK_ONLY" = '1' ]; then
  printf '\\nCREDENTIAL NOT REQUESTED\\n\\n'
  exit 0
fi

printf '\\nContract and runtime verified. ONE reviewer call will be performed.\\n'
printf 'Active boundary: [${BOUNDARY_ID}] ${BOUNDARY_TEXT}\\n'
printf 'NO scenario will be generated. NO scenario will be rewritten.\\n'
printf 'Provider API key (input hidden, never written to disk or history): '
read -rs LLM_API_KEY
printf '\\n'
[ -n "$LLM_API_KEY" ] || die 'no credential supplied'
export LLM_API_KEY
unset HISTFILE
cleanup() { unset LLM_API_KEY OPENAI_API_KEY || true; }
trap cleanup EXIT INT TERM

printf '\\nREPLAY\\n'
set +e
npx --yes tsx scripts/practice-c18-boundary-replay.ts --replay-run-id "$RUN_ID" --artifact-dir "$OUT_DIR"
REPLAY_STATUS=$?
set -e

printf '\\n============================================================\\n'
printf 'REVIEWER BOUNDARY BEHAVIOUR MEASURED · PRODUCT QUALITY NOT MEASURED\\n'
printf 'replay status: %s\\n' "$REPLAY_STATUS"
printf 'artifacts:     %s\\n' "$OUT_DIR"
printf '============================================================\\n'
printf '\\nThe subject was RECONSTRUCTED. This result says what the reviewer does\\n'
printf 'when the confirmed boundary is present. It says nothing about what the\\n'
printf 'historical reviewer received, and it is not a product-quality verdict.\\n\\n'
`;

if (process.argv.includes("--binding-json")) {
  process.stdout.write(`${JSON.stringify(binding)}\n`);
} else {
  const out = arg("out");
  writeFileSync(out, script, { mode: 0o700 });
  process.stdout.write(
    `wrote ${out}\n  head        ${binding.head}\n  manifest    ${binding.manifestSha256}\n  subject     ${binding.reconstructedSubjectSha256}\n  provenance  ${binding.boundaryProvenanceSha256}\n  scenario    ${binding.scenarioSha256}\n  boundary    ${binding.activeBoundaryIds.join(",")}\n`,
  );
}
