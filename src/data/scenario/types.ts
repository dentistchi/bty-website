export type Locale = "en" | "ko";

export type AxisGroup = "Ownership" | "Truth" | "Repair";
export type PrimaryChoiceId = "A" | "B" | "C" | "D";
export type SecondChoiceId = "X" | "Y";
export type ActionChoiceId = "AD1" | "AD2";

export type BaseChoiceMapping = {
  choiceId: string;
  dbChoiceId: string;
  is_action_commitment?: boolean;
};

export type BaseScenario = {
  scenarioId: string;
  dbScenarioId: string;
  incident: {
    incidentId: string;
    stage: number;
    axisGroup: AxisGroup;
    axisIndex: number;
    previousScenarioId: string | null;
    nextScenarioId: string | null;
    roleShift?: string;
    propagation?: Record<string, unknown>;
  };
  structure: {
    primary: BaseChoiceMapping[];
    tradeoff: Record<string, BaseChoiceMapping[]>;
    action_decision: Record<string, BaseChoiceMapping[]>;
  };
};

export type ScenarioChoice = {
  id: PrimaryChoiceId;
  label: string;
  direction?: "entry" | "exit";
  pattern_family?: string;
  [key: string]: unknown;
};

export type SecondChoice = {
  id: SecondChoiceId;
  label: string;
  direction?: "entry" | "exit";
  pattern_family?: string;
  dbChoiceId?: string;
  [key: string]: unknown;
};

export type ActionDecisionChoice = {
  id: ActionChoiceId;
  label: string;
  dbChoiceId?: string;
  meaning: {
    is_action_commitment: boolean;
    direction?: "entry" | "exit";
    pattern_family?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ActionDecision = {
  prompt: string;
  context?: string;
  choices: ActionDecisionChoice[];
};

export type EscalationBranch = {
  escalation_text: string;
  second_choices: SecondChoice[];
  action_decision: ActionDecision;
  [key: string]: unknown;
};

export type LocalizedScenario = {
  id: string;
  title: string;
  role: string;
  pressure: string;
  tradeoff: string;
  choices: ScenarioChoice[];
  escalationBranches: Record<PrimaryChoiceId, EscalationBranch>;
  [key: string]: unknown;
};

export type RuntimeScenario = {
  base: BaseScenario;
  content: LocalizedScenario;
  scenarioId: string;
  dbScenarioId: string;
  incidentId: string;
  stage: number;
  axisGroup: AxisGroup;
  axisIndex: number;
  previousScenarioId: string | null;
  nextScenarioId: string | null;
  propagation?: Record<string, unknown>;
};

export type RuntimeFlowState =
  | "SCENARIO_READY"
  | "PRIMARY_CHOICE_ACTIVE"
  | "TRADEOFF_ACTIVE"
  | "ACTION_DECISION_ACTIVE"
  | "ACTION_REQUIRED"
  | "NEXT_SCENARIO_READY";

export type RuntimeFlowContext = {
  state: RuntimeFlowState;
  primaryChoiceId?: PrimaryChoiceId;
  secondChoiceId?: SecondChoiceId;
  actionChoiceId?: ActionChoiceId;
  isActionCommitment?: boolean;
};

export type ScenarioDecisionEvent = {
  userId: string;
  incidentId: string;
  scenarioId: string;
  dbScenarioId: string;
  stage: number;
  axisGroup: string;
  axisIndex: number;
  role: string;
  primaryChoiceId: PrimaryChoiceId;
  primaryDbChoiceId: string;
  primaryDirection: "entry" | "exit";
  primaryPatternFamily: string;
  secondChoiceId: SecondChoiceId;
  secondDbChoiceId: string;
  secondDirection: "entry" | "exit";
  secondPatternFamily: string;
  actionChoiceId: ActionChoiceId;
  actionDbChoiceId: string;
  isActionCommitment: boolean;
  timestamp: string;
};
