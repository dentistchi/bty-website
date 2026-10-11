/**
 * TC CASE ACCEPTANCE FIXTURE — the first Practice with THREE confirmed rules that share a role label.
 *
 * The rules are the three the Founder confirmed for draft 362e424e (Case Acceptance 01), verbatim,
 * with the ids the product derives for them (`constraintId`). The SCENARIOS ARE INVENTED: production
 * does not retain a rejected scenario, so attempt 05480582 cannot be replayed. They reproduce its
 * recorded signature — `vacuous_boundary_compliance` + `missing_boundary_reference` — on natural
 * Treatment Coordinator dialogue.
 *
 * Pure: no I/O, no provider.
 */

import { constraintId } from "./boundary";
import type { ProviderBoundaryGrounding } from "./boundaryGrounding";
import type { ArenaScenarioDraft } from "./types";

const STATEMENTS = [
  "The Treatment Coordinator must not change or reinterpret the dentist's treatment recommendation.",
  "The Treatment Coordinator must not promise insurance coverage that has not been confirmed.",
  "The Treatment Coordinator must not pressure the patient to schedule treatment.",
];

export const TC_RULES = STATEMENTS.map((statement, i) => ({ id: constraintId(i, statement), statement, provenance: "manager_entered" as const }));
export const [TC_CLINICAL, TC_INSURANCE, TC_NO_PRESSURE] = TC_RULES as [(typeof TC_RULES)[number], (typeof TC_RULES)[number], (typeof TC_RULES)[number]];

const OPENING =
  "You are the treatment coordinator. The dentist has just recommended a crown for a cracked molar, and the patient tells you she needs time to think: nothing hurts, and her insurance estimate barely covers the crown. The insurance company has not confirmed coverage yet, and she is already reaching for her coat.";

const ch = (id: string, label: string) => ({ id, label });
const ac = (id: string, label: string, isActionCommitment: boolean) => ({ id, label, isActionCommitment });

/**
 * Natural dialogue in which the no-pressure rule is honoured but never reaches a decision in its own
 * terms: the options say "her" and "the crown", never "the patient" or "treatment". This is the
 * vacuous shape the gate refuses.
 */
export const TC_NATURAL_VACUOUS: ArenaScenarioDraft = {
  title: "The patient who needs to think it over",
  opening: OPENING,
  primary: {
    choices: [
      ch("primary_1", "Ask her what part of the decision feels hardest right now, and listen before explaining anything"),
      ch("primary_2", "Ask whether her hesitation is about cost, timing, or whether the crown is needed, so she can name it"),
    ],
  },
  tradeoff: {
    escalationText: "She asks you directly whether she could just wait a year, since nothing hurts.",
    choices: [
      ch("tradeoff_1", "Tell her that question belongs with the dentist and ask the dentist to step back in for two minutes"),
      ch("tradeoff_2", "Repeat the dentist's recommendation as written and book a short call so the dentist can answer her"),
    ],
  },
  actionDecision: {
    prompt: "What do you do before she leaves?",
    choices: [
      ac("action_1", "Give her the written estimate and agree on a day you will call once the insurance company confirms coverage", true),
      ac("action_2", "Offer a follow-up visit with the dentist and tell her she does not need to schedule the crown today", false),
    ],
  },
  branches: {
    primary_1: {
      resultingWorldState: "She says the real worry is paying for a crown on a tooth that does not hurt.",
      escalationText: "She asks you to promise the insurance will pay at least half.",
      tradeoffChoices: [
        ch("b1_t1", "Tell her the estimate is not confirmed and show her which parts the insurance company still has to review"),
        ch("b1_t2", "Call the insurance company with her now and ask what coverage they will confirm today"),
      ],
      actionDecision: {
        prompt: "What is your next step?",
        choices: [
          ac("b1_a1", "Send the pre-authorization request today and call her when the insurer answers", true),
          ac("b1_a2", "Set a follow-up call in a week and let her decide then whether to schedule", false),
        ],
      },
    },
    primary_2: {
      resultingWorldState: "She says she is not sure the crown is really needed if nothing hurts.",
      escalationText: "She asks whether a filling would do instead.",
      tradeoffChoices: [
        ch("b2_t1", "Ask the dentist to come back and answer that question before she leaves"),
        ch("b2_t2", "Write her question down for the dentist and arrange a short call tomorrow"),
      ],
      actionDecision: {
        prompt: "What is your next step?",
        choices: [
          ac("b2_a1", "Book a ten-minute consult with the dentist so she can decide afterwards", true),
          ac("b2_a2", "Give her the dentist's notes and the estimate to take home, and call in two days", false),
        ],
      },
    },
  },
};

/**
 * The same conversation with ONE natural phrase changed so the no-pressure rule reaches a decision
 * in its own terms ("let the patient decide later whether to schedule"). Every rule is grounded.
 */
export const TC_NATURAL_GROUNDED: ArenaScenarioDraft = {
  ...TC_NATURAL_VACUOUS,
  actionDecision: {
    ...TC_NATURAL_VACUOUS.actionDecision,
    choices: [
      TC_NATURAL_VACUOUS.actionDecision.choices[0]!,
      ac("action_2", "Offer a follow-up visit with the dentist and let the patient decide later whether to schedule", false),
    ],
  },
};

/** A complete, well-formed grounding record for one rule. */
export function tcGrounding(rule: { id: string; statement: string }): ProviderBoundaryGrounding {
  return {
    boundaryId: rule.id,
    boundaryStatement: rule.statement,
    scenarioPresence: "The coordinator's options keep to the stated limit of the role.",
    operationalEffect: "The tempting shortcut is not offered as an option.",
    affectedDecisionStages: ["flat_tradeoff", "flat_action", "branch_tradeoff"],
    prohibitedAlternativeExcluded: "The shortcut the rule forbids.",
    remainingJudgmentDimensions: ["how to ask about the concern", "who answers which question"],
  };
}
