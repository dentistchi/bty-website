/**
 * REVIEWER-REPLAY RUNNER BUILDER (Slice 3.2I-R5B1A.1-R2.25).
 *
 * Generates the runner WHOLE from tracked source — never by editing a previous runner. That rule
 * exists because R2.23D-R1 was produced by in-place regex edits and accumulated four concatenated
 * copies of one expected value, and R2.23D-R3 died on a variable a rename had removed.
 *
 * The runner it emits performs ONE reviewer call per frozen subject and zero generation calls. It is
 * PREPARED in R2.25 and deliberately not executed.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonicalJson } from "@/domain/foundry/arena-draft/reviewSubject";
import { buildReviewSubjectContract } from "./reviewSubjectContract";
import { PRACTICE_SAMPLING, REVIEW_SYSTEM_PROMPT } from "./arenaScenarioGenerationService";
import { SEMANTIC_REVIEW_JSON_SCHEMA } from "@/domain/foundry/arena-draft/semanticReview";

export const REPO = "/Users/hanbit/Dev/btytrainingcenter/bty-app";
export const BRANCH = "inner-main";
export const FIXTURE_PATH = "src/lib/bty/foundry/arena/fixtures/r225-reviewer-contradiction-subjects.json";
export const SOURCE_RUN_ID = "20260801T024949Z";

const d = (v: unknown) => createHash("sha256").update(typeof v === "string" ? v : canonicalJson(v)).digest("hex");

/** One preflight check: a JSON path into the binding payload compared as canonical JSON. */
export type ReplayCheck = { label: string; path: string; expected: string; kind: "digest" | "scalar" };

export type ReplayBinding = {
  head: string;
  manifestSha256: string;
  reviewPromptSha256: string;
  reviewSchemaSha256: string;
  reviewSamplingSha256: string;
  reviewContractSha256: string;
  fixtureSha256: string;
  artifactSchemaVersion: string;
  replayRuntimeSha256: string;
  subjectDigests: string[];
};

/** Build the binding payload from tracked source. Everything is a digest over real content. */
export function buildReplayBinding(head: string, manifestSha256: string, repoRoot = process.cwd()): ReplayBinding {
  const fixtureRaw = readFileSync(`${repoRoot}/${FIXTURE_PATH}`, "utf8");
  const fixture = JSON.parse(fixtureRaw) as { subjects: Array<{ liveScenarioSha256: string }> };
  // The replay runtime is the exact program the runner invokes; a change to it must invalidate the runner.
  const runtime = [
    readFileSync(`${repoRoot}/src/lib/bty/foundry/arena/reviewReplay.ts`, "utf8"),
    readFileSync(`${repoRoot}/src/lib/bty/foundry/arena/reviewFrozenSubject.ts`, "utf8"),
    readFileSync(`${repoRoot}/src/lib/bty/foundry/arena/replayArtifact.ts`, "utf8"),
    readFileSync(`${repoRoot}/scripts/practice-review-replay.ts`, "utf8"),
  ].join("\n");
  return {
    head,
    manifestSha256,
    reviewPromptSha256: d(REVIEW_SYSTEM_PROMPT),
    reviewSchemaSha256: d(SEMANTIC_REVIEW_JSON_SCHEMA),
    reviewSamplingSha256: d(PRACTICE_SAMPLING.review),
    reviewContractSha256: buildReviewSubjectContract().sha256,
    fixtureSha256: d(fixtureRaw),
    artifactSchemaVersion: "practice-review-replay/1",
    replayRuntimeSha256: d(runtime),
    subjectDigests: fixture.subjects.map((s) => s.liveScenarioSha256),
  };
}

export function buildReplayChecks(b: ReplayBinding): ReplayCheck[] {
  const j = (v: unknown) => JSON.stringify(v);
  return [
    { label: "contract manifest", path: "manifestSha256", expected: j(b.manifestSha256), kind: "digest" },
    { label: "review prompt", path: "reviewPromptSha256", expected: j(b.reviewPromptSha256), kind: "digest" },
    { label: "review schema", path: "reviewSchemaSha256", expected: j(b.reviewSchemaSha256), kind: "digest" },
    { label: "review sampling", path: "reviewSamplingSha256", expected: j(b.reviewSamplingSha256), kind: "digest" },
    { label: "review contract", path: "reviewContractSha256", expected: j(b.reviewContractSha256), kind: "digest" },
    { label: "frozen-subject fixture", path: "fixtureSha256", expected: j(b.fixtureSha256), kind: "digest" },
    { label: "replay runtime", path: "replayRuntimeSha256", expected: j(b.replayRuntimeSha256), kind: "digest" },
    { label: "artifact schema", path: "artifactSchemaVersion", expected: j(b.artifactSchemaVersion), kind: "scalar" },
    { label: "frozen subject digests", path: "subjectDigests", expected: j(b.subjectDigests), kind: "digest" },
  ];
}

/** POSIX single-quote escaping. Nothing interpolated is ever re-parsed as shell. */
export const shq = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`;

export function renderReplayRunner(b: ReplayBinding): string {
  const checks = buildReplayChecks(b);
  const checkLines = checks.map((c) => `check ${shq(c.label)} ${shq(c.path)} ${shq(c.expected)}`).join("\n");
  return `#!/usr/bin/env bash
