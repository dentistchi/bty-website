/**
 * BTY FOUNDRY LAB — deterministic evaluation (M0). Pure: same input, same output, no I/O.
 *
 * LAYER A — the Arena's EXISTING authority, called, never restated:
 *   program_validation  `generateProgram` → `validateProgramProposal` (shape, behaviour contract,
 *                       evidence policy, grounding, dependencies, scenario/application contracts)
 *   review_gate         `validateEditedReview` — the gate ProgramAuthorship's automatic adoption
 *                       applies before it adopts anything (`reviewBlock`)
 *   journey_valid       `applyProgramProposal` with the automatic path's own choices, then
 *                       `validateJourney`
 *   journey_complete    `missingProgramKinds` — the predicate Publish uses
 *   journey_approvable  `isJourneyApprovable` — INFORMATIONAL: on the automatic path every section
 *                       still awaits Host confirmation, so this is expected to be false and is
 *                       never counted as a failure
 *
 * LAYER B — Foundry's product-quality vector. Where an existing gate already decides a dimension,
 * the dimension is MAPPED to it (source `existing:…`) rather than re-implemented. The few that are
 * new are explicit heuristics with a version (source `foundry:…@v1`), so a later change to a rule
 * is visible in every report that used it.
 *
 * NO FAKE SCORE. The only aggregate is `passed / evaluated`, reported next to the vector it came
 * from. NOT_EVALUATED (no program was produced) is never counted as a pass or a fail.
 */
import {
  applyProgramProposal,
  contractsFromProposal,
  deriveInstructionalContent,
  initialSectionDecisions,
  missingProgramKinds,
  overlapRatio,
  requiredProgramKinds,
  validateEditedReview,
  type ProgramProposal,
  type SectionChoice,
} from "@/domain/foundry/module/program-authorship";
import { isJourneyApprovable, validateJourney, type JourneyElementKind } from "@/domain/foundry/module/journey";
import { effectiveFollowUpDays } from "@/domain/foundry/module/module-builder";
import { isObservableStandardShape } from "@/domain/foundry/module/observableStandardShape";
import { assertsOverclaimByPolicy } from "@/domain/foundry/module/evidence-policy";
import { containsInternalTerminology } from "@/domain/foundry/module/direction-copilot";
import { isResponseMode, isVerificationTarget, validateApplicationContract } from "@/domain/foundry/module/program-coherence";
import type { BenchmarkCase } from "./manifest";
import type { GenerationOutcome } from "./adapter";

export const EVALUATOR_VERSION = "foundry_arena_eval_v1";

export type GateStatus = "PASS" | "FAIL" | "NOT_EVALUATED";
export type Gate = { status: GateStatus; source: string; detail?: string };

export const LAYER_B_DIMENSIONS = [
  "structure",
  "observable_action",
  "measurable_completion",
  "application_realism",
  "coherent_progression",
  "trainee_clarity",
  "manager_usability",
  "no_filler_repetition",
  "evidence_honesty",
  "internal_coherence",
] as const;
export type LayerBDimension = (typeof LAYER_B_DIMENSIONS)[number];

export type Evaluation = {
  evaluator_version: string;
  layer_a: {
    program_validation: Gate;
    review_gate: Gate;
    journey_valid: Gate;
    journey_complete: Gate;
    journey_approvable: Gate & { informational: true };
  };
  layer_b: Record<LayerBDimension, Gate>;
  /** Transparent aggregate over Layer B only: evaluated dimensions and how many passed. */
  layer_b_summary: { evaluated: number; passed: number; failed: LayerBDimension[]; all_pass: boolean | null };
};

const pass = (source: string, detail?: string): Gate => ({ status: "PASS", source, ...(detail ? { detail } : {}) });
const fail = (source: string, detail?: string): Gate => ({ status: "FAIL", source, ...(detail ? { detail } : {}) });
const notEvaluated = (source: string, detail = "no_program"): Gate => ({ status: "NOT_EVALUATED", source, detail });
const gate = (ok: boolean, source: string, detail?: string): Gate => (ok ? pass(source) : fail(source, detail));

