/**
 * FROZEN-SUBJECT REVIEWER REPLAY HARNESS — PHASE 1.
 *
 * Authorized by `[GOV-ARENA-REVIEWER-REPLAY-1]`.
 *
 * WHY THIS EXISTS
 *
 * Run 4 and Run 5 both stopped at a deterministic Level-3 gate, so `reviewCalls` was 0 in both and
 * the reviewer half of the question was never asked. The retained artifacts nonetheless carry a
 * complete draft and a complete per-choice construction map. This harness takes one of those frozen
 * subjects and drives the EXISTING narrow and broad reviewer pipelines over it, so a reviewer
 * judgment can be measured without spending another generation cell.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * - It never calls Plan or Render. Generation is not imported here at all.
 * - It never touches submission accounting. Every reviewer dependency is invoked with no accounting
 *   context, which the production seam already treats as inert.
 * - It invents no new production contract. Subject identity is composed from two digests that
 *   already exist: the artifact file hash and `scenarioDigest` of the retained draft.
 *
 * A replay row is never a production row. Every row carries `mode: "REPLAY"`, and a broad row is
 * marked `OFF_PIPELINE` whenever production's own narrow gate would not have allowed the broad
 * reviewer to run — so a replay judgment can never be mistaken for one production would have made.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import type { BoundaryReviewProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import type { BoundaryConstraint } from "@/domain/foundry/arena-draft/boundary";
import type { NarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import type { BroadReviewRequest } from "@/lib/bty/foundry/arena/reviewRequestProjection";
import type { BoundaryStageDeps } from "@/lib/bty/foundry/arena/boundaryReviewStage";

import { sha256, scenarioDigest } from "@/domain/foundry/arena-draft/reviewSubject";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { buildBoundaryProvenance, boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { resolveActiveBoundaries, MAX_ACTIVE_BOUNDARIES } from "@/domain/foundry/arena-draft/boundaryScope";
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { runBoundaryReviewStage } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { buildBroadReviewRequest } from "@/lib/bty/foundry/arena/reviewRequestProjection";
import { reviewBoundarySurfaces, reviewFieldRepair } from "@/lib/bty/foundry/arena/narrowBoundaryReviewer";
import { reviewConstraintCompliance } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";
import { EVAL_CORPUS } from "@/lib/bty/foundry/arena/practice-generation.eval";

/** Every runtime file this harness may ever write lives under exactly this root. */
export const REPLAY_OUTPUT_ROOT = ".eval-artifacts/reviewer-replay-01";

export type FrozenSubject = {
  artifactPath: string;
  artifactSha256: string;
  fixtureId: string;
  experimentId: string;
  draft: ArenaScenarioDraft;
  constructions: Record<string, unknown>;
  /** `scenarioDigest` of the retained draft — an existing digest, not a new contract. */
  scenarioSha256: string;
};

export type ReplayAuthority = {
  input: (typeof EVAL_CORPUS)[number]["input"];
  constraints: BoundaryConstraint[];
  boundaries: Array<{ id: string; statement: string }>;
  provenance: BoundaryReviewProvenance;
  provenanceSha256: string;
  language: string;
  caseId: string;
};

export type ReplayRow = {
  stage: "narrow" | "broad";
  mode: "REPLAY";
  pipeline: "ON_PIPELINE" | "OFF_PIPELINE";
  outcome: string;
};

export type ReplayResult = {
  subjectIdentity: {
    artifactPath: string;
    artifactSha256: string;
    scenarioSha256: string;
    /** Composed from the two existing digests above. Replay-local pointer, never a production id. */
    replaySubjectSha256: string;
    fixtureId: string;
  };
  accountingMode: "inert";
  broadReviewAllowed: boolean;
  rows: ReplayRow[];
  narrowStage: Awaited<ReturnType<typeof runBoundaryReviewStage>>;
  broad: unknown | null;
};

