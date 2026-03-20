import type { ArenaScenario, HiddenStat } from "./types";

export const MOCK_SCENARIO_ID = "patient-complaint-revised-estimate" as const;

/** First full scenario — single source for mission prototype. */
export const patientComplaintScenario: ArenaScenario = {
  id: MOCK_SCENARIO_ID,
  stage: "STAGE 1: FORGE",
  caseTag: "PATIENT TRUST",
  title: "Patient Complaint: Revised Estimate",
  difficulty: "Moderate",
  description: [
    "The patient believes the final estimate is higher than previously explained.",
    "Front desk and clinical explanations are not aligned.",
    "You need to respond before trust drops further.",
  ],
  primaryChoices: [
    {
      id: "A",
      label: "A",
      title: "Clarify the updated treatment rationale and rebuild trust first.",
      subtitle: "Restore explanation before policy enforcement.",
    },
    {
      id: "B",
      label: "B",
      title: "Re-anchor the conversation in office policy and fee structure.",
      subtitle: "Protect process consistency under pressure.",
    },
    {
      id: "C",
      label: "C",
      title: "De-escalate the emotion first and schedule a focused follow-up.",
      subtitle: "Reduce emotional heat before detailed correction.",
    },
  ],
  reinforcementChoices: [
    {
      id: "X",
      label: "X",
      title: "Protect long-term relationship stability.",
    },
    {
      id: "Y",
      label: "Y",
      title: "Protect immediate operational consistency.",
    },
  ],
  outcomes: {
    A_X: {
      interpretation: [
        "System detected relational stabilization under pressure.",
        "Explanation clarity was prioritized before policy defense.",
        "Trust recovery path remains open.",
      ],
      activatedStats: ["Communication", "Integrity"] satisfies HiddenStat[],
      systemMessage: "SYSTEM // Relational stability prioritized.",
      traits: {
        Communication: 0.82,
        Integrity: 0.74,
        Insight: 0.62,
      },
      meta: {
        relationalBias: 0.9,
        operationalBias: 0.22,
        emotionalRegulation: 0.72,
      },
    },
    A_Y: {
      interpretation: [
        "System detected controlled explanation with operational framing.",
        "Trust was preserved while maintaining structural clarity.",
        "Relational friction remains manageable.",
      ],
      activatedStats: ["Communication", "Insight"] satisfies HiddenStat[],
      systemMessage: "SYSTEM // Operational consistency preserved under tension.",
      traits: {
        Communication: 0.78,
        Insight: 0.76,
        Integrity: 0.58,
      },
      meta: {
        relationalBias: 0.55,
        operationalBias: 0.68,
        emotionalRegulation: 0.65,
      },
    },
    B_X: {
      interpretation: [
        "System detected policy-first containment with softened relational intent.",
        "Process clarity was maintained without fully restoring emotional trust.",
        "Relationship recovery remains possible but delayed.",
      ],
      activatedStats: ["Integrity", "Resilience"] satisfies HiddenStat[],
      systemMessage: "SYSTEM // Policy clarity held under pressure.",
      traits: {
        Integrity: 0.8,
        Resilience: 0.7,
        Communication: 0.48,
      },
      meta: {
        relationalBias: 0.52,
        operationalBias: 0.72,
        emotionalRegulation: 0.58,
      },
    },
    B_Y: {
      interpretation: [
        "System detected strong operational anchoring.",
        "Immediate consistency was preserved, but relational flexibility narrowed.",
        "Escalation risk remains contained for now.",
      ],
      activatedStats: ["Integrity", "Insight"] satisfies HiddenStat[],
      systemMessage: "SYSTEM // Operational boundary reinforced.",
      traits: {
        Integrity: 0.85,
        Insight: 0.72,
        Resilience: 0.55,
      },
      meta: {
        relationalBias: 0.35,
        operationalBias: 0.88,
        emotionalRegulation: 0.6,
      },
    },
    C_X: {
      interpretation: [
        "System detected emotional de-escalation before structural correction.",
        "Immediate tension lowered, preserving trust bandwidth.",
        "Resolution path remains open but requires follow-through.",
      ],
      activatedStats: ["Resilience", "Communication"] satisfies HiddenStat[],
      systemMessage: "SYSTEM // Emotional pressure reduced without rupture.",
      traits: {
        Resilience: 0.84,
        Communication: 0.7,
        Gratitude: 0.55,
      },
      meta: {
        relationalBias: 0.78,
        operationalBias: 0.4,
        emotionalRegulation: 0.8,
      },
    },
    C_Y: {
      interpretation: [
        "System detected controlled delay for operational regrouping.",
        "Tension was lowered while preserving procedural order.",
        "A second conversation will determine stability.",
      ],
      activatedStats: ["Resilience", "Insight"] satisfies HiddenStat[],
      systemMessage: "SYSTEM // Tension contained pending structured follow-up.",
      traits: {
        Resilience: 0.76,
        Insight: 0.68,
        Communication: 0.52,
      },
      meta: {
        relationalBias: 0.48,
        operationalBias: 0.75,
        emotionalRegulation: 0.7,
      },
    },
  },
};

/** Stable alias for imports that expect `MOCK_SCENARIO`. */
export const MOCK_SCENARIO = patientComplaintScenario;

export function getScenarioById(id: string): ArenaScenario | null {
  if (id === patientComplaintScenario.id) return patientComplaintScenario;
  return null;
}

/**
 * TopBar extras not yet on ArenaScenario — use with loaded scenario until schema extends.
 */
export const DEFAULT_ARENA_MISSION_TOP_BAR = {
  level: "LEVEL 21",
  codename: "STILLWATER",
  progress: 63,
} as const;
