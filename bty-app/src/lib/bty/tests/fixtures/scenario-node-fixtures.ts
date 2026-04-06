/**
 * Minimal fixtures for `scenario-node-validator` tests only — not legacy scenario schema.
 */

import type { ScenarioNode } from "../../scenario-node-validator";

const impactA = {
  reputation: 1,
  trust: 0,
  self_narrative: -1,
  courage: 0,
} as const;

const impactB = {
  reputation: 0,
  trust: 1,
  self_narrative: 0,
  courage: -1,
} as const;

const impactC = {
  reputation: -1,
  trust: -1,
  self_narrative: 1,
  courage: 1,
} as const;

/** Passes `validateScenarioNode` (may still emit warnings only). */
export const validChainNodeStage3: ScenarioNode = {
  id: "fixture-valid-stage3",
  title: "Cross-team deadline collision",
  level: 3,
  chain_stage: 3,
  context: {
    role: "Engineering lead between product and infrastructure",
    pressure: "Release train leaves Friday; infra needs a freeze your team keeps breaking",
    narrative:
      "Two directors already escalated to your skip-level after last sprint's outage. The product roadmap still demands one risky migration before Friday. Your peers are watching whether you will protect stability or ship, and the relationship between teams is not fully repaired after the blame thread in Slack last month.",
  },
  choices: [
    {
      id: "A",
      label:
        "Pause the migration for this release cycle and document the rollback criteria your team will use before touching prod databases again.",
      archetype: "avoid",
      state_impact: { ...impactA },
    },
    {
      id: "B",
      label:
        "Publish a shared cut list with dates, owners, and test gates so both teams sign the same contract before any schema change lands.",
      archetype: "structure",
      state_impact: { ...impactB },
    },
    {
      id: "C",
      label:
        "Call a working session tonight with both directors present and force a single decision recorded in the incident doc everyone already distrusts.",
      archetype: "confront",
      state_impact: { ...impactC },
    },
  ],
  questions: {
    level_1: "What facts about timing and ownership are still unclear to each side?",
    level_2: "Who outside this conflict quietly absorbed extra work last sprint?",
    level_3: "Where does telling the cleaner story conflict with protecting someone weaker?",
  },
};

/** Invalid: wrong number of choices. */
export const invalidWrongChoiceCount: ScenarioNode = {
  ...validChainNodeStage3,
  id: "fixture-invalid-choice-count",
  choices: validChainNodeStage3.choices.slice(0, 2),
};

/** Invalid: generic phrase in choice label. */
export const invalidGenericChoiceLabel: ScenarioNode = {
  ...validChainNodeStage3,
  id: "fixture-invalid-generic-label",
  choices: [
    {
      ...validChainNodeStage3.choices[0],
      label:
        "We should take ownership of the cut list and publish dates before Friday so everyone sees the same plan.",
    },
    validChainNodeStage3.choices[1],
    validChainNodeStage3.choices[2],
  ],
};

/** Invalid: level 5 without level_5 question. */
export const invalidLevel5MissingQuestion: ScenarioNode = {
  ...validChainNodeStage3,
  id: "fixture-invalid-level5-missing",
  level: 5,
  questions: {
    ...validChainNodeStage3.questions,
    level_5: undefined,
  },
};
