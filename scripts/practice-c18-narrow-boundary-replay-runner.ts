#!/usr/bin/env npx tsx
/**
 * NARROW BOUNDARY-ONLY REPLAY RUNNER BUILDER (Slice 3.2I-R5B1A.1-R2.29).
 *
 * Generates the runner WHOLE from tracked source and binds it to every digest that could change what
 * the boundary reviewer is asked — including the surface map, which is the thing R2.28 proved was
 * missing. PREPARED in R2.29, deliberately not executed.
 *
 *   npx tsx scripts/practice-c18-narrow-boundary-replay-runner.ts --out /tmp/r236_c18_prerequisite_truth_replay_canary.sh
 *   npx tsx scripts/practice-c18-narrow-boundary-replay-runner.ts --binding-json
 */
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildContractManifest, manifestDigest } from "@/lib/bty/foundry/arena/contractManifest";
import { subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import {
  APPLICABILITY_RESULTS,
  COMPLIANCE_RESULTS,
  NARROW_BOUNDARY_JSON_SCHEMA,
  VIOLATION_MECHANISMS,
  GOVERNED_ACTION_STATUSES,
  PREREQUISITE_STATUSES,
  TEMPORAL_RELATIONS,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { parityTableSha256 } from "@/domain/foundry/arena-draft/boundaryReasonParity";
import { explanationAuthoritySha256 } from "@/domain/foundry/arena-draft/boundaryExplanation";
import {
  BOUNDARY_REPORTABLE_OUTCOMES,
  MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
  MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
  NARROW_REPLAY_ARTIFACT_VERSION,
  renderAllowedOutcomes,
} from "@/domain/foundry/arena-draft/boundaryOutcomes";
import { PROVIDER_FAILURE_CODES, transportEvidenceSha256 } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { NARROW_TIMEOUT_OWNER } from "@/lib/bty/foundry/arena/narrowBoundaryReviewer";
import {
  BRANCH_AWARE_REACHABLE_SURFACE_COUNT,
  compatibilitySurfaces,
  enumerateBoundarySurfaces,
  lineageSha256,
  reviewableSurfaces,
  surfaceMapSha256,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import {
  NARROW_BOUNDARY_SAMPLING,
  NARROW_BOUNDARY_SYSTEM_PROMPT,
  buildNarrowBoundaryContract,
  buildNarrowBoundarySubject,
  narrowBoundarySubjectSha256,
} from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { semanticFrameContractSha256 } from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import { buildC18Subject, SOURCE_ARTIFACT, SOURCE_ARTIFACT_SHA256, CASE_ID } from "./practice-c18-boundary-replay";

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
const broad = buildC18Subject(process.cwd(), join(process.cwd(), ".eval-artifacts"));
const digests = subjectDigests(broad.subject);
const provenance = broad.subject.boundaryProvenance!;
const surfaces = enumerateBoundarySurfaces(broad.subject.scenario as ArenaScenarioDraft, {});
const reachable = reviewableSurfaces(surfaces);
const excluded = compatibilitySurfaces(surfaces);
const narrowSubject = buildNarrowBoundarySubject({
  scenarioSha256: broad.subject.scenarioSha256,
  reviewSubjectSha256: digests.reviewSubjectSha256,
  boundaryProvenance: provenance,
  boundaryProvenanceSha256: boundaryProvenanceSha256(provenance),
  boundaries: broad.subject.confirmedBoundaries,
  surfaces,
  draft: broad.subject.scenario as ArenaScenarioDraft,
  language: broad.subject.language,
  generationAttemptId: broad.subject.generationAttemptId,
  caseId: CASE_ID,
});

const runtime = [
  "src/lib/bty/foundry/arena/boundaryReviewStage.ts",
  "src/lib/bty/foundry/arena/narrowBoundaryContract.ts",
  "src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts",
  "src/lib/bty/foundry/arena/replayArtifact.ts",
  "src/lib/bty/foundry/arena/historicalBoundaryReconstruction.ts",
  "src/domain/foundry/arena-draft/narrowBoundaryReview.ts",
  "src/domain/foundry/arena-draft/boundarySurfaces.ts",
  "src/domain/foundry/arena-draft/boundaryProvenance.ts",
  "src/domain/foundry/arena-draft/boundaryContextSegments.ts",
  "src/domain/foundry/arena-draft/boundarySemanticFrame.ts",
  "scripts/practice-c18-narrow-boundary-replay.ts",
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
  boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(narrowSubject),
  boundaryReviewContractSha256: buildNarrowBoundaryContract().sha256,
  boundaryPromptSha256: d(NARROW_BOUNDARY_SYSTEM_PROMPT),
  boundarySchemaSha256: d(NARROW_BOUNDARY_JSON_SCHEMA),
  boundarySamplingSha256: d(NARROW_BOUNDARY_SAMPLING),
  surfaceMapSha256: surfaceMapSha256(surfaces),
  lineageSha256: lineageSha256(surfaces),
  reachableSurfaceCount: reachable.length,
  reachableSurfaceCoordinates: reachable.map((s) => s.coordinate),
  excludedCompatibilitySurfaces: excluded.map((s) => `${s.coordinate}->${s.compatibilitySource}`),
  applicabilityContractSha256: d({ applicability: APPLICABILITY_RESULTS, compliance: COMPLIANCE_RESULTS }),
  violationMechanismContractSha256: d(VIOLATION_MECHANISMS),
  correctionPacketContractSha256: d({ correctionFrom: "causal_violations_only", downstreamIsEvidenceOnly: true, notApplicableNeverCorrects: true }),
  worldStateAuthoritySha256: d({ escalationFallback: false, missingIsAuthorityFailure: true }),
  // R2.32 — the reason parity table, the explanation renderer and the outcome enumeration are all
  // part of what the reviewer is asked and how the answer is read.
  reasonParityTableSha256: parityTableSha256(),
  serverExplanationSha256: explanationAuthoritySha256(),
  outcomeEnumSha256: d([...BOUNDARY_REPORTABLE_OUTCOMES]),
  // R2.34 — what an artifact can PROVE about a failed call is part of the contract.
  transportEvidenceSha256: transportEvidenceSha256(),
  failureClassifierSha256: d([...PROVIDER_FAILURE_CODES]),
  timeoutOwnerSha256: d({ owner: NARROW_TIMEOUT_OWNER, timeoutMs: NARROW_BOUNDARY_SAMPLING.timeoutMs, signalWired: true }),
  callBudgetSha256: d({
    maxProviderInvocations: MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
    maxSemanticResponses: MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
    automaticTransportRetry: false,
  }),
  artifactVersionSha256: d(NARROW_REPLAY_ARTIFACT_VERSION),
  // R2.36 — the CONTEXT the reviewer sees, the DECOMPOSITION of the rule, and what counts as
  // prerequisite truth. A replay run under a different context map is answering a different
  // question, and R2.35 measured exactly what that costs.
  contextSegmentMapSha256: narrowSubject.contextSegmentMapSha256,
  contextSegmentCount: narrowSubject.contextSegments.length,
  openingPresent: narrowSubject.opening.trim().length > 0,
  semanticFramesSha256: narrowSubject.semanticFramesSha256,
  semanticFrameContractSha256: semanticFrameContractSha256(),
  prerequisiteTruthContractSha256: d({
    governedActionStatuses: GOVERNED_ACTION_STATUSES,
    prerequisiteStatuses: PREREQUISITE_STATUSES,
    temporalRelations: TEMPORAL_RELATIONS,
    notEstablishedIsNeverViolation: true,
    satisfiedCannotViolate: true,
    failureMustConcernPrerequisite: true,
  }),
  evidenceLocalityContractSha256: d({
    actionEvidenceSources: ["own_surface"],
    prerequisiteEvidenceSources: ["own_surface", "parent_generated_state"],
    fabricationIsAlwaysFatal: true,
  }),
  activeBoundaryIds: provenance.activeBoundaryIds,
  boundaryText: provenance.confirmedBoundaries.map((b) => b.statement),
  artifactSchemaVersion: NARROW_REPLAY_ARTIFACT_VERSION,
  replayRuntimeSha256: d(runtime),
};

const CHECKS: Array<[string, string]> = [
  ["contract manifest", "manifestSha256"],
  ["source artifact", "sourceArtifactSha256"],
  ["reconstruction sources", "reconstructionSourceSha256"],
  ["reconstructed subject", "reconstructedSubjectSha256"],
  ["boundary provenance", "boundaryProvenanceSha256"],
  ["frozen scenario", "scenarioSha256"],
  ["boundary-review subject", "boundaryReviewSubjectSha256"],
  ["boundary-review contract", "boundaryReviewContractSha256"],
  ["boundary prompt", "boundaryPromptSha256"],
  ["boundary schema", "boundarySchemaSha256"],
  ["boundary sampling", "boundarySamplingSha256"],
  ["surface map", "surfaceMapSha256"],
  ["causal lineage", "lineageSha256"],
  ["reachable surface count", "reachableSurfaceCount"],
  ["reachable surface coordinates", "reachableSurfaceCoordinates"],
  ["excluded compatibility surfaces", "excludedCompatibilitySurfaces"],
  ["applicability contract", "applicabilityContractSha256"],
  ["violation-mechanism contract", "violationMechanismContractSha256"],
  ["correction-packet contract", "correctionPacketContractSha256"],
  ["world-state authority", "worldStateAuthoritySha256"],
  ["reason parity table", "reasonParityTableSha256"],
  ["server explanation authority", "serverExplanationSha256"],
  ["outcome enumeration", "outcomeEnumSha256"],
  ["transport evidence contract", "transportEvidenceSha256"],
  ["provider failure classifier", "failureClassifierSha256"],
  ["timeout owner", "timeoutOwnerSha256"],
  ["provider call budget", "callBudgetSha256"],
  ["artifact version", "artifactVersionSha256"],
  ["context segment map", "contextSegmentMapSha256"],
  ["context segment count", "contextSegmentCount"],
  ["scenario opening present", "openingPresent"],
  ["semantic frames", "semanticFramesSha256"],
  ["semantic frame contract", "semanticFrameContractSha256"],
  ["prerequisite truth contract", "prerequisiteTruthContractSha256"],
  ["evidence locality contract", "evidenceLocalityContractSha256"],
  ["active boundary ids", "activeBoundaryIds"],
  ["boundary text", "boundaryText"],
  ["replay runtime", "replayRuntimeSha256"],
];

const ALLOWED_OUTCOME_LINES = renderAllowedOutcomes()
  .map((line) => `printf '  ${line}\\n'`)
  .join("\n");

const checkLines = CHECKS.map(([label, path]) =>
  `check ${shq(label)} ${shq(path)} ${shq(JSON.stringify((binding as Record<string, unknown>)[path]))}`,
).join("\n");

const script = `#!/usr/bin/env bash
# =============================================================================
# BTY Practice — R2.36 PREREQUISITE-TRUTH REPLAY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.36
#
# ONE reconstructed c18 subject x exactly ONE narrow boundary-review call.
# ZERO generation calls. ZERO broad semantic-review calls. ZERO database calls.
#
# WHAT THE ARC MEASURED
#   R2.28  the broad reviewer wrote "One patient is treated without
#          verification" and returned boundaryCompliant: true. FALSE NEGATIVE.
#   R2.29  the narrow review correctly rejected the scenario, and also produced
#          NINE violations where four describe the problem — five asserted from
#          "Does not address verification of identifiers." FALSE POSITIVES.
#
# WHAT R2.30 CHANGES
#   * ${BRANCH_AWARE_REACHABLE_SURFACE_COUNT} LEARNER-REACHABLE surfaces are reviewed. The flat tradeoff/action
#     fields are compatibility projections — MEASURED unreachable, because
#     ArenaPracticePlayer resolves branches[selectedPrimaryId] for every
#     branch-aware draft. They carry no product authority.
#   * APPLICABILITY is asked BEFORE compliance. Silence about the rule is not a
#     violation.
#   * A violation must prove a MECHANISM: the governed action present AND the
#     prerequisite missing, each with a grounded excerpt.
#   * The correction packet carries EARLIEST CAUSAL findings only.
#
#   R2.30  BOTH live responses completed normally, passed the provider schema and
#          covered every surface — and were discarded because applies-state rows
#          carried reason:"". The prompt had never asked for one there.
#
# WHAT R2.32 CHANGES
#   * ONE canonical parity table drives the prompt, the validator and the tests.
#   * reason is required ONLY where no structured field can carry the meaning:
#     applicability uncertainty, compliance uncertainty, other_grounded_violation.
#   * Everywhere else the SERVER renders the explanation. Model prose there is
#     ignored, never a failure.
#   * boundary_output_contract_failure names a response that satisfied the
#     provider contract and failed the server's state contract.
#
#   R2.32  one authorized live call produced NOTHING usable. The client threw
#          with the HTTP status inside its message and an unbound catch { }
#          discarded it, so the artifact said only "request failed". The
#          provider-side cause was unknowable and a retry would have produced a
#          second silent artifact.
#
# WHAT R2.36 CHANGES
#   * The reviewer is no longer handed one merged blob. Context arrives as
#     LABELLED SEGMENTS (scenario opening, own surface, parent generated state,
#     ancestor primary, branch escalation) and every excerpt must name the
#     segment it came from. The server verifies the source, not just the text.
#   * The scenario OPENING is always sent. R2.35 measured it absent, and
#     primary[1] judged as a bare label in 3 of 3 live runs.
#   * The boundary arrives DECOMPOSED into its prerequisite and its governed
#     action, so "the prerequisite" is a clause both sides point at.
#   * A violation must now state PREREQUISITE TRUTH: the governed action present
#     on this surface's own text, a prerequisite explicitly_missing or
#     contradicted (never merely not_established), an excerpt that genuinely
#     concerns that prerequisite, and an ordering that puts the action first.
#   * A claim that fails a truth gate is REFUTED, not fatal: the surface is
#     demoted to uncertain and recorded, and the surviving violations still
#     reject. Refusing the whole response would send the scenario back for a
#     rerun, and a clean rerun would ship the real violation.
#
# WHAT R2.36 DOES NOT CLAIM
#   The false negative at primary[1] is NOT fixed and remains UNMEASURED. Its
#   own text names no unmet prerequisite, so the contract answers
#   not_established — and silence is deliberately not a violation.
#
# WHAT R2.34 CHANGED
#   * The error is BOUND. Status, provider code, retry-after, response state,
#     failure layer, retriability and a sanitized cause chain are all recorded.
#   * A transport failure is reported as provider_failure, never as
#     boundary_reviewer_terminal_failure. The reviewer never saw the subject.
#   * Provider invocations, provider responses and SEMANTIC attempts are counted
#     separately. A failed call still costs an invocation; it never spends
#     semantic rerun authority.
#   * ONE timeout owner now exists and its signal reaches the client.
#   * NO automatic transport retry. Unknown retriability authorizes nothing.
#
#   Either outcome of this run is informative.
#
#   Active boundary: [${BOUNDARY_ID}] ${BOUNDARY_TEXT}
#
# THIS SUBJECT IS RECONSTRUCTED. It is NOT evidence of what the historical
# reviewer received.
#
# A pass is a REVIEWER measurement. It is never a product-quality pass.
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
EXPECTED_SURFACES=${BRANCH_AWARE_REACHABLE_SURFACE_COUNT}
EXPECTED_EXCLUDED=${excluded.length}
EXPECTED_GENERATION_CALLS=0
EXPECTED_BROAD_REVIEW_CALLS=0
OUT_DIR='.eval-artifacts'

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
CHECK_ONLY=0
[ "\${1:-}" = '--credential-boundary-check' ] && CHECK_ONLY=1

die() { printf '\\n%s\\n' "$*" >&2; exit 1; }
mismatch() { printf '\\nCONTRACT MISMATCH · RUNNER STALE\\n  %s\\n    expected: %s\\n    actual:   %s\\n' "$1" "$2" "$3" >&2; exit 3; }
step() { printf '  [%s] %s\\n' "$1" "$2"; }

printf '\\nR2.34 BOUNDARY TRANSPORT DIAGNOSTIC — PREFLIGHT\\n\\n'

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

BINDING_JSON="$(npx --yes tsx scripts/practice-c18-narrow-boundary-replay-runner.ts --binding-json)" \\
  || die "CONTRACT MISMATCH · RUNNER STALE
  the boundary replay binding could not be regenerated from source"
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
step 5 "all ${CHECKS.length} bound contracts match, including the exact boundary text, all $EXPECTED_SURFACES reachable coordinates and the $EXPECTED_EXCLUDED excluded projections"

# ---- 6. the replay program cannot call generation ---------------------------
for f in src/lib/bty/foundry/arena/boundaryReviewStage.ts \\
         src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts \\
         src/lib/bty/foundry/arena/narrowBoundaryContract.ts \\
         scripts/practice-c18-narrow-boundary-replay.ts; do
  if grep -qE 'generateArenaScenarioDraft|generateWithLlm|buildTemplateScenarioDraft' "$f"; then
    mismatch 'replay scope' 'no generation import' "$f imports generation"
  fi
done
step 6 "zero generation entry points in the boundary replay path"

# ---- 7. the replay program cannot call the BROAD reviewer -------------------
for f in src/lib/bty/foundry/arena/boundaryReviewStage.ts \\
         src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts \\
         scripts/practice-c18-narrow-boundary-replay.ts; do
  if grep -qE 'reviewFrozenSubject|reviewConstraintCompliance|SEMANTIC_REVIEW_JSON_SCHEMA' "$f"; then
    mismatch 'replay scope' 'no broad-review import' "$f imports the broad reviewer"
  fi
done
step 7 "zero broad semantic-review entry points in the boundary replay path"

step 8 "scope: one reconstructed subject, boundary reviewer only"
step 9 "preflight complete"

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

BTY_C18_NARROW_MOCK=1 npx --yes tsx scripts/practice-c18-narrow-boundary-replay.ts \\
  --replay-run-id "mock-$RUN_ID" --artifact-dir "$MOCK_DIR" --mock-outcome 'reject' \\
  || wiring_failed 'the narrow boundary replay program failed on the mock transport'

MOCK_ARTIFACTS="$(find "$MOCK_DIR" -maxdepth 1 -name 'practice-review.boundaryreplay.mock.*.json' | wc -l | tr -d ' ')"
[ "$MOCK_ARTIFACTS" = "$EXPECTED_SUBJECTS" ] \\
  || wiring_failed "expected $EXPECTED_SUBJECTS mock boundary replay artifact, found $MOCK_ARTIFACTS"
printf '\\nBOUNDARY REPLAY MOCK PASS · %s/%s SUBJECT\\n' "$MOCK_ARTIFACTS" "$EXPECTED_SUBJECTS"
printf 'LIVE PROVIDER NOT CALLED\\n'
wiring_cleanup
trap - EXIT INT TERM

printf '\nLOCAL MOCK TRANSPORT MATRIX + CAPTURED REGRESSIONS (no credential, no network)\n'
npx --yes vitest run \\
  src/domain/foundry/arena-draft/boundaryTransportEvidence.test.ts \\
  src/domain/foundry/arena-draft/r232TransportRegression.test.ts \\
  src/lib/bty/foundry/arena/narrowBoundaryTransport.contract.test.ts \\
  src/domain/foundry/arena-draft/r230LiveDtoRegression.test.ts \\
  src/domain/foundry/arena-draft/boundaryReasonParity.test.ts --reporter=dot \\
  || wiring_failed 'the transport matrix or the captured regressions failed'
printf 'TRANSPORT MATRIX PASS · CAPTURED LIVE ATTEMPTS REPRODUCE A SERVER-DERIVED VERDICT\n'
printf 'HISTORICAL R2.32 EVIDENCE CLASSIFIES AS provider_failure_unknown · INSUFFICIENT TO AUTHORIZE A RETRY\n'

if [ "$CHECK_ONLY" = '1' ]; then
  printf '\\nCREDENTIAL NOT REQUESTED\\n\\n'
  exit 0
fi

printf '\\nContract and runtime verified. ONE narrow boundary-review call will be performed.\\n'
printf 'Active boundary: [${BOUNDARY_ID}] ${BOUNDARY_TEXT}\\n'
printf 'Reachable decision surfaces: %s (including both resulting world states)\\n' "$EXPECTED_SURFACES"
printf 'Excluded compatibility projections: %s\\n' "$EXPECTED_EXCLUDED"
printf 'Applicability is judged BEFORE compliance; silence is never a violation.\\n'
printf 'NO scenario will be generated. NO scenario will be rewritten. NO broad review will run.\\n'
printf 'Exactly ONE provider invocation. NO automatic retry on failure.\\n'
printf 'Provider invocation cap: %s · semantic response cap: %s\\n' '${MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT}' '${MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT}'
printf 'Provider API key (input hidden, never written to disk or history): '
read -rs LLM_API_KEY
printf '\\n'
[ -n "$LLM_API_KEY" ] || die 'no credential supplied'
export LLM_API_KEY
unset HISTFILE
cleanup() { unset LLM_API_KEY OPENAI_API_KEY || true; }
trap cleanup EXIT INT TERM

printf '\\nBOUNDARY REPLAY\\n'
set +e
npx --yes tsx scripts/practice-c18-narrow-boundary-replay.ts --replay-run-id "$RUN_ID" --artifact-dir "$OUT_DIR"
REPLAY_STATUS=$?
set -e

printf '\\n============================================================\\n'
printf 'BOUNDARY REVIEWER BEHAVIOUR MEASURED · PRODUCT QUALITY NOT MEASURED\\n'
printf 'replay status: %s\\n' "$REPLAY_STATUS"
printf 'artifacts:     %s\\n' "$OUT_DIR"
printf '============================================================\\n'
printf '\\nALLOWED OUTCOMES (rendered from the ONE canonical enumeration — R2.30 printed a\\n'
printf 'list that did not contain the outcome it actually produced):\\n'
${ALLOWED_OUTCOME_LINES}
printf '\\nThe subject was RECONSTRUCTED. This result says what the boundary reviewer\\n'
printf 'does when the confirmed rule and every decision surface are put in front of\\n'
printf 'it. It is not a product-quality verdict.\\n\\n'
`;

if (process.argv.includes("--binding-json")) {
  process.stdout.write(`${JSON.stringify(binding)}\n`);
} else {
  const out = arg("out");
  writeFileSync(out, script, { mode: 0o700 });
  process.stdout.write(
    `wrote ${out}\n` +
      `  head            ${binding.head}\n` +
      `  manifest        ${binding.manifestSha256}\n` +
      `  broad subject   ${binding.reconstructedSubjectSha256}\n` +
      `  narrow subject  ${binding.boundaryReviewSubjectSha256}\n` +
      `  surface map     ${binding.surfaceMapSha256}\n` +
      `  lineage         ${binding.lineageSha256}\n` +
      `  reachable       ${binding.reachableSurfaceCount}\n` +
      `  excluded        ${binding.excludedCompatibilitySurfaces.length}\n` +
      `  provenance      ${binding.boundaryProvenanceSha256}\n` +
      `  scenario        ${binding.scenarioSha256}\n` +
      `  boundary        ${binding.activeBoundaryIds.join(",")}\n`,
  );
}
