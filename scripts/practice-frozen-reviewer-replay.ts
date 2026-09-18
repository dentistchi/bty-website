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

import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

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

/** The durable per-subject authority from `[GOV-ARENA-REVIEWER-REPLAY-1-AMENDMENT-1]` §3(B). */
export const SUBJECT_AUTHORITY = {
  run4: {
    artifactSha256: "e52cc7896da89bcdb745bc4f2c4c7acae652810e359e72a7897102f7cf25644b",
    scenarioDigest: "c917a9d33b581154768e19269c91a1553dd23da07c92b58b7d705cfed30e1390",
  },
  run5: {
    artifactSha256: "46d6882b78f7064de68310b8312fd4b0f9ab5c6f603150ed682a4f8f383b4fd8",
    scenarioDigest: "cae7711899ddc565e3551b2666218986075fa60974fda133686da00a5df30be7",
  },
} as const;

export type SubjectId = keyof typeof SUBJECT_AUTHORITY;

export type ReplayArgs = {
  subject: SubjectId;
  artifact: string;
  expectedSha: string;
  expectedScenarioDigest: string;
};

const REQUIRED_FLAGS = ["--subject", "--artifact", "--expected-sha", "--expected-scenario-digest"] as const;

/**
 * Parse the CLI. There is no batch flag and no retry flag, by construction: a run can only ever
 * name ONE subject, so "exactly once per subject" is a property of the interface rather than of
 * operator discipline. Every rejection here happens before any reviewer dependency is touched.
 */