export type ReplayDeps = {
  narrowReview: BoundaryStageDeps["review"];
  narrowRepair: BoundaryStageDeps["repair"];
  broadReview: (args: {
    input: ReplayAuthority["input"];
    constraints: ReplayAuthority["constraints"];
    draft: ArenaScenarioDraft;
    constructions: Record<string, unknown>;
    subject: { sha256: string; attempt: number };
  }) => Promise<unknown>;
};

/**
 * Production reviewers, bound with NO accounting context.
 *
 * The seam already documents the absent context as the runner-only path, and it resolves to the
 * inert call scope, so a replay can never write a submission call row or consume a sequence slot.
 */
export const productionReplayDeps: ReplayDeps = {
  narrowReview: (subject, attempt, surfaceRefs) => reviewBoundarySurfaces(subject, attempt, surfaceRefs),
  narrowRepair: (subject, plan, attempt) => reviewFieldRepair(subject, plan, attempt),
  broadReview: ({ input, constraints, draft, constructions, subject }) =>
    reviewConstraintCompliance(input, constraints, draft, constructions, subject),
};

/** Load one retained artifact and REFUSE unless its bytes hash to the expected value. */
export function loadFrozenSubject(artifactPath: string, expectedSha256: string): FrozenSubject {
  const abs = resolve(process.cwd(), artifactPath);
  const bytes = readFileSync(abs);
  const actual = sha256(bytes.toString("utf8"));
  if (actual !== expectedSha256) {
    throw new Error(`frozen subject sha mismatch: expected ${expectedSha256}, measured ${actual}`);
  }
  const record = JSON.parse(bytes.toString("utf8")) as {
    fixtureId: string;
    experimentId: string;
    draft: { present: boolean; parsed: ArenaScenarioDraft | null };
    constructions: { present: boolean; parsed: Record<string, unknown> | null };
  };
  if (!record.draft?.present || !record.draft.parsed) throw new Error("frozen subject has no retained draft");
  if (!record.constructions?.present || !record.constructions.parsed) {
    throw new Error("frozen subject has no retained constructions");
  }
  return {
    artifactPath,
    artifactSha256: actual,
    fixtureId: record.fixtureId,
    experimentId: record.experimentId,
    draft: record.draft.parsed,
    constructions: record.constructions.parsed,
    scenarioSha256: scenarioDigest(record.draft.parsed),
  };
}

/**
 * Rebuild the boundary authority the production path would have derived, from the TRACKED fixture.
 *
 * The retained artifact does not carry constraints, facts or locale; the fixture it names does.
 * Every step below reuses the same exported pure functions production uses, so nothing is invented.
 */
export function deriveReplayAuthority(fixtureId: string): ReplayAuthority {
  const evalCase = EVAL_CORPUS.find((c) => c.id === fixtureId);
  if (!evalCase) throw new Error(`unknown fixture id: ${fixtureId}`);
  const input = evalCase.input;
  const boundary = input.boundary;
  if (!boundary || !boundary.confirmed) throw new Error(`fixture ${fixtureId} carries no confirmed boundary`);

  const scoped = resolveActiveBoundaries(boundary, input.boundaryScope);
  if (scoped.kind === "scope_required") throw new Error(`fixture ${fixtureId} requires a host scope selection`);

  const sourceReference = `boundary:${boundary.mode}`;
  const sourceSha256 = sha256(
    JSON.stringify({
      facts: input.facts,
      guided: input.guided,
      boundary: input.boundary ?? null,
      scope: input.boundaryScope ?? null,
    }),
  );
  const provenance = buildBoundaryProvenance({
    declaredBearing: true,
    available: boundary.constraints,
    activeIds: scoped.constraints.map((c) => c.id),
    scopeConfirmed: input.boundaryScope?.confirmed ?? boundary.constraints.length <= MAX_ACTIVE_BOUNDARIES,
    sourceKind: input.boundaryScope?.confirmed ? "host_confirmed_scope" : "canonical_case_input",
    sourceReference,
    sourceSha256,
  });

  return {
    input,
    constraints: scoped.constraints,
    boundaries: scoped.constraints.map((c) => ({ id: c.id, statement: c.statement })),
    provenance,
    provenanceSha256: boundaryProvenanceSha256(provenance),
    language: input.locale,
    caseId: scenarioDigest(input.facts),
  };
}