/** Heuristic thresholds for the new (foundry:) dimensions. Versioned with EVALUATOR_VERSION. */
export const HEURISTICS = {
  maxWordsPerSentence: 40,
  maxTitleChars: 80,
  maxSectionOverlap: 0.8,
} as const;

const sentences = (text: string) => text.split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

/** The journey ProgramAuthorship's automatic path would adopt: `use` for every section, rendered text. */
export function autoAdoptedJourney(c: BenchmarkCase, proposal: ProgramProposal) {
  const contracts = contractsFromProposal(
    proposal,
    effectiveFollowUpDays(c.answers),
    c.answers.problem ?? "",
    (c.answers as { completionPrompt?: string | null }).completionPrompt ?? null,
    c.answers,
    [],
    c.locale,
  );
  const decisions = initialSectionDecisions(undefined, proposal);
  const choices: SectionChoice[] = proposal.elements.map((e) =>
    decisions[e.kind] === "keep"
      ? { kind: e.kind, decision: "keep" }
      : { kind: e.kind, decision: "use", editedContent: (contracts ? deriveInstructionalContent(e.kind, contracts) : null) ?? e.content },
  );
  const journey = applyProgramProposal(undefined, proposal, choices, { titleDecision: "use" });
  return { contracts, journey };
}

export function evaluate(c: BenchmarkCase, outcome: GenerationOutcome): Evaluation {
  const V = "existing:validateProgramProposal";
  if (!outcome.ok || !outcome.proposal) {
    const reason = outcome.final_refusal_code ?? outcome.final_error_code ?? "no_program";
    const layerB = Object.fromEntries(LAYER_B_DIMENSIONS.map((d) => [d, notEvaluated(`dimension:${d}`)])) as Record<LayerBDimension, Gate>;
    return {
      evaluator_version: EVALUATOR_VERSION,
      layer_a: {
        program_validation: fail(V, reason),
        review_gate: notEvaluated("existing:validateEditedReview"),
        journey_valid: notEvaluated("existing:applyProgramProposal+validateJourney"),
        journey_complete: notEvaluated("existing:missingProgramKinds"),
        journey_approvable: { ...notEvaluated("existing:isJourneyApprovable"), informational: true },
      },
      layer_b: layerB,
      layer_b_summary: { evaluated: 0, passed: 0, failed: [], all_pass: null },
    };
  }

  const p = outcome.proposal;
  const { contracts, journey } = autoAdoptedJourney(c, p);
  const kinds = p.elements.map((e) => e.kind);
  // No contracts (a pre-v4 proposal): ProgramAuthorship applies no review block, and neither do we.
  const review = contracts ? validateEditedReview(contracts, kinds, {}, c.answers) : null;
  const journeyErrors = validateJourney(journey);
  const missing = missingProgramKinds(c.answers, journey);
  const content = (k: JourneyElementKind) => journey.elements.find((e) => e.kind === k)?.content ?? "";
  const allText = journey.elements.map((e) => e.content ?? "");

  const layerA: Evaluation["layer_a"] = {
    program_validation: pass(V),
    review_gate: !review
      ? notEvaluated("existing:validateEditedReview", "proposal_has_no_contracts")
      : review.ok
        ? pass("existing:validateEditedReview")
        : fail("existing:validateEditedReview", `${review.reason}:${review.kind}`),
    journey_valid: gate(journeyErrors.length === 0, "existing:applyProgramProposal+validateJourney", journeyErrors.join(",")),
    journey_complete: gate(missing.length === 0, "existing:missingProgramKinds", missing.join(",")),
    journey_approvable: { ...gate(isJourneyApprovable(journey), "existing:isJourneyApprovable", "sections_await_host_confirmation"), informational: true },
  };

  // ---- Layer B -------------------------------------------------------------------------------
  const standard = content("observable_standard");
  const completion = p.completionContract as { verificationTarget?: unknown; responseMode?: unknown } | null | undefined;
  const behavior = p.behaviorContract as { trigger?: string } | null | undefined;
  const application = validateApplicationContract(p.applicationContract, behavior?.trigger);

  const order = requiredProgramKinds(c.answers);
  const positions = order.map((k) => kinds.indexOf(k)).filter((i) => i >= 0);
  const inOrder = positions.every((v, i) => i === 0 || v > positions[i - 1]);

  const longSentence = allText.flatMap(sentences).find((s) => wordCount(s) > HEURISTICS.maxWordsPerSentence);
  const jargonSection = journey.elements.find((e) => containsInternalTerminology(e.content ?? ""));
  const title = (journey.displayTitle ?? p.displayTitle ?? "").trim();

  let maxOverlap = 0;
  let overlapPair = "";
  for (let i = 0; i < journey.elements.length; i++) {
    for (let j = i + 1; j < journey.elements.length; j++) {
      const r = overlapRatio(journey.elements[i].content ?? "", journey.elements[j].content ?? "");
      if (r > maxOverlap) { maxOverlap = r; overlapPair = `${journey.elements[i].kind}~${journey.elements[j].kind}`; }
    }
  }
  const sentenceList = allText.flatMap(sentences).map((s) => s.toLowerCase());
  const duplicateSentence = sentenceList.find((s, i) => s.length > 20 && sentenceList.indexOf(s) !== i);
  const overclaim = allText.map((t) => assertsOverclaimByPolicy(t)).find(Boolean);

  const layerB: Record<LayerBDimension, Gate> = {
    structure: { ...layerA.journey_complete, source: "existing:missingProgramKinds" },
    observable_action: gate(!!standard && isObservableStandardShape(standard), "existing:validateProgramProposal(behavior_contract)+isObservableStandardShape", standard ? "standard_is_a_question" : "standard_missing"),
    measurable_completion: gate(
      kinds.includes("completion_check") && !!completion && isVerificationTarget(completion.verificationTarget) && isResponseMode(completion.responseMode),
      "existing:isVerificationTarget+isResponseMode",
      "completion_contract_invalid_or_missing",
    ),
    application_realism: gate(application.ok, "existing:validateApplicationContract", application.ok ? undefined : `${application.defect.field}:${application.defect.reason}`),
    coherent_progression: gate(inOrder, "foundry:canonical_section_order@v1", "sections_out_of_canonical_order"),
    trainee_clarity: gate(!longSentence && !jargonSection, "foundry:sentence_length@v1+existing:containsInternalTerminology", longSentence ? "sentence_over_limit" : jargonSection ? `internal_terminology:${jargonSection.kind}` : undefined),
    manager_usability: gate(
      title.length > 0 && title.length <= HEURISTICS.maxTitleChars && !containsInternalTerminology(title),
      "foundry:title_usable@v1+existing:containsInternalTerminology",
      title.length === 0 ? "title_missing" : title.length > HEURISTICS.maxTitleChars ? "title_too_long" : "title_internal_terminology",
    ),
    no_filler_repetition: gate(maxOverlap < HEURISTICS.maxSectionOverlap && !duplicateSentence, "foundry:section_overlap@v1+existing:overlapRatio", duplicateSentence ? "duplicate_sentence" : `overlap:${overlapPair}:${maxOverlap.toFixed(2)}`),
    evidence_honesty: gate(!overclaim, "existing:validateProgramProposal(evidence_policy)+assertsOverclaimByPolicy(adopted_text)", overclaim ? `overclaim:${(overclaim as { id?: string }).id ?? "rule"}` : undefined),
    internal_coherence: !review
      ? notEvaluated("existing:validateProgramProposal(dependencies)+validateEditedReview", "proposal_has_no_contracts")
      : gate(review.ok, "existing:validateProgramProposal(dependencies)+validateEditedReview", review.ok ? undefined : `${review.reason}:${review.kind}`),
  };

  const evaluated = LAYER_B_DIMENSIONS.filter((d) => layerB[d].status !== "NOT_EVALUATED");
  const failed = evaluated.filter((d) => layerB[d].status === "FAIL");
  return {
    evaluator_version: EVALUATOR_VERSION,
    layer_a: layerA,
    layer_b: layerB,
    layer_b_summary: { evaluated: evaluated.length, passed: evaluated.length - failed.length, failed, all_pass: failed.length === 0 },
  };
}
