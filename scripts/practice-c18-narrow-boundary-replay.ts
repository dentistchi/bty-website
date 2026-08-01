#!/usr/bin/env npx tsx
/**
 * NARROW BOUNDARY-ONLY c18 REPLAY (Slice 3.2I-R5B1A.1-R2.29).
 *
 * ONE reconstructed c18 subject, ONE narrow boundary-review call in the normal path, ZERO generation
 * calls and ZERO broad semantic-review calls. It asks the question R2.28 proved the broad reviewer
 * could not answer structurally: does EVERY decision surface — including both resulting world states
 * — comply with `c1_verify`?
 *
 * The verdict is derived by the SERVER from per-surface evidence. A pass here is a reviewer
 * measurement, never a product-quality pass.
 *
 * PREPARED, NOT EXECUTED in R2.29.
 *
 *   BTY_C18_NARROW_MOCK=1 npx tsx scripts/practice-c18-narrow-boundary-replay.ts \
 *     --replay-run-id <id> --artifact-dir <dir> [--mock-outcome pass|reject|...]
 */
import { join } from "node:path";
import { writeReplayArtifact, BOUNDARY_REPLAY_ARTIFACT_KIND } from "@/lib/bty/foundry/arena/replayArtifact";
import { runBoundaryReviewStage, type BoundaryStageResult } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { buildNarrowBoundaryRequest, narrowBoundarySubjectSha256, type NarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import type { NarrowBoundaryCallResult } from "@/lib/bty/foundry/arena/narrowBoundaryReviewer";
import { boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { canonicalJson, subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { deriveBoundaryVerdict, type NarrowBoundaryAssessment, type ViolationMechanism } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { explanationAuthoritySha256 } from "@/domain/foundry/arena-draft/boundaryExplanation";
import { emptyTransportEvidence, transportEvidenceSha256 } from "@/domain/foundry/arena-draft/boundaryTransportEvidence";
import { NARROW_TIMEOUT_OWNER } from "@/lib/bty/foundry/arena/narrowBoundaryReviewer";
import { parityTableSha256 } from "@/domain/foundry/arena-draft/boundaryReasonParity";
import { BOUNDARY_REPORTABLE_OUTCOMES, NARROW_REPLAY_ARTIFACT_VERSION as ARTIFACT_VERSION, renderAllowedOutcomes } from "@/domain/foundry/arena-draft/boundaryOutcomes";
import { compatibilitySurfaces, enumerateBoundarySurfaces, reviewableSurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { OPENING_SEGMENT_REF } from "@/domain/foundry/arena-draft/boundaryContextSegments";
import { excerptConcernsPrerequisite } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { RECONSTRUCTION_DISCLAIMER } from "@/lib/bty/foundry/arena/historicalBoundaryReconstruction";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { buildC18Subject, CASE_ID, SOURCE_ARTIFACT, SOURCE_ARTIFACT_SHA256, SOURCE_ATTEMPT_INDEX } from "./practice-c18-boundary-replay";

const MOCK_ENV = "BTY_C18_NARROW_MOCK";
// R2.34 — re-exported from the ONE canonical source; never redeclared here.
export { NARROW_REPLAY_ARTIFACT_VERSION } from "@/domain/foundry/arena-draft/boundaryOutcomes";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

export type NarrowReplayDeps = {
  review: (subject: NarrowBoundarySubject, attempt: number) => Promise<NarrowBoundaryCallResult>;
  writeArtifact: (payload: string, subjectSha: string) => { path: string; sha256: string; bytes: number };
  log?: (line: string) => void;
  /**
   * TEST-ONLY seam for proving fail-closed behaviour (e.g. a missing resulting world state) over the
   * real frozen subject. Never used by the live path — the runner passes no mutation.
   */
  mutateDraft?: (draft: ArenaScenarioDraft) => ArenaScenarioDraft;
};

export type NarrowReplaySummary = {
  outcome: BoundaryStageResult["outcome"];
  calls: number;
  reruns: number;
  artifactPath: string | null;
  artifactSha256: string | null;
  boundaryReviewSubjectSha256: string | null;
  reachableSurfaces: string[];
  excludedCompatibilitySurfaces: string[];
  causalViolations: string[];
  authorityCodes: string[];
  outputContractFailure: boolean;
  providerFailureCode: string | null;
  providerInvocations: number;
  providerResponses: number;
  semanticAttempts: number;
  transportFailures: number;
  responseState: string | null;
  httpStatus: number | null;
  retriability: string | null;
  failureLayer: string | null;
  timeoutState: string | null;
  retryAfterMs: number | null;
  serverDerivedExplanations: number;
  modelReasonRequiredCount: number;
  modelReasonMissingCount: number;
  uncertainties: Array<{ surfaceRef: string; reason: string }>;
};

/**
 * Run the boundary-only replay over the ONE reconstructed c18 subject.
 *
 * Exported so the mock proof executes the EXACT program a live run would, with only the provider
 * seam replaced — a mock that runs different code proves nothing about the live path.
 */
export async function runC18NarrowBoundaryReplay(
  deps: NarrowReplayDeps,
  repoRoot: string,
  evidenceDir: string,
  replayRunId: string,
  mode: "mock" | "live",
): Promise<NarrowReplaySummary> {
  const log = deps.log ?? (() => undefined);
  const broad = buildC18Subject(repoRoot, evidenceDir);
  const subject = broad.subject;
  const provenance = subject.boundaryProvenance!;
  const provenanceSha = boundaryProvenanceSha256(provenance);
  const digests = subjectDigests(subject);

  const draft = deps.mutateDraft
    ? deps.mutateDraft(JSON.parse(JSON.stringify(subject.scenario)) as ArenaScenarioDraft)
    : (subject.scenario as ArenaScenarioDraft);

  const stage = await runBoundaryReviewStage(
    { review: deps.review, log: (outcome, code, extra) => log(`${outcome}${code ? ` code=${code}` : ""} ${canonicalJson(extra)}`) },
    {
      draft,
      // The reconstructed subject carries no generator construction records, and none are invented.
      constructions: {},
      boundaries: subject.confirmedBoundaries,
      boundaryProvenance: provenance,
      boundaryProvenanceSha256: provenanceSha,
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: digests.reviewSubjectSha256,
      language: subject.language,
      generationAttemptId: subject.generationAttemptId,
      caseId: CASE_ID,
    },
  );

  // The artifact carries the complete evidence chain, never just the outcome label.
  const payload = JSON.stringify(
    {
      artifactVersion: ARTIFACT_VERSION,
      mode,
      replayRunId,
      sourceRunId: broad.sourceRunId,
      sourcePassId: broad.sourcePassId,
      sourceCaseId: broad.sourceCaseId,
      sourceAttemptIndex: SOURCE_ATTEMPT_INDEX,
      sourceArtifactFile: SOURCE_ARTIFACT,
      sourceArtifactSha256: SOURCE_ARTIFACT_SHA256,
      reconstructionDisclaimer: RECONSTRUCTION_DISCLAIMER,
      productQualityPass: null,
      productQualityAuthority: "human_only",
      subjectDigests: digests,
      boundaryProvenance: provenance,
      activeBoundaryIds: subject.activeBoundaryIds,
      boundaryReviewSubjectSha256: stage.boundaryReviewSubjectSha256,
      surfaceMapSha256: stage.surfaceMapSha256,
      lineageSha256: stage.subject?.lineageSha256 ?? null,
      // R2.30 — what was reviewed, and what was excluded as unreachable, are both evidence.
      reachableSurfaces: stage.reachableSurfaces,
      excludedCompatibilitySurfaces: stage.excludedCompatibilitySurfaces,
      surfaces: stage.subject?.surfaces ?? [],
      compatibilitySurfaces: stage.subject?.compatibilitySurfaces ?? [],
      request: stage.subject ? buildNarrowBoundaryRequest(stage.subject) : null,
      boundaryReviewOutcome: stage.outcome,
      boundaryReviewCalls: stage.calls,
      boundaryReviewReruns: stage.reruns,
      boundaryReviewEvidence: stage.evidences,
      violations: stage.violations,
      causalViolations: stage.causalViolations,
      downstreamViolations: stage.downstreamViolations,
      uncertainties: stage.uncertainties,
      findings: stage.findings,
      authorityCodes: stage.codes,
      // R2.32 — the explanation is rendered evidence, never a semantic finding. It is stored beside
      // the original DTO, which is preserved untouched in `boundaryReviewEvidence`.
      serverDerivedExplanations: stage.explanations,
      explanationSha256: stage.explanationSha256,
      explanationAuthoritySha256: explanationAuthoritySha256(),
      reasonParityTableSha256: parityTableSha256(),
      outputContractFailure: stage.outputContractFailure,
      // R2.34 — transport evidence, separated counts and the invocation budget.
      transportEvidence: stage.transportEvidence,
      transportEvidenceSha256: transportEvidenceSha256(),
      providerFailureCode: stage.providerFailureCode,
      boundaryProviderInvocationCount: stage.providerInvocations,
      boundaryProviderResponseCount: stage.providerResponses,
      boundarySemanticReviewAttemptCount: stage.semanticAttempts,
      boundaryTransportFailureCount: stage.transportFailures,
      boundaryTransportRetryCount: 0,
      invocationBudgetExhausted: stage.invocationBudgetExhausted,
      modelReasonRequiredCount: stage.modelReasonRequiredCount,
      modelReasonMissingCount: stage.modelReasonMissingCount,
      modelReasonUnexpectedCount: stage.modelReasonUnexpectedCount,
      allowedOutcomes: [...BOUNDARY_REPORTABLE_OUTCOMES],
      broadReviewStarted: false,
      broadReviewAllowed: stage.broadReviewAllowed,
      generationCallCount: 0,
      broadReviewCallCount: 0,
    },
    null,
    2,
  );
  const written = deps.writeArtifact(payload, stage.boundaryReviewSubjectSha256 ?? digests.reviewSubjectSha256);

  return {
    outcome: stage.outcome,
    calls: stage.calls,
    reruns: stage.reruns,
    artifactPath: written.path,
    artifactSha256: written.sha256,
    boundaryReviewSubjectSha256: stage.boundaryReviewSubjectSha256,
    reachableSurfaces: stage.reachableSurfaces,
    excludedCompatibilitySurfaces: stage.excludedCompatibilitySurfaces,
    causalViolations: stage.causalViolations.map((v) => v.surfaceRef),
    authorityCodes: stage.codes,
    outputContractFailure: stage.outputContractFailure,
    providerFailureCode: stage.providerFailureCode,
    providerInvocations: stage.providerInvocations,
    providerResponses: stage.providerResponses,
    semanticAttempts: stage.semanticAttempts,
    transportFailures: stage.transportFailures,
    responseState: stage.transportEvidence.at(-1)?.responseState ?? null,
    httpStatus: stage.transportEvidence.at(-1)?.httpStatus ?? null,
    retriability: stage.transportEvidence.at(-1)?.retriability ?? null,
    failureLayer: stage.transportEvidence.at(-1)?.failureLayer ?? null,
    timeoutState: stage.transportEvidence.at(-1)?.timeoutState ?? null,
    retryAfterMs: stage.transportEvidence.at(-1)?.retryAfterMs ?? null,
    serverDerivedExplanations: stage.explanations.filter((e) => e.authority === "server").length,
    modelReasonRequiredCount: stage.modelReasonRequiredCount,
    modelReasonMissingCount: stage.modelReasonMissingCount,
    uncertainties: stage.uncertainties.map((u) => ({ surfaceRef: u.surfaceRef, reason: u.reason })),
  };
}

/** Deterministic mock responses. Never a network call; used by the mock proof and `--mock`. */
export function mockNarrowReview(kind: string, subject: NarrowBoundarySubject, attempt: number): NarrowBoundaryCallResult {
  const surfaces = subject.surfaces;
  const b = subject.boundaries[0]!;
  // R2.36 — the mock speaks the SAME segment vocabulary the live reviewer is given, so a mock case
  // cannot pass by citing evidence no real response could have produced.
  const segs = subject.contextSegments;
  const ownRef = (ref: string) => segs.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "own_surface")?.segmentRef ?? "";
  const parRef = (ref: string) => segs.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "parent_generated_state")?.segmentRef ?? "";
  const parText = (ref: string) => segs.find((x) => x.sourceSurfaceRef === ref && x.segmentKind === "parent_generated_state")?.text ?? "";

  /** Everything settles as not_applicable, each showing what the surface actually does. */
  const settled: NarrowBoundaryAssessment[] = surfaces.map((s) => ({
    boundaryId: b.id,
    surfaceRef: s.coordinate,
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: ownRef(s.coordinate), excerpt: s.text.slice(0, 90) },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    // R2.32 — empty is CORRECT here: the server owns this explanation.
    reason: "",
  }));

  const at = (rows: NarrowBoundaryAssessment[], ref: string, patch: Partial<NarrowBoundaryAssessment>): NarrowBoundaryAssessment[] =>
    rows.map((a) => (a.surfaceRef === ref ? { ...a, ...patch } : a));

  /**
   * A fully-supported violation: own governed action, own-or-inherited prerequisite failure that is
   * genuinely ABOUT the prerequisite, and an ordering that puts the action first.
   */
  const violate = (ref: string, mechanism: ViolationMechanism) =>
    (rows: NarrowBoundaryAssessment[]): NarrowBoundaryAssessment[] => {
      const s = surfaces.find((x) => x.coordinate === ref);
      if (!s) return rows;
      // Quote the prerequisite failure from wherever it actually is, and quote the RIGHT PART: a
      // window that genuinely concerns the prerequisite, not simply the first 90 characters. The
      // contract refuses an excerpt about anything else, so a mock that grabs a prefix would be
      // asserting a claim the validator is correct to reject.
      const frame = subject.semanticFrames.find((f) => f.boundaryId === b.id);
      const window = (text: string): string | null => {
        for (let i = 0; i + 20 <= text.length; i += 10) {
          const w = text.slice(i, i + 90);
          if (excerptConcernsPrerequisite(w, frame)) return w;
        }
        return null;
      };
      const ownWindow = window(s.text);
      const parWindow = window(parText(ref));
      const prereq = ownWindow
        ? { segmentRef: ownRef(ref), excerpt: ownWindow }
        : parWindow
          ? { segmentRef: parRef(ref), excerpt: parWindow }
          : { segmentRef: ownRef(ref), excerpt: s.text.slice(0, 90) };
      return at(rows, ref, {
        applicability: "applies",
        governedActionStatus: "present",
        prerequisiteStatus: "explicitly_missing",
        temporalRelation: "action_before_prerequisite",
        compliance: "violates",
        violationMechanism: mechanism,
        actionEvidence: { segmentRef: ownRef(ref), excerpt: s.text.slice(0, 90) },
        prerequisiteEvidence: prereq,
        reason: "",
      });
    };

  let parsed: unknown;
  switch (kind) {
    case "reject": {
      // A real causal chain: an asserted state → a NEW authorization downstream.
      //
      // R2.36 — `primary[1]` is deliberately NOT in this chain. Its own text names no unmet
      // prerequisite, so a violation claim there is refused rather than grounded; putting it in the
      // mock would make the mock assert something the contract cannot support. See
      // `primaryGroundedFixture` for the carried-forward limitation.
      let rows: NarrowBoundaryAssessment[] = settled;
      for (const [ref, mech] of [
        ["branch[1].resulting_world_state", "resulting_state_missing_prerequisite"],
        ["branch[1].action[1]", "governed_action_without_prerequisite"],
      ] as const) {
        if (surfaces.some((s) => s.coordinate === ref)) rows = violate(ref, mech)(rows);
      }
      parsed = { assessments: rows };
      break;
    }
    case "unsupported_violation":
      // The R2.29 shape: a violation asserted from silence. The claim must not survive.
      parsed = {
        assessments: at(settled, "branch[1].action[0]", {
          applicability: "applies",
          governedActionStatus: "present",
          prerequisiteStatus: "not_established",
          temporalRelation: "simultaneous_or_unclear",
          compliance: "violates",
          violationMechanism: "governed_action_without_prerequisite",
          actionEvidence: { segmentRef: ownRef("branch[1].action[0]"), excerpt: "Finish the summary and send it to the administrator" },
          prerequisiteEvidence: { segmentRef: "", excerpt: "" },
          reason: "",
        }),
      };
      break;

    // --- R2.36 truth cases ---------------------------------------------------
    case "ungrounded_prerequisite": {
      // THE MEASURED R2.34 FALSE POSITIVE. A real, own-text excerpt that is about a DELAY, offered
      // as proof that identifier verification failed. Grounded in location, false in meaning.
      const ref = "branch[0].resulting_world_state";
      const own = surfaces.find((x) => x.coordinate === ref);
      parsed = {
        assessments: at(settled, ref, {
          applicability: "applies",
          governedActionStatus: "present",
          prerequisiteStatus: "explicitly_missing",
          temporalRelation: "action_before_prerequisite",
          compliance: "violates",
          violationMechanism: "resulting_state_missing_prerequisite",
          actionEvidence: { segmentRef: ownRef(ref), excerpt: (own?.text ?? "").slice(0, 70) },
          prerequisiteEvidence: { segmentRef: ownRef(ref), excerpt: "but you still face delays in the ward due to the surge in admissions." },
          reason: "",
        }),
      };
      break;
    }
    case "satisfied_but_violates": {
      // The prerequisite is asserted SATISFIED and the surface is rejected anyway. A contradiction
      // the R2.34 contract had no field to notice.
      const ref = "branch[0].resulting_world_state";
      const own = surfaces.find((x) => x.coordinate === ref);
      parsed = {
        assessments: at(settled, ref, {
          applicability: "applies",
          governedActionStatus: "present",
          prerequisiteStatus: "satisfied",
          temporalRelation: "action_before_prerequisite",
          compliance: "violates",
          violationMechanism: "resulting_state_missing_prerequisite",
          actionEvidence: { segmentRef: ownRef(ref), excerpt: (own?.text ?? "").slice(0, 70) },
          prerequisiteEvidence: { segmentRef: ownRef(ref), excerpt: (own?.text ?? "").slice(0, 70) },
          reason: "",
        }),
      };
      break;
    }
    case "inherited_without_own_action": {
      // THE MEASURED CROSS-SURFACE LEAK. An administrative action rejected using its PARENT's text.
      const ref = "branch[0].action[0]";
      parsed = {
        assessments: at(settled, ref, {
          applicability: "applies",
          governedActionStatus: "absent",
          prerequisiteStatus: "explicitly_missing",
          temporalRelation: "action_before_prerequisite",
          compliance: "violates",
          violationMechanism: "resulting_state_missing_prerequisite",
          actionEvidence: { segmentRef: ownRef(ref), excerpt: "Finalize the report and communicate with the administrator" },
          prerequisiteEvidence: { segmentRef: parRef(ref), excerpt: parText(ref).slice(0, 90) },
          reason: "",
        }),
      };
      break;
    }
    case "foreign_segment": {
      // Quoting ANOTHER surface's segment. Not a wrong opinion — a response that is not reading the
      // text it was given. Always fatal.
      const ref = "branch[1].action[1]";
      parsed = {
        assessments: at(settled, ref, {
          applicability: "applies",
          governedActionStatus: "present",
          prerequisiteStatus: "explicitly_missing",
          temporalRelation: "action_before_prerequisite",
          compliance: "violates",
          violationMechanism: "governed_action_without_prerequisite",
          actionEvidence: { segmentRef: ownRef("branch[0].action[0]"), excerpt: "Finalize the report and communicate with the administrator" },
          prerequisiteEvidence: { segmentRef: parRef(ref), excerpt: parText(ref).slice(0, 90) },
          reason: "",
        }),
      };
      break;
    }
    case "fabricated_excerpt": {
      const ref = "branch[1].action[1]";
      parsed = {
        assessments: at(settled, ref, {
          applicability: "applies",
          governedActionStatus: "present",
          prerequisiteStatus: "explicitly_missing",
          temporalRelation: "action_before_prerequisite",
          compliance: "violates",
          violationMechanism: "governed_action_without_prerequisite",
          actionEvidence: { segmentRef: ownRef(ref), excerpt: "Immediately treat the patient without checking anything at all" },
          prerequisiteEvidence: { segmentRef: parRef(ref), excerpt: parText(ref).slice(0, 90) },
          reason: "",
        }),
      };
      break;
    }
    case "opening_segment_as_action": {
      // The scenario premise offered as proof of what a CHOICE does. Context is not conduct.
      const ref = "branch[1].action[1]";
      parsed = {
        assessments: at(settled, ref, {
          applicability: "applies",
          governedActionStatus: "present",
          prerequisiteStatus: "explicitly_missing",
          temporalRelation: "action_before_prerequisite",
          compliance: "violates",
          violationMechanism: "governed_action_without_prerequisite",
          actionEvidence: { segmentRef: OPENING_SEGMENT_REF, excerpt: subject.opening.slice(0, 80) },
          prerequisiteEvidence: { segmentRef: parRef(ref), excerpt: parText(ref).slice(0, 90) },
          reason: "",
        }),
      };
      break;
    }
    case "uncertain":
      parsed = {
        assessments: at(settled, "branch[1].tradeoff[1]", {
          applicability: "uncertain",
          governedActionStatus: "uncertain",
          prerequisiteStatus: "uncertain",
          reason: "'caring for' may or may not mean treating",
        }),
      };
      break;
    case "malformed":
      parsed = { assessments: settled.slice(1) };
      break;
    case "output_contract":
      // R2.32 — the shape that MUST still fail: a state whose explanation only the model can give,
      // with the explanation missing. Distinct from a coverage or grounding failure.
      parsed = {
        assessments: at(settled, "branch[1].tradeoff[1]", { applicability: "uncertain", governedActionStatus: "uncertain", prerequisiteStatus: "uncertain", reason: "" }),
      };
      break;
    default:
      parsed = { assessments: settled };
  }

  const verdict = deriveBoundaryVerdict(parsed, {
    boundaries: subject.boundaries,
    surfaces,
    segments: subject.contextSegments,
    frames: subject.semanticFrames,
  });
  return {
    kind: "derived",
    verdict,
    evidence: {
      boundaryReviewAttempt: attempt,
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
      surfaceMapSha256: subject.surfaceMapSha256,
      activeBoundaryIds: subject.activeBoundaryIds,
      requiredAssessmentCount: subject.boundaries.length * surfaces.length,
      parsed,
      outcome: verdict.outcome,
      verdict,
      finishReason: "stop",
      latencyMs: 0,
      sanitizedError: null,
      // A mock response DID arrive; the transport record says so honestly.
      transport: {
        ...emptyTransportEvidence(`mock#${attempt}`),
        requestConstructed: true,
        clientInvocationStarted: true,
        providerInvocationStarted: true,
        providerInvocationStartedAt: 0,
        providerInvocationEndedAt: 0,
        latencyMs: 0,
        responseState: "response_received",
        responseEnvelopePresent: true,
        structuredOutputPresent: true,
        timeoutState: "armed_not_fired",
        timeoutOwner: NARROW_TIMEOUT_OWNER,
        evidenceSource: "structured",
        artifactWriteResult: "pending",
      },
      providerFailureCode: null,
    },
  };
}

async function main(): Promise<void> {
  const useMock = process.env[MOCK_ENV] === "1";
  const replayRunId = arg("replay-run-id");
  const dir = arg("artifact-dir");
  const evidenceDir = arg("evidence-dir", join(process.cwd(), ".eval-artifacts"));
  const mode: "mock" | "live" = useMock ? "mock" : "live";

  const broad = buildC18Subject(process.cwd(), evidenceDir);
  const all = enumerateBoundarySurfaces(broad.subject.scenario as ArenaScenarioDraft, {});
  const reachable = reviewableSurfaces(all);
  const excluded = compatibilitySurfaces(all);
  process.stdout.write(`${RECONSTRUCTION_DISCLAIMER}\n`);
  process.stdout.write(`ACTIVE BOUNDARY: ${broad.subject.activeBoundaryIds.join(",")}\n`);
  process.stdout.write(`BOUNDARY TEXT:   ${broad.subject.confirmedBoundaries.map((b) => b.statement).join(" | ")}\n`);
  process.stdout.write(`REACHABLE DECISION SURFACES (${reachable.length}):\n${reachable.map((s) => `  ${s.coordinate}  [${s.reachability}] lineage=${s.lineage.join("<-") || "root"}`).join("\n")}\n`);
  process.stdout.write(`EXCLUDED COMPATIBILITY PROJECTIONS (${excluded.length}):\n${excluded.map((s) => `  ${s.coordinate} -> ${s.compatibilitySource}`).join("\n")}\n`);

  const summary = await runC18NarrowBoundaryReplay(
    {
      review: async (s, a) => {
        if (useMock) return mockNarrowReview(arg("mock-outcome", "pass"), s, a);
        const { reviewBoundarySurfaces } = await import("@/lib/bty/foundry/arena/narrowBoundaryReviewer");
        return reviewBoundarySurfaces(s, a);
      },
      writeArtifact: (payload, subjectSha) =>
        writeReplayArtifact(
          dir,
          { mode, replayRunId, sourcePassId: "pass2", sourceCaseId: CASE_ID, sourceAttemptIndex: SOURCE_ATTEMPT_INDEX, reviewSubjectSha256: subjectSha },
          payload,
          BOUNDARY_REPLAY_ARTIFACT_KIND,
        ),
      log: (line) => process.stdout.write(`${line}\n`),
    },
    process.cwd(),
    evidenceDir,
    replayRunId,
    mode,
  );

  if (useMock) process.stdout.write("C18 NARROW BOUNDARY REPLAY MOCK · LIVE PROVIDER NOT CALLED\n");
  process.stdout.write(`OUTCOME: ${summary.outcome}\nCALLS: ${summary.calls}\nRERUNS: ${summary.reruns}\n`);
  // R2.34 Part 10 — the TRANSPORT layer is reported before and apart from any semantic claim, so a
  // provider failure can never be read as a reviewer verdict.
  process.stdout.write(`\n-- TRANSPORT --\n`);
  process.stdout.write(`TOP-LEVEL OUTCOME:      ${summary.outcome}\n`);
  process.stdout.write(`PROVIDER FAILURE CODE:  ${summary.providerFailureCode ?? "(none — no provider failure)"}\n`);
  process.stdout.write(`FAILURE LAYER:          ${summary.failureLayer ?? "(n/a)"}\n`);
  process.stdout.write(`RESPONSE STATE:         ${summary.responseState ?? "(n/a)"}\n`);
  process.stdout.write(`HTTP STATUS:            ${summary.httpStatus ?? "(none recorded)"}\n`);
  process.stdout.write(`RETRIABILITY:           ${summary.retriability ?? "(n/a)"}\n`);
  process.stdout.write(`RETRY-AFTER:            ${summary.retryAfterMs === null ? "(none)" : `${summary.retryAfterMs} ms`}\n`);
  process.stdout.write(`TIMEOUT / ABORT:        ${summary.timeoutState ?? "(n/a)"}\n`);
  process.stdout.write(`\n-- COUNTS --\n`);
  process.stdout.write(`provider invocations:   ${summary.providerInvocations}\n`);
  process.stdout.write(`provider responses:     ${summary.providerResponses}\n`);
  process.stdout.write(`semantic attempts:      ${summary.semanticAttempts}\n`);
  process.stdout.write(`semantic reruns:        ${summary.reruns}\n`);
  process.stdout.write(`transport failures:     ${summary.transportFailures}\n`);
  process.stdout.write(`generation calls:       0\n`);
  process.stdout.write(`broad-review calls:     0\n`);

  process.stdout.write(`\n-- SEMANTIC VERDICT --\n`);
  process.stdout.write(`EARLIEST CAUSAL VIOLATIONS: ${summary.causalViolations.join(", ") || "(none)"}\n`);
  process.stdout.write(`UNCERTAINTY FINDINGS:       ${summary.uncertainties.map((u) => `${u.surfaceRef}: ${u.reason}`).join(" | ") || "(none)"}\n`);
  process.stdout.write(`\n-- SERVER-DERIVED EXPLANATIONS (rendered, never a finding) --\n`);
  process.stdout.write(`count: ${summary.serverDerivedExplanations}\n`);
  process.stdout.write(`\n-- MODEL REASON CONTRACT --\n`);
  process.stdout.write(`required: ${summary.modelReasonRequiredCount}  missing: ${summary.modelReasonMissingCount}  outputContractFailure: ${summary.outputContractFailure}\n`);
  process.stdout.write(`PREVENTED UNSUPPORTED FINDINGS: violations asserted without a grounded mechanism are refused, never reported\n`);
  if (summary.authorityCodes.length) process.stdout.write(`AUTHORITY CODES: ${summary.authorityCodes.join(", ")}\n`);
  process.stdout.write(`\nALLOWED OUTCOMES:\n${renderAllowedOutcomes().map((l) => `  ${l}`).join("\n")}\n`);
  process.stdout.write(`ARTIFACT: ${summary.artifactPath} ${summary.artifactSha256}\n`);
  process.stdout.write("A PASS IS A REVIEWER MEASUREMENT · NEVER A PRODUCT-QUALITY PASS\n");
  if (summary.outcome === "boundary_reviewer_terminal_failure" || summary.outcome === "boundary_review_authority_failure") process.exitCode = 4;
}

const invokedDirectly = (process.argv[1] ?? "").endsWith("practice-c18-narrow-boundary-replay.ts");
if (invokedDirectly) {
  void main().catch((error: unknown) => {
    process.stderr.write(`C18 NARROW BOUNDARY REPLAY FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
    process.exitCode = 1;
  });
}