/** Replay-local subject pointer, composed only from digests that already exist. */
export const replaySubjectSha256 = (s: FrozenSubject): string => sha256(`${s.scenarioSha256}:${s.artifactSha256}`);

/** The narrow reviewer subject, built by the SAME contract builder production uses. */
export function buildReplayNarrowSubject(subject: FrozenSubject, authority: ReplayAuthority): NarrowBoundarySubject {
  return buildNarrowBoundarySubject({
    scenarioSha256: subject.scenarioSha256,
    reviewSubjectSha256: replaySubjectSha256(subject),
    boundaryProvenance: authority.provenance,
    boundaryProvenanceSha256: authority.provenanceSha256,
    boundaries: authority.boundaries,
    surfaces: enumerateBoundarySurfaces(subject.draft, subject.constructions),
    draft: subject.draft,
    language: authority.language,
    generationAttemptId: "replay",
    caseId: authority.caseId,
  });
}

/** The broad reviewer request, built by the SAME projection production uses. */
export function buildReplayBroadRequest(subject: FrozenSubject, authority: ReplayAuthority): BroadReviewRequest {
  return buildBroadReviewRequest(subject.draft, authority.boundaries, subject.constructions);
}

/**
 * Drive both reviewer pipelines over one frozen subject.
 *
 * The narrow stage decides `broadReviewAllowed` exactly as it does in production. When it says no,
 * the broad reviewer is NOT invoked and its row is recorded `OFF_PIPELINE`, so the absence is
 * visible as a recorded decision rather than as missing evidence.
 */
export async function runFrozenReviewerReplay(opts: {
  subject: FrozenSubject;
  deps?: ReplayDeps;
  authority?: ReplayAuthority;
}): Promise<ReplayResult> {
  const { subject } = opts;
  const deps = opts.deps ?? productionReplayDeps;
  const authority = opts.authority ?? deriveReplayAuthority(subject.fixtureId);
  const replaySha = replaySubjectSha256(subject);

  const narrowStage = await runBoundaryReviewStage(
    { review: deps.narrowReview, repair: deps.narrowRepair },
    {
      draft: subject.draft,
      constructions: subject.constructions,
      boundaries: authority.boundaries,
      boundaryProvenance: authority.provenance,
      boundaryProvenanceSha256: authority.provenanceSha256,
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: replaySha,
      language: authority.language,
      generationAttemptId: "replay",
      caseId: authority.caseId,
    },
  );

  const broadReviewAllowed = narrowStage.broadReviewAllowed === true;
  let broad: unknown | null = null;
  if (broadReviewAllowed) {
    broad = await deps.broadReview({
      input: authority.input,
      constraints: authority.constraints,
      draft: subject.draft,
      constructions: subject.constructions,
      subject: { sha256: replaySha, attempt: 1 },
    });
  }

  const rows: ReplayRow[] = [
    { stage: "narrow", mode: "REPLAY", pipeline: "ON_PIPELINE", outcome: narrowStage.outcome },
    {
      stage: "broad",
      mode: "REPLAY",
      pipeline: broadReviewAllowed ? "ON_PIPELINE" : "OFF_PIPELINE",
      outcome: broadReviewAllowed ? "broad_review_executed" : "broad_review_not_allowed_by_narrow_gate",
    },
  ];

  return {
    subjectIdentity: {
      artifactPath: subject.artifactPath,
      artifactSha256: subject.artifactSha256,
      scenarioSha256: subject.scenarioSha256,
      replaySubjectSha256: replaySha,
      fixtureId: subject.fixtureId,
    },
    accountingMode: "inert",
    broadReviewAllowed,
    rows,
    narrowStage,
    broad,
  };
}
