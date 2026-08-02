#!/usr/bin/env npx tsx
/**
 * CAUSAL-ATTRIBUTION REPLAY RUNNER BUILDER (Slice 3.2I-R5B1A.1-R2.46 Part 11).
 *
 * Generates the runner WHOLE from tracked source and binds it to every digest that could change what
 * the boundary reviewer is asked or how its answer is projected — now including the R2.44 polarity
 * authority and the R2.46 causal-attribution, direct-row-immutability and packet-dedup contracts.
 * PREPARED in R2.46, deliberately NOT EXECUTED.
 *
 *   npx tsx scripts/practice-c18-causal-attribution-replay-runner.ts --out /tmp/r246_c18_causal_attribution_replay_canary.sh
 *   npx tsx scripts/practice-c18-causal-attribution-replay-runner.ts --binding-json
 */
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildContractManifest, manifestDigest } from "@/lib/bty/foundry/arena/contractManifest";
import { subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  GOVERNED_ACTION_STATUSES,
  PREREQUISITE_STATUSES,
  TEMPORAL_RELATIONS,
  REMOVED_MODEL_AUTHORED_FIELDS,
  SUBSET_REPAIR_CODES,
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
import { candidateContractSha256, evidenceCandidateMapSha256 } from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import { candidateRoleContractSha256 } from "@/domain/foundry/arena-draft/boundaryCandidateRole";
import { EVIDENCE_POLARITY, POLARITY_REFUSAL_CODES, evidencePolarityContractSha256 } from "@/domain/foundry/arena-draft/boundaryEvidencePolarity";
import {
  ATTRIBUTION_AUTHORITY,
  ATTRIBUTION_REFUSAL_CODES,
  causalAttributionContractSha256,
} from "@/domain/foundry/arena-draft/generatedResultAttribution";
import { DERIVED_APPLICABILITY, DERIVED_COMPLIANCE, truthStateTableSha256 } from "@/domain/foundry/arena-draft/boundaryTruthStates";
import { promptFieldDriftCount } from "@/lib/bty/foundry/arena/boundaryReviewStage";
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
  "src/domain/foundry/arena-draft/boundaryEvidenceCandidates.ts",
  "src/domain/foundry/arena-draft/boundaryTruthStates.ts",
  "src/domain/foundry/arena-draft/boundaryTruthContractTypes.ts",
  "src/domain/foundry/arena-draft/promptFieldParity.ts",
  "src/domain/foundry/arena-draft/boundaryCandidateRole.ts",
  "src/domain/foundry/arena-draft/boundaryEvidencePolarity.ts",
  "src/domain/foundry/arena-draft/generatedResultAttribution.ts",
  "src/domain/foundry/arena-draft/correctionPacket.ts",
  "src/domain/foundry/arena-draft/gatePrecedence.ts",
  "src/lib/bty/foundry/arena/narrowBoundaryReviewer.ts",
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
  // R2.38 — applicability, compliance and the mechanism are DERIVED. The contract records the
  // derivation vocabulary; the model has no field for any of them.
  applicabilityContractSha256: d({ applicability: DERIVED_APPLICABILITY, compliance: DERIVED_COMPLIANCE, modelAuthored: false }),
  violationMechanismContractSha256: d({ derivedFrom: ["ruleKind", "surfaceKind", "lineagePosition", "truthState"], modelAuthored: false }),
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
  // R2.38 — the MENU the reviewer is offered and the TABLE its answers are read under.
  evidenceCandidateMapSha256: evidenceCandidateMapSha256(narrowSubject.evidenceCandidates),
  evidenceCandidateCount: narrowSubject.evidenceCandidates.length,
  evidenceCandidateContractSha256: candidateContractSha256(),
  candidateAliasRemovedCount: narrowSubject.candidateAliasRemovedCount,
  candidateProvenanceRetainedCount: narrowSubject.candidateProvenanceRetainedCount,
  truthStateTableSha256: truthStateTableSha256(),
  removedModelAuthoredFieldsSha256: d(REMOVED_MODEL_AUTHORED_FIELDS),
  subsetRepairContractSha256: d({
    codes: SUBSET_REPAIR_CODES,
    repairableFailureClass: "output_contract",
    preservedRowsImmutable: true,
    maxRepairInvocations: 1,
  }),
  promptSchemaFieldDriftCount: promptFieldDriftCount(),
  // R2.40 — the role classifier and the pool-aware requirement rules.
  candidateRoleContractSha256: candidateRoleContractSha256(),
  governedActionRoleRefusedCount: narrowSubject.candidateRoleMetrics.governedActionPrerequisiteOperationRefusedCount,
  governedActionRoleUncertainCount: narrowSubject.candidateRoleMetrics.governedActionRoleUncertainCount,
  // R2.42 — the instruction the reviewer is actually given, and the projection authority.
  promptParityContractSha256: d({
    decisionTableKeyedOnPoolCardinality: true,
    sentinelOnlyWhenPoolEmpty: true,
    absentWithNonEmptyPoolSelects: true,
    contradictoryAbsentImpliesNoneRemoved: true,
  }),
  repairSubsetProjectionSha256: d({
    projectsFrozenSubject: true,
    canonicalOrderPreserved: true,
    unknownRefThrows: true,
    duplicateRefThrows: true,
    subjectDigestUnchanged: true,
    separateRepairSubsetDigest: true,
  }),
  // R2.44 — a prerequisite span must point the right way, not merely mention the prerequisite.
  evidencePolarityContractSha256: evidencePolarityContractSha256(),
  prerequisitePoolPolaritySha256: d({
    polarities: EVIDENCE_POLARITY,
    refusalCodes: POLARITY_REFUSAL_CODES,
    satisfactionOnlyRefusedFromFailure: true,
    failureOnlyRefusedFromSatisfaction: true,
    mixedKeepsFailureLosesSatisfaction: true,
    uncertainObservedNotEnforced: true,
    appliesToInheritedParentState: true,
  }),
  // R2.46 — correction ownership derived from the generation schema's own lineage edge.
  causalAttributionContractSha256: causalAttributionContractSha256(),
  causalAttributionAuthority: ATTRIBUTION_AUTHORITY,
  causalAttributionRefusalCodes: ATTRIBUTION_REFUSAL_CODES,
  directRowImmutabilityContractSha256: d({
    ancestorDirectAssessmentMutationCount: 0,
    ancestorGovernedActionStatusPreserved: true,
    ancestorGovernedActionCandidateIdPreserved: true,
    ancestorApplicabilityPreserved: true,
    childCandidateIdsPreserved: true,
    childViolationMechanismPreserved: true,
    candidatePoolsUnchanged: true,
    crossSurfaceCandidateCitationStillRefused: "boundary_candidate_wrong_surface",
  }),
  packetDedupContractSha256: d({
    groupedBy: "explicit_causal_group_identity",
    dedupBasisIsMechanismEquality: false,
    manifestationEmitsNoSeparateInstruction: true,
    independentlySelectableReopeningRemainsOwnOwner: true,
    packetItemsPerCausalGroup: 1,
    ownerAndManifestationShareOneItemAtTwoCoordinates: true,
  }),
  // Hard caps this replay may not exceed.
  providerInvocationCap: MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT,
  semanticResponseCap: MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT,
  automaticTransportRetries: 0,
  generationCalls: 0,
  broadReviewCalls: 0,
  databaseCalls: 0,
  deploymentActions: 0,
  poolAwareRequirementContractSha256: d({
    requiredOnlyWhenPoolNonEmpty: true,
    presentStatusRequiresNonEmptyPool: true,
    emptyPoolAcceptsSentinel: true,
  }),
  activeBoundaryIds: provenance.activeBoundaryIds,
  boundaryText: provenance.confirmedBoundaries.map((b) => b.statement),
  artifactSchemaVersion: NARROW_REPLAY_ARTIFACT_VERSION,
  replayRuntimeSha256: d(runtime),
};