# =============================================================================
# BTY Practice — R2.25 REVIEWER-ONLY REPLAY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.25
#
# 4 FROZEN historical scenarios x exactly 1 reviewer call each = 4 review calls.
# ZERO generation calls. The replay program imports no generation function, so a
# generation call is unreachable rather than merely forbidden.
#
# THE QUESTION
#   Given this frozen scenario and an identical review contract, does a fresh
#   review produce an internally CONSISTENT accept or reject?
#
# It never asks the model to rewrite or improve a scenario.
#
# A consistent accept means the REVIEWER recovered. It is NOT a product-quality
# pass — in the source evidence the reviewer voted accept on a scenario that left
# a patient unverified against a confirmed two-identifier boundary.
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
EXPECT_HEAD=${shq(b.head)}
SOURCE_RUN_ID=${shq(SOURCE_RUN_ID)}
EXPECTED_SUBJECTS=4
EXPECTED_GENERATION_CALLS=0

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR='.eval-artifacts'

CHECK_ONLY=0
[ "\${1:-}" = '--credential-boundary-check' ] && CHECK_ONLY=1

die() { printf '\\n%s\\n' "$*" >&2; exit 1; }
mismatch() { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  %s\\n    expected: %s\\n    actual:   %s\\n' "$1" "$2" "$3" >&2; exit 3; }
step() { printf '  [%s] %s\\n' "$1" "$2"; }

printf '\\nR2.25 REVIEWER-ONLY REPLAY CANARY — PREFLIGHT\\n\\n'

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

BINDING_JSON="$(npx --yes tsx scripts/practice-review-replay-runner.ts --binding-json)" \\
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
step 5 "all ${checks.length} bound contracts match"

# ---- 6. the four source artifacts still exist and still verify ---------------
python3 - ${shq(FIXTURE_PATH)} "$OUT_DIR" <<'PY' || exit 3
import sys, json, hashlib, os
doc = json.load(open(sys.argv[1], encoding="utf-8"))
missing = []
for s in doc["subjects"]:
    p = os.path.join(sys.argv[2], s["sourceArtifactFile"])
    if not os.path.exists(p):
        missing.append(s["sourceArtifactFile"]); continue
    if hashlib.sha256(open(p, "rb").read()).hexdigest() != s["sourceArtifactSha256"]:
        sys.stderr.write("\\nCONTRACT MISMATCH . RUNNER STALE\\n  source artifact digest changed: %s\\n" % s["sourceArtifactFile"])
        sys.exit(3)
if missing:
    sys.stderr.write("\\nSOURCE EVIDENCE MISSING\\n  %s\\n" % ", ".join(missing))
    sys.exit(3)
PY
step 6 "4 source artifacts present and byte-identical"

# ---- 7. the replay program cannot call generation ---------------------------
# Structural, not a promise: these files import no generation function.
for f in src/lib/bty/foundry/arena/reviewReplay.ts \\
         src/lib/bty/foundry/arena/reviewFrozenSubject.ts \\
         scripts/practice-review-replay.ts; do
  if grep -qE 'generateArenaScenarioDraft|generateWithLlm|buildTemplateScenarioDraft' "$f"; then
    mismatch 'replay scope' 'no generation import' "$f imports generation"
  fi
done
step 7 "zero generation entry points in the replay path"

step 8 "scope: reviewer replay only"
step 9 "preflight complete"

printf '\\nPREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED\\n'

# =============================================================================
# RUNTIME WIRING PROOF — before any credential.
# =============================================================================
printf '\\nRUNTIME WIRING PROOF (no credential, no network)\\n'
MOCK_DIR="$(mktemp -d)"
wiring_cleanup() { rm -rf "$MOCK_DIR"; }
trap wiring_cleanup EXIT INT TERM
wiring_failed() {
  printf '\\n%s\\n' "$*" >&2
  printf '\\nRUNTIME WIRING FAILED · LIVE REPLAY BLOCKED\\n' >&2
  exit 7
}

BTY_REVIEW_REPLAY_MOCK=1 npx --yes tsx scripts/practice-review-replay.ts \\
  --replay-run-id "mock-$RUN_ID" --artifact-dir "$MOCK_DIR" \\
  --mock-plan 'accept,reject,contradiction,accept' \\
  || wiring_failed 'the replay program failed on the mock transport'

MOCK_ARTIFACTS="$(find "$MOCK_DIR" -maxdepth 1 -name 'practice-review.reviewreplay.mock.*.json' | wc -l | tr -d ' ')"
[ "$MOCK_ARTIFACTS" = "$EXPECTED_SUBJECTS" ] \\
  || wiring_failed "expected $EXPECTED_SUBJECTS mock replay artifacts, found $MOCK_ARTIFACTS"
printf '\\nREPLAY MOCK PASS · %s/%s SUBJECTS\\n' "$MOCK_ARTIFACTS" "$EXPECTED_SUBJECTS"
printf 'LIVE PROVIDER NOT CALLED\\n'
wiring_cleanup
trap - EXIT INT TERM

if [ "$CHECK_ONLY" = '1' ]; then
  printf '\\nCREDENTIAL NOT REQUESTED\\n\\n'
  exit 0
fi

# =============================================================================
# CREDENTIAL — after the contract AND the runtime are both proven
# =============================================================================
printf '\\nContract and runtime verified. %s reviewer calls will be performed.\\n' "$EXPECTED_SUBJECTS"
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
npx --yes tsx scripts/practice-review-replay.ts --replay-run-id "$RUN_ID" --artifact-dir "$OUT_DIR"
REPLAY_STATUS=$?
set -e

printf '\\n============================================================\\n'
printf 'REVIEWER RECOVERY MEASURED · PRODUCT QUALITY NOT MEASURED\\n'
printf 'replay status: %s\\n' "$REPLAY_STATUS"
printf 'artifacts:     %s\\n' "$OUT_DIR"
printf '============================================================\\n'
printf '\\nA consistent accept means the REVIEWER recovered. Nothing here is a\\n'
printf 'product-quality verdict, and no scenario was generated or rewritten.\\n\\n'
`;
}
