/**
 * Official chain-workspace → elite runtime payload projection (3 active scenarios only).
 *
 * Source of truth: `src/data/bty_chain_workspace/Chains/<Folder>/{S1_anchor,S2_consequence,S3_identity}.json`
 * Target shape: {@link EliteScenario} (same contract as `bty_elite_scenarios_v2.json`).
 *
 * This is a full rebuild per id — not a partial patch onto bundled rows — so no legacy narrative
 * can leak through spread/merge.
 */

import chainSourceIndex from "@/data/bty_chain_workspace/source_scenarios_index.json";
import s1_01 from "@/data/bty_chain_workspace/Chains/Core_01_training_system/S1_anchor.json";
import s2_01 from "@/data/bty_chain_workspace/Chains/Core_01_training_system/S2_consequence.json";
import s3_01 from "@/data/bty_chain_workspace/Chains/Core_01_training_system/S3_identity.json";
import s1_06 from "@/data/bty_chain_workspace/Chains/Core_06_lead_assistant/S1_anchor.json";
import s2_06 from "@/data/bty_chain_workspace/Chains/Core_06_lead_assistant/S2_consequence.json";
import s3_06 from "@/data/bty_chain_workspace/Chains/Core_06_lead_assistant/S3_identity.json";
import s1_11 from "@/data/bty_chain_workspace/Chains/Core_11_staffing_collapse/S1_anchor.json";
import s2_11 from "@/data/bty_chain_workspace/Chains/Core_11_staffing_collapse/S2_consequence.json";
import s3_11 from "@/data/bty_chain_workspace/Chains/Core_11_staffing_collapse/S3_identity.json";
import type {
  ActionDecisionBlock,
  EscalationBranch,
  SecondChoice,
} from "@/domain/arena/scenarios/types";
import type { EliteScenario } from "./eliteScenariosCanonical.server";

export const CHAIN_WORKSPACE_ELITE_IDS = [
  "core_01_training_system",
  "core_06_lead_assistant",
  "core_11_staffing_collapse",
] as const;

export type ChainWorkspaceEliteId = (typeof CHAIN_WORKSPACE_ELITE_IDS)[number];

type ChainStage = {
  id: string;
  title: string;
  context: { role: string; pressure: string; narrative: string };
  choices?: Array<{ id: string; label: string; archetype?: string }>;
};

const ESCALATION_PREFIX: Record<"A" | "B" | "C" | "D", string> = {
  A: "Immediate fallout: others react to the move you just made",
  B: "Your stance is visible to people who were not in the room when you decided",
  C: "Competing priorities collide before you can stabilize the narrative",
  D: "What you avoided is now the next decision that will not stay private",
};

const PRESSURE_INCREASE: Record<"A" | "B" | "C" | "D", number> = {
  A: 0.55,
  B: 0.6,
  C: 0.58,
  D: 0.62,
};

const LABEL_PROTECT_RUNWAY =
  "Protect runway: defer a public stake while you confirm facts, document, and control timing — accepting that the issue stays live.";
const LABEL_ENGAGE_DIRECT =
  "Engage directly: name the tension with the people involved before the story hardens without you — accepting short-term heat.";

function defaultActionDecisionBlock(scenarioId: string): ActionDecisionBlock {
  return {
    prompt:
      "Before anything else is scheduled, decide what you will do in the real world about this situation — not how you feel about it.",
    promptKo:
      "다음 일정이 잡히기 전에, 이 상황에 대해 실제로 무엇을 할지 — 기분이 아니라 행동으로 — 결정하세요.",
    choices: [
      {
        id: "COMMIT_ACT",
        label: "Take a concrete step (named action, time window, and channel).",
        commitment: "You are choosing visible follow-through over indefinite preparation.",
        dbChoiceId: `${scenarioId}:action_decision:COMMIT_ACT`,
        meaning: { is_action_commitment: true },
      },
      {
        id: "HOLD_BOUNDARY",
        label: "Do not act yet; hold a clear boundary and schedule a specific check-in.",
        commitment: "You are choosing containment and timing over impulse or avoidance.",
        dbChoiceId: `${scenarioId}:action_decision:HOLD_BOUNDARY`,
        meaning: { is_action_commitment: false },
      },
    ],
  };
}

function secondTierChoices(tradeoff: string): [SecondChoice, SecondChoice] {
  const x: SecondChoice = {
    id: "X",
    label: LABEL_PROTECT_RUNWAY,
    cost: `You limit exposure today; the underlying tension remains: ${tradeoff}`,
    direction: "exit",
    pattern_family: "future_deferral",
  };
  const y: SecondChoice = {
    id: "Y",
    label: LABEL_ENGAGE_DIRECT,
    cost: `You invite immediate friction; the same trade-off is still in play: ${tradeoff}`,
    direction: "entry",
    pattern_family: "repair_avoidance",
  };
  return [x, y];
}