const CHECKS: Array<[string, string]> = [
  ["contract manifest", "manifestSha256"],
  // R2.44 + R2.46 — the authorities this canary exists to exercise.
  ["prerequisite evidence polarity", "evidencePolarityContractSha256"],
  ["prerequisite pool polarity", "prerequisitePoolPolaritySha256"],
  ["causal attribution", "causalAttributionContractSha256"],
  ["causal attribution authority", "causalAttributionAuthority"],
  ["causal attribution refusals", "causalAttributionRefusalCodes"],
  ["direct-row immutability", "directRowImmutabilityContractSha256"],
  ["packet dedup", "packetDedupContractSha256"],
  ["provider invocation cap", "providerInvocationCap"],
  ["semantic response cap", "semanticResponseCap"],
  ["automatic transport retries", "automaticTransportRetries"],
  ["generation calls", "generationCalls"],
  ["broad review calls", "broadReviewCalls"],
  ["database calls", "databaseCalls"],
  ["deployment actions", "deploymentActions"],
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
  ["evidence candidate map", "evidenceCandidateMapSha256"],
  ["evidence candidate count", "evidenceCandidateCount"],
  ["evidence candidate contract", "evidenceCandidateContractSha256"],
  ["candidate role classifier", "candidateRoleContractSha256"],
  ["governed-action role refusals", "governedActionRoleRefusedCount"],
  ["governed-action role uncertain", "governedActionRoleUncertainCount"],
  ["pool-aware requirement contract", "poolAwareRequirementContractSha256"],
  ["prompt parity contract", "promptParityContractSha256"],
  ["repair subset projection contract", "repairSubsetProjectionSha256"],
  ["repair merge authority", "subsetRepairContractSha256"],
  ["candidate aliases removed", "candidateAliasRemovedCount"],
  ["candidate provenance retained", "candidateProvenanceRetainedCount"],
  ["canonical truth-state table", "truthStateTableSha256"],
  ["removed model-authored fields", "removedModelAuthoredFieldsSha256"],
  ["failed-subset repair contract", "subsetRepairContractSha256"],
  ["prompt/schema field drift", "promptSchemaFieldDriftCount"],
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
# BTY Practice — R2.46 CAUSAL-ATTRIBUTION + CORRECTION-DEDUP REPLAY CANARY
# Slice 3.2I-PRACTICE-R5B1A.1-R2.46
#
# ONE reconstructed c18 subject x at most TWO narrow boundary-review calls
# (one review + at most one failed-subset repair).
# ZERO generation calls. ZERO broad semantic-review calls. ZERO database calls.
# ZERO deployment actions. ZERO automatic transport retries.
#
# WHY THIS REPLAY EXISTS — TWO PURPOSES, BOTH MEASUREMENT
#
#   1. VERIFY attribution and packet grouping on live output.
#      Deterministically, primary[1] now receives causal correction ownership
#      from branch[1].resulting_world_state, and the pair emits ONE packet item
#      at TWO coordinates instead of two items. This replay checks that holds
#      when the rows come from the model rather than from a fixture.
#
#   2. MEASURE how many non-clause-matching governed-action candidates the model
#      marks 'present' under the R2.44 pools. That number is the missing input
#      to the applicability decision and CANNOT be read off the R2.42 artifact,
#      which was produced under inverted failure evidence and a prompt
#      contradiction that no longer exist. Record it. Do not act on it here.
#
# WHAT R2.46 CHANGED
#   primary[1] -- "Notify the families and proceed with one patient" -- was
#   missed 7/7 across the whole arc. Not for lack of evidence: the server
#   offered candidate 2-a1, the reviewer SELECTED it, and answered
#   governedActionStatus: absent. Its generated child says "You prioritized
#   immediate treatment for one patient" -- a direct match, already a valid
#   violation. The generation schema defines branches[p].resultingWorldState AS
#   the world produced by choosing p, so a violation there is a consequence of
#   that choice by definition. Ownership follows that edge and nothing else.
#
# WHAT R2.46 DOES NOT CHANGE
#   primary[1]'s DIRECT assessment: still absent, still candidate 2-a1, still
#   not_applicable, still not a violation row. It never borrows 8-a1 -- the
#   resolver's cross-surface refusal stands. Candidate pools (57), the role
#   classifier, the polarity authority, deriveMechanism, prompt parity, the
#   repair projection and merge, sampling, temperature and the token budget are
#   all unchanged and digest-bound below.
#
# STILL OPEN, DELIBERATELY
#   The three APPLICABILITY false positives -- branch[1].tradeoff[0],
#   tradeoff[1], action[0] -- remain observable. This canary is NOT a
#   product-quality pass, and a green run must not be reported as one. R2.45
#   disproved a direct-term-only rule cross-domain (it drops "Activate the
#   account", a DIRECT governed action under a manager-approval boundary), so
#   that class waits for its own measured slice.
#
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

BINDING_JSON="$(npx --yes tsx scripts/practice-c18-causal-attribution-replay-runner.ts --binding-json)" \\
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

printf '\nLOCAL MOCK MATRIX + CAPTURED REGRESSIONS + RESTORED SAFETY ASSERTIONS (no credential, no network)\n'
npx --yes vitest run \\
  src/domain/foundry/arena-draft/boundaryTransportEvidence.test.ts \\
  src/domain/foundry/arena-draft/r232TransportRegression.test.ts \\
  src/lib/bty/foundry/arena/narrowBoundaryTransport.contract.test.ts \\
  src/domain/foundry/arena-draft/r230LiveDtoRegression.test.ts \\
  src/domain/foundry/arena-draft/r236TruthRegression.test.ts \\
  src/domain/foundry/arena-draft/boundaryCandidateAuthority.test.ts \\
  src/domain/foundry/arena-draft/boundaryCandidateRole.test.ts \\
  src/domain/foundry/arena-draft/boundaryAbsentCandidateParity.test.ts \\
  src/domain/foundry/arena-draft/narrowBoundaryReview.test.ts \\
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