export function parseReplayArgs(argv: readonly string[]): ReplayArgs {
  const seen = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!(REQUIRED_FLAGS as readonly string[]).includes(flag)) {
      throw new Error(`unknown flag: ${flag} (no batch flag and no retry flag exist)`);
    }
    if (seen.has(flag)) throw new Error(`duplicate flag: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    seen.set(flag, value);
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!seen.has(flag)) throw new Error(`missing required flag: ${flag}`);
  }
  const subject = seen.get("--subject") as string;
  if (subject !== "run4" && subject !== "run5") {
    throw new Error(`invalid --subject: ${subject} (authorized subjects are run4 and run5 only)`);
  }
  return {
    subject,
    artifact: seen.get("--artifact") as string,
    expectedSha: seen.get("--expected-sha") as string,
    expectedScenarioDigest: seen.get("--expected-scenario-digest") as string,
  };
}

/** One deterministic evidence file per subject. */
export const evidencePathFor = (outputRoot: string, subjectId: string): string =>
  join(outputRoot, `${subjectId}.replay.json`);

/** Count occurrences of the FIELD NAME in a serialized request. */
const complianceFieldCount = (value: unknown): number =>
  JSON.stringify(value).split('"boundaryCompliance"').length - 1;

/**
 * Drive both reviewer pipelines over one frozen subject.
 *
 * `broadReviewAllowed` is computed exactly as production computes it and is RECORDED, but it does
 * not gate the call: the broad reviewer runs exactly once either way, and the gate becomes the row
 * label instead. An OFF_PIPELINE broad row is reviewer-capability evidence and is never production
 * pipeline behaviour.
 *
 * Evidence is written before the first dependency invocation and re-persisted at every stage, so a
 * consumed subject can never leave zero evidence behind.
 */
export async function runFrozenReviewerReplay(opts: {
  subjectId: SubjectId;
  subject: FrozenSubject;
  deps?: ReplayDeps;
  authority?: ReplayAuthority;
  outputRoot?: string;
  innerCommit?: string;
}): Promise<ReplayResult> {
  const { subject, subjectId } = opts;
  const deps = opts.deps ?? productionReplayDeps;
  const outputRoot = opts.outputRoot ?? REPLAY_OUTPUT_ROOT;

  // --- pre-call authority: nothing below may run if the subject is not what was authorized ------
  const expected = SUBJECT_AUTHORITY[subjectId];
  if (subject.artifactSha256 !== expected.artifactSha256) {
    throw new Error(`subject ${subjectId} artifact sha mismatch`);
  }
  if (subject.scenarioSha256 !== expected.scenarioDigest) {
    throw new Error(`subject ${subjectId} scenario digest mismatch`);
  }

  const authority = opts.authority ?? deriveReplayAuthority(subject.fixtureId);
  const replaySha = replaySubjectSha256(subject);
  const narrowRequest = buildReplayNarrowSubject(subject, authority);
  const broadRequest = buildReplayBroadRequest(subject, authority);

  const evidencePath = evidencePathFor(outputRoot, subjectId);
  const counts = { narrowReview: 0, narrowRepair: 0, broadReview: 0 };
  const evidence: Record<string, unknown> = {
    marker: "REPLAY",
    subjectId,
    artifactPath: subject.artifactPath,
    artifactSha256: subject.artifactSha256,
    scenarioSha256: subject.scenarioSha256,
    replaySubjectSha256: replaySha,
    innerCommit: opts.innerCommit ?? null,
    accountingMode: "inert",
    consumed: false,
    startedAt: new Date().toISOString(),
    narrowRequest,
    narrowRequestSha256: scenarioDigest(narrowRequest),
    broadRequest,
    broadRequestSha256: scenarioDigest(broadRequest),
    boundaryComplianceOccurrences: {
      narrowRequest: complianceFieldCount(narrowRequest),
      broadRequest: complianceFieldCount(broadRequest),
    },
    callCounts: counts,
  };

  // EXCLUSIVE CREATE. An existing file for this subject means it was already replayed; refusing
  // here — before any dependency call — is what makes "no second replay" structural.
  mkdirSync(dirname(resolve(evidencePath)), { recursive: true });
  try {
    closeSync(openSync(resolve(evidencePath), "wx"));
  } catch {
    throw new Error(`replay evidence for ${subjectId} already exists at ${evidencePath}; no overwrite path is authorized`);
  }
  const persist = () => writeFileSync(resolve(evidencePath), JSON.stringify(evidence, null, 2), "utf8");
  persist();

  // The subject becomes CONSUMED at the first dependency invocation, never earlier.
  const consume = () => {
    if (evidence.consumed !== true) {
      evidence.consumed = true;
      evidence.consumedAt = new Date().toISOString();
      persist();
    }
  };
  const counted: ReplayDeps = {
    narrowReview: (s, a, refs) => { consume(); counts.narrowReview += 1; persist(); return deps.narrowReview(s, a, refs); },
    narrowRepair: (s, plan, a) => { consume(); counts.narrowRepair += 1; persist(); return deps.narrowRepair(s, plan, a); },
    broadReview: (args) => { consume(); counts.broadReview += 1; persist(); return deps.broadReview(args); },
  };

  let stage = "narrow";
  try {
    const narrowStage = await runBoundaryReviewStage(
      { review: counted.narrowReview, repair: counted.narrowRepair },
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
    evidence.narrowStage = narrowStage;
    const broadReviewAllowed = narrowStage.broadReviewAllowed === true;
    evidence.broadReviewAllowed = broadReviewAllowed;
    persist();

    stage = "broad";
    const broad = await counted.broadReview({
      input: authority.input,
      constraints: authority.constraints,
      draft: subject.draft,
      constructions: subject.constructions,
      subject: { sha256: replaySha, attempt: 1 },
    });
    const pipeline = broadReviewAllowed ? "ON_PIPELINE" : "OFF_PIPELINE";
    evidence.broad = broad;
    evidence.pipeline = pipeline;

    const rows: ReplayRow[] = [
      { stage: "narrow", mode: "REPLAY", pipeline: "ON_PIPELINE", outcome: narrowStage.outcome },
      { stage: "broad", mode: "REPLAY", pipeline, outcome: "broad_review_executed" },
    ];
    evidence.rows = rows;
    evidence.status = "complete";
    evidence.completedAt = new Date().toISOString();
    persist();

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
  } catch (e) {
    evidence.status = "failed";
    evidence.failingStage = stage;
    evidence.errorClass = e instanceof Error ? e.constructor.name : typeof e;
    evidence.failedAt = new Date().toISOString();
    persist();
    throw e;
  }
}

/** CLI entrypoint. Live output root is fixed; tests drive the library API with an injected root. */
async function main(): Promise<void> {
  const args = parseReplayArgs(process.argv.slice(2));
  const frozen = loadFrozenSubject(args.artifact, args.expectedSha);
  if (frozen.scenarioSha256 !== args.expectedScenarioDigest) {
    throw new Error(`scenario digest mismatch: expected ${args.expectedScenarioDigest}, measured ${frozen.scenarioSha256}`);
  }
  const result = await runFrozenReviewerReplay({ subjectId: args.subject, subject: frozen });
  console.log(`REPLAY ${args.subject} broadReviewAllowed=${result.broadReviewAllowed}`);
  for (const row of result.rows) console.log(`  ${row.stage}: ${row.mode} / ${row.pipeline} ${row.outcome}`);
  console.log(`  evidence: ${evidencePathFor(REPLAY_OUTPUT_ROOT, args.subject)}`);
}

const invokedDirectly = typeof process.argv[1] === "string" && process.argv[1].endsWith("practice-frozen-reviewer-replay.ts");
if (invokedDirectly) {
  void main().catch((e) => {
    console.error(`REPLAY FAILED: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
