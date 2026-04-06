/**
 * Minimal valid `Scenario` for Elite arena (matches `eliteScenarioToScenario` shape for `core_01_training_system`).
 * Used only by Playwright to override session-router JSON — not imported by app code.
 *
 * **Escalation path (default `FORCED_ELITE_SCENARIO`):** `escalationBranches` A/B drive step 3 (`elite-escalation-step`) and
 * step 4 (`elite-forced-tradeoff-step` with `elite-forced-tradeoff-X` / `elite-forced-tradeoff-Y`). Second-choice lock: after
 * one pick, the other option disables (`EliteForcedTradeoffStep`).
 *
 * **No branches:** `FORCED_ELITE_SCENARIO_LEGACY_NO_ESCALATION` omits `escalationBranches`. The app’s
 * `ElitePostChoiceFlow` then shows **`elite-v2-runtime-error-escalation_not_configured`** at step 3 (legacy stance UI
 * removed); E2E treats this as `elite-v2-escalation-blocked`.
 */
import type { EscalationBranch, Scenario } from "../../src/lib/bty/scenario/types";

const narrativeBody = [
  "Regional Director",
  "Two front-desk staff failed Medicaid eligibility verification three times this week. The office manager wants to write them up. You know onboarding was cut from 5 days to 2 due to volume pressure. Corporate is asking for accountability documentation.",
  "Writing them up protects your metrics and satisfies corporate. Defending them requires you to implicate the system — and your own earlier compliance with the onboarding cut.",
].join("\n\n");

/**
 * A/B branches only — matches `bty_elite_scenarios_v2.json` `core_01_training_system.escalationBranches` for those keys
 * (production has C/D as well; e2e keeps two branches for a minimal forced surface).
 */
const CORE_01_TRADEOFF_COST =
  "Writing them up protects your metrics and satisfies corporate. Defending them requires you to implicate the system — and your own earlier compliance with the onboarding cut.";

/** Kept in sync with `src/data/bty_elite_scenarios_v2.json` → `core_01_training_system.escalationBranches` A/B. */
export const FORCED_ELITE_ESCALATION_BRANCHES: Record<"A" | "B", EscalationBranch> = {
  A: {
    escalation_text:
      "Immediate fallout: others react to the move you just made. Two front-desk staff failed Medicaid eligibility verification three times this week. The office manager wants to write them up. You know onboarding was cut from 5 days to 2 due to volume pressure. Corporate is asking for accountability documentation.",
    pressure_increase: 0.55,
    second_choices: [
      {
        id: "X",
        label:
          "Protect runway: defer a public stake while you confirm facts, document, and control timing — accepting that the issue stays live.",
        cost: `You limit exposure today; the underlying tension remains: ${CORE_01_TRADEOFF_COST}`,
        pattern_family: "future_deferral",
        direction: "exit",
      },
      {
        id: "Y",
        label:
          "Engage directly: name the tension with the people involved before the story hardens without you — accepting short-term heat.",
        cost: `You invite immediate friction; the same trade-off is still in play: ${CORE_01_TRADEOFF_COST}`,
        pattern_family: "repair_avoidance",
        direction: "entry",
      },
    ],
  },
  B: {
    escalation_text:
      "Your stance is visible to people who were not in the room when you decided. Two front-desk staff failed Medicaid eligibility verification three times this week. The office manager wants to write them up. You know onboarding was cut from 5 days to 2 due to volume pressure. Corporate is asking for accountability documentation.",
    pressure_increase: 0.6,
    second_choices: [
      {
        id: "X",
        label:
          "Protect runway: defer a public stake while you confirm facts, document, and control timing — accepting that the issue stays live.",
        cost: `You limit exposure today; the underlying tension remains: ${CORE_01_TRADEOFF_COST}`,
        pattern_family: "future_deferral",
        direction: "exit",
      },
      {
        id: "Y",
        label:
          "Engage directly: name the tension with the people involved before the story hardens without you — accepting short-term heat.",
        cost: `You invite immediate friction; the same trade-off is still in play: ${CORE_01_TRADEOFF_COST}`,
        pattern_family: "repair_avoidance",
        direction: "entry",
      },
    ],
  },
};

const FORCED_ELITE_SCENARIO_BASE = {
  scenarioId: "core_01_training_system",
  title: "The System Never Trained Them — But We're Blaming Them Anyway",
  context: narrativeBody,
  choices: [
    {
      choiceId: "A" as const,
      label:
        "Commit to Blame: put this pole first in what you do next, even if it costs rapport today.",
      intent: "primary_A",
      xpBase: 35,
      difficulty: 1,
      hiddenDelta: {
        integrity: 0,
        communication: 0,
        insight: 0,
        resilience: 0,
        gratitude: 0,
      },
      result: "Your choice is recorded. Continue building leadership habits in the next interaction.",
      microInsight: "Theme: primary_A",
      followUp: { enabled: false },
    },
    {
      choiceId: "B" as const,
      label:
        "Commit to Structural Honesty: put this pole first in what you do next, even if it exposes you to pushback.",
      intent: "primary_B",
      xpBase: 43,
      difficulty: 1,
      hiddenDelta: {
        integrity: 0,
        communication: 0,
        insight: 0,
        resilience: 0,
        gratitude: 0,
      },
      result: "Your choice is recorded. Continue building leadership habits in the next interaction.",
      microInsight: "Theme: primary_B",
      followUp: { enabled: false },
    },
  ],
  coachNotes: {
    whatThisTrains: ["insight" as const],
    whyItMatters: "Elite scenario — practice structural honesty under DSO operational pressure.",
  },
  elite_only: true,
  eliteSetup: {
    role: "Regional Director",
    pressure:
      "Two front-desk staff failed Medicaid eligibility verification three times this week. The office manager wants to write them up. You know onboarding was cut from 5 days to 2 due to volume pressure. Corporate is asking for accountability documentation.",
    tradeoff:
      "Writing them up protects your metrics and satisfies corporate. Defending them requires you to implicate the system — and your own earlier compliance with the onboarding cut.",
  },
  difficulty_level: 3 as const,
} satisfies Omit<Scenario, "escalationBranches">;

/** Default forced scenario: includes A/B escalation (step 3 situation update + step 4 forced trade-off). */
export const FORCED_ELITE_SCENARIO: Scenario = {
  ...FORCED_ELITE_SCENARIO_BASE,
  escalationBranches: FORCED_ELITE_ESCALATION_BRANCHES,
};

/**
 * Same narrative and choices, but **no** `escalationBranches` — step 3 renders v2 runtime error (see file header).
 * Use with `installForcedEliteSessionRouter` to assert that path in E2E.
 */
export const FORCED_ELITE_SCENARIO_LEGACY_NO_ESCALATION: Scenario = {
  ...FORCED_ELITE_SCENARIO_BASE,
};