function buildEscalationBranches(
  situationParagraphs: string,
  tradeoff: string,
  scenarioId: string,
): Record<string, EscalationBranch> {
  const body = situationParagraphs.trim();
  const keys = ["A", "B", "C", "D"] as const;
  const out: Record<string, EscalationBranch> = {};
  for (const k of keys) {
    const [x, y] = secondTierChoices(tradeoff);
    out[k] = {
      escalation_text: `${ESCALATION_PREFIX[k]}. ${body}`,
      pressure_increase: PRESSURE_INCREASE[k],
      second_choices: [x, y],
      action_decision: defaultActionDecisionBlock(scenarioId),
    };
  }
  return out;
}

/** S1 + S2 + S3 narrative stack for escalation body — approved chain copy only (no bundled elite leakage). */
function escalationSituationFromChain(s1: ChainStage, s2: ChainStage, s3: ChainStage): string {
  const parts = [
    s1.context.narrative.trim(),
    s2.context.narrative.trim(),
    s3.context.narrative.trim(),
  ].filter((p) => p.length > 0);
  return parts.join("\n\n");
}

const PRIMARY_D_ELITE_TEMPLATE =
  "Widen ownership: bring another leader, HR, compliance, or a peer into the decision explicitly — now, not after the fact.";

type IndexRow = {
  id: string;
  tradeoff?: string;
  bty_tension_axis?: string;
  pattern_detection?: string[];
};

function indexRow(id: string): IndexRow | undefined {
  return (chainSourceIndex as IndexRow[]).find((r) => r.id === id);
}

/** Tradeoffs where index.json still describes a different story than chain S1 — authored from chain stakes. */
const TRADEOFF_CHAIN_ONLY: Record<"core_06_lead_assistant" | "core_11_staffing_collapse", string> = {
  core_06_lead_assistant:
    "Accepting her request quickly may protect her well-being while leaving a leadership gap; clarifying structure and expectations may feel cold to someone already strained; waiting to understand more may extend uncertainty for the team.",
  core_11_staffing_collapse:
    "Pushing the full schedule protects access and avoids a cascade of cancellations but concentrates risk on a thin team; reducing procedures protects safety but disrupts patients who have already been waiting; pausing operations is honest about limits but triggers cancellations and immediate fallout.",
};

const ENGINE_CORE_01: Pick<
  EliteScenario,
  "bty_tension_axis" | "action_contract" | "air_logic" | "forced_reset" | "pattern_detection"
> = {
  bty_tension_axis: "Blame vs. Structural Honesty",
  action_contract: {
    description:
      "Frame training failure as a system issue, not a personal one, and start a structural improvement discussion.",
    time_window_hours: 48,
  },
  air_logic: {
    success: "Define the training-structure problem and hold at least one leadership-level discussion.",
    miss: "Resolve as individual fault only, or take no action.",
  },
  forced_reset: {
    trigger: "blame_pattern_detected",
    action: "Reframe the training failure as three system causes and share them.",
  },
  pattern_detection: ["blame_shift", "avoidance", "ownership"],
};

const ENGINE_CORE_06: Pick<
  EliteScenario,
  "bty_tension_axis" | "action_contract" | "air_logic" | "forced_reset" | "pattern_detection"
> = {
  bty_tension_axis: "Empathy Loyalty vs. Structural Authority",
  action_contract: {
    description:
      "Support the lead assistant with clarity, define what leadership means in this moment, and stabilize how the team interprets the decision.",
    time_window_hours: 48,
  },
  air_logic: {
    success: "Hold a private decision conversation and follow up with visible expectations for the team.",
    miss: "Avoid naming how the move affects authority, protocols, or team trust.",
  },
  forced_reset: {
    trigger: "avoidance_detected",
    action: "Name the team story forming after the decision and reset expectations in one forum.",
  },
  pattern_detection: ["avoidance", "ownership", "empathy_bias"],
};

const ENGINE_CORE_11: Pick<
  EliteScenario,
  "bty_tension_axis" | "action_contract" | "air_logic" | "forced_reset" | "pattern_detection"
> = {
  bty_tension_axis: "Operational Compliance vs. Patient Safety Integrity",
  action_contract: {
    description:
      "Make a documented staffing and safety decision for the day, communicate trade-offs to patients and staff, and escalate structural risk if limits are breached.",
    time_window_hours: 24,
  },
  air_logic: {
    success: "Adjust the schedule for safe operations and record the staffing gap for leadership.",
    miss: "Run the day as if staffing were adequate, with no visible risk naming.",
  },
  forced_reset: {
    trigger: "silent_execution_pattern",
    action: "Pause for safety, reset patient expectations, and escalate the staffing failure.",
  },
  pattern_detection: ["self_protection", "avoidance", "ownership"],
};

