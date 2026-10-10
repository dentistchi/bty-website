/**
 * TWO-RULE BOUNDARY FIXTURE — the first Practice shape with more than one active rule.
 *
 * The rules are the two confirmed for "Opening the Office Safely" (draft af921b9d), verbatim. The
 * SCENARIO IS INVENTED and representative only: production does not retain generated scenarios, so
 * the attempt that failed (73f54c71) cannot be replayed. Every surface still mentions the rules'
 * clauses, so both rules receive evidence candidates on the same surfaces — which is the condition
 * that matters.
 *
 * `perfectAssessments` is what a reviewer that answers CORRECTLY would send: for every rule and
 * surface, a canonical state whose candidate ids come from THAT rule's own menu.
 *
 * Pure: no I/O, no provider.
 */

import { buildNarrowBoundarySubject, type NarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { enumerateBoundarySurfaces } from "./boundarySurfaces";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { poolFor } from "./boundaryEvidenceCandidates";
import { TRUTH_STATES, classifyTruthState } from "./boundaryTruthStates";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import type { BoundaryTruthAssessment, NarrowReviewContext } from "./narrowBoundaryReview";
import type { ArenaScenarioDraft } from "./types";

export const TWO_RULE_BOUNDARIES = [
  {
    id: "c1_the-opening-employee-com",
    statement:
      "The opening employee completes the readiness check and reports a missing or expired emergency item to the office manager before patient care begins.",
  },
  {
    id: "c2_the-office-manager-is-to",
    statement: "The office manager is told about a missing or expired emergency item before the first patient is seated, not after.",
  },
];

const ch = (id: string, label: string) => ({ id, label });
const ac = (id: string, label: string, isActionCommitment: boolean) => ({ id, label, isActionCommitment });

export const TWO_RULE_SCENARIO: ArenaScenarioDraft = {
  title: "The kit check before the first patient",
  opening:
    "You are opening the office. During the readiness check you find the emergency oxygen mask is expired. The first patient is already in the waiting room and the office manager has not arrived yet; patient care cannot begin until the office manager is told.",
  primary: {
    choices: [
      ch("p1", "Call the office manager now to report the expired mask before the first patient is seated"),
      ch("p2", "Finish the rest of the readiness check first, then report the expired mask to the office manager before patient care begins"),
    ],
  },
  tradeoff: { escalationText: "The patient asks why they are still waiting.", choices: [ch("ft1", "Explain plainly that a safety item is being replaced"), ch("ft2", "Offer the patient a later time this morning")] },
  actionDecision: { prompt: "What do you do next?", choices: [ac("fa1", "Log the expired mask in the opening checklist now", true), ac("fa2", "Wait at the front desk for the office manager's decision", false)] },
  branches: {
    p1: {
      resultingWorldState: "The office manager was told about the expired mask before the first patient was seated and is ten minutes away.",
      escalationText: "The first patient's daughter asks to start without the mask.",
      tradeoffChoices: [ch("b1t1", "Keep the first patient waiting until the office manager decides"), ch("b1t2", "Move the first patient to a later slot")],
      actionDecision: { prompt: "What now?", choices: [ac("b1a1", "Write the expired item in the log now", true), ac("b1a2", "Prepare the operatory while you wait", false)] },
    },
    p2: {
      resultingWorldState: "You finished the readiness check; the office manager has not been told yet and the first patient is ready to be seated.",
      escalationText: "The hygienist asks to seat the first patient now.",
      tradeoffChoices: [ch("b2t1", "Report the expired mask to the office manager before the patient is seated"), ch("b2t2", "Ask the hygienist to wait while you reach the office manager")],
      actionDecision: { prompt: "What now?", choices: [ac("b2a1", "Call the office manager now", true), ac("b2a2", "Text the office manager and wait for a reply", false)] },
    },
  },
};

export const TWO_RULE_REASON = "the surface states the report was made before the patient was seated";

export function twoRuleSubject(boundaries = TWO_RULE_BOUNDARIES): NarrowBoundarySubject {
  return buildNarrowBoundarySubject({
    scenarioSha256: "s".repeat(64),
    reviewSubjectSha256: "r".repeat(64),
    boundaryProvenance: { activeBoundaryIds: boundaries.map((b) => b.id) } as never,
    boundaryProvenanceSha256: "p".repeat(64),
    boundaries,
    surfaces: enumerateBoundarySurfaces(TWO_RULE_SCENARIO, {}),
    draft: TWO_RULE_SCENARIO,
    language: "en",
    generationAttemptId: "g1",
    caseId: "two-rule",
  });
}

export function twoRuleContext(subject: NarrowBoundarySubject, boundaries = TWO_RULE_BOUNDARIES): NarrowReviewContext {
  return { boundaries, surfaces: subject.surfaces, frames: buildSemanticFrames(boundaries), candidates: subject.evidenceCandidates };
}

export const twoRuleDigests = (subject: NarrowBoundarySubject) => ({
  boundaryReviewSubjectSha256: subject.evidenceCandidateMapSha256,
  surfaceMapSha256: subject.surfaceMapSha256,
  lineageSha256: subject.lineageSha256,
});

/**
 * The CORRECT answer for every (rule, surface): a canonical state that cites evidence from that
 * rule's own pool, preferring a SETTLED state that cites a governed-action candidate — the field the
 * collision reaches.
 */
export function perfectAssessments(subject: NarrowBoundarySubject, boundaries = TWO_RULE_BOUNDARIES): BoundaryTruthAssessment[] {
  const rows: BoundaryTruthAssessment[] = [];
  const refs = subject.surfaces.map((s) => s.coordinate);
  for (const b of boundaries) {
    for (const surfaceRef of refs) {
      let preferred: BoundaryTruthAssessment | null = null;
      let fallback: BoundaryTruthAssessment | null = null;
      let last: BoundaryTruthAssessment | null = null;
      for (const st of TRUTH_STATES) {
        for (const p of st.prerequisiteStatus) {
          for (const t of st.temporalRelation) {
            const r = classifyTruthState({ governedActionStatus: st.governedActionStatus, prerequisiteStatus: p, temporalRelation: t } as never, "prerequisite_before_action");
            if (!r || r.id !== st.id) continue;
            const pick = (req: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
              req === "required" ? poolFor(subject.evidenceCandidates, b.id, surfaceRef, role)[0]?.candidateId : NO_CANDIDATE;
            const g = pick(st.governedActionCandidate, "governed_action");
            const sa = pick(st.satisfactionCandidate, "prerequisite_satisfaction");
            const fa = pick(st.failureCandidate, "prerequisite_failure");
            if (g === undefined || sa === undefined || fa === undefined) continue;
            const row = {
              boundaryId: b.id,
              surfaceRef,
              governedActionStatus: st.governedActionStatus,
              prerequisiteStatus: p,
              temporalRelation: t,
              governedActionCandidateId: g,
              prerequisiteSatisfactionCandidateId: sa,
              prerequisiteFailureCandidateId: fa,
              reason: st.reasonAuthority === "model_required" ? TWO_RULE_REASON : "",
            } as BoundaryTruthAssessment;
            // A real reviewer settles what the text settles: prefer a settled state that cites evidence.
            if (st.verdictEffect === "settled" && st.governedActionCandidate === "required") preferred = preferred ?? row;
            else if (st.verdictEffect === "settled") fallback = fallback ?? row;
            else last = last ?? row;
          }
        }
      }
      const chosen = preferred ?? fallback ?? last;
      if (chosen) rows.push(chosen);
    }
  }
  return rows;
}