function buildCore01(): EliteScenario {
  const s1 = s1_01 as ChainStage;
  const s2 = s2_01 as ChainStage;
  const s3 = s3_01 as ChainStage;
  const idx = indexRow("core_01_training_system");
  const tradeoff = idx?.tradeoff?.trim() ?? "";
  if (!tradeoff) throw new Error("[chain→elite] core_01: missing tradeoff in source_scenarios_index.json");

  const choices = (s1.choices ?? []).filter((c) => ["A", "B", "C"].includes(String(c.id).trim()));
  if (choices.length < 3) throw new Error("[chain→elite] core_01: S1 needs A/B/C choices");

  const escalationBody = escalationSituationFromChain(s1, s2, s3);

  return {
    id: "core_01_training_system",
    title: s1.title.trim(),
    role: s1.context.role.trim(),
    pressure: s1.context.narrative.trim(),
    tradeoff,
    bty_tension_axis: ENGINE_CORE_01.bty_tension_axis,
    action_contract: ENGINE_CORE_01.action_contract,
    air_logic: ENGINE_CORE_01.air_logic,
    forced_reset: ENGINE_CORE_01.forced_reset,
    pattern_detection: ENGINE_CORE_01.pattern_detection,
    difficulty_level: 3,
    primaryChoices: [
      { id: "A", label: choices[0].label.trim(), subtext: "" },
      { id: "B", label: choices[1].label.trim(), subtext: "" },
      { id: "C", label: choices[2].label.trim(), subtext: "" },
      { id: "D", label: PRIMARY_D_ELITE_TEMPLATE, subtext: "" },
    ],
    escalationBranches: buildEscalationBranches(escalationBody, tradeoff, "core_01_training_system"),
  };
}

function buildCore06(): EliteScenario {
  const s1 = s1_06 as ChainStage;
  const s2 = s2_06 as ChainStage;
  const s3 = s3_06 as ChainStage;
  const tradeoff = TRADEOFF_CHAIN_ONLY.core_06_lead_assistant;
  const choices = (s1.choices ?? []).filter((c) => ["A", "B", "C"].includes(String(c.id).trim()));
  if (choices.length < 3) throw new Error("[chain→elite] core_06: S1 needs A/B/C choices");

  const escalationBody = escalationSituationFromChain(s1, s2, s3);

  return {
    id: "core_06_lead_assistant",
    title: s1.title.trim(),
    role: s1.context.role.trim(),
    pressure: s1.context.narrative.trim(),
    tradeoff,
    bty_tension_axis: ENGINE_CORE_06.bty_tension_axis,
    action_contract: ENGINE_CORE_06.action_contract,
    air_logic: ENGINE_CORE_06.air_logic,
    forced_reset: ENGINE_CORE_06.forced_reset,
    pattern_detection: ENGINE_CORE_06.pattern_detection,
    difficulty_level: 3,
    primaryChoices: [
      { id: "A", label: choices[0].label.trim(), subtext: "" },
      { id: "B", label: choices[1].label.trim(), subtext: "" },
      { id: "C", label: choices[2].label.trim(), subtext: "" },
      { id: "D", label: PRIMARY_D_ELITE_TEMPLATE, subtext: "" },
    ],
    escalationBranches: buildEscalationBranches(escalationBody, tradeoff, "core_06_lead_assistant"),
  };
}

function buildCore11(): EliteScenario {
  const s1 = s1_11 as ChainStage;
  const s2 = s2_11 as ChainStage;
  const s3 = s3_11 as ChainStage;
  const tradeoff = TRADEOFF_CHAIN_ONLY.core_11_staffing_collapse;
  const choices = (s1.choices ?? []).filter((c) => ["A", "B", "C"].includes(String(c.id).trim()));
  if (choices.length < 3) throw new Error("[chain→elite] core_11: S1 needs A/B/C choices");

  const escalationBody = escalationSituationFromChain(s1, s2, s3);

  return {
    id: "core_11_staffing_collapse",
    title: s1.title.trim(),
    role: s1.context.role.trim(),
    pressure: s1.context.narrative.trim(),
    tradeoff,
    bty_tension_axis: ENGINE_CORE_11.bty_tension_axis,
    action_contract: ENGINE_CORE_11.action_contract,
    air_logic: ENGINE_CORE_11.air_logic,
    forced_reset: ENGINE_CORE_11.forced_reset,
    pattern_detection: ENGINE_CORE_11.pattern_detection,
    difficulty_level: 3,
    primaryChoices: [
      { id: "A", label: choices[0].label.trim(), subtext: "" },
      { id: "B", label: choices[1].label.trim(), subtext: "" },
      { id: "C", label: choices[2].label.trim(), subtext: "" },
      { id: "D", label: PRIMARY_D_ELITE_TEMPLATE, subtext: "" },
    ],
    escalationBranches: buildEscalationBranches(escalationBody, tradeoff, "core_11_staffing_collapse"),
  };
}

const BUILDERS: Record<ChainWorkspaceEliteId, () => EliteScenario> = {
  core_01_training_system: buildCore01,
  core_06_lead_assistant: buildCore06,
  core_11_staffing_collapse: buildCore11,
};

/**
 * Full {@link EliteScenario} for one of the three chain-synced ids — built only from chain JSON + small engine blocks above.
 */
export function buildEliteScenarioFromChainWorkspace(id: ChainWorkspaceEliteId): EliteScenario {
  return BUILDERS[id]();
}
