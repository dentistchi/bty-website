/**
 * BTY chain-node scenario validation (standalone; not aligned to legacy Arena scenario JSON).
 * @see src/lib/bty/tests/fixtures/scenario-node-fixtures.ts
 */

export type Level = 1 | 2 | 3 | 4 | 5;
export type ChainStage = 1 | 2 | 3;
export type ChoiceId = "A" | "B" | "C";
export type Archetype = "avoid" | "structure" | "confront";

export type StateImpactValue = -2 | -1 | 0 | 1 | 2;

export interface StateImpact {
  reputation: StateImpactValue;
  trust: StateImpactValue;
  self_narrative: StateImpactValue;
  courage: StateImpactValue;
}

export interface Choice {
  id: ChoiceId;
  label: string;
  archetype: Archetype;
  state_impact: StateImpact;
}

export interface Questions {
  level_1?: string;
  level_2?: string;
  level_3?: string;
  level_4?: string;
  level_5?: string;
}

export interface Context {
  role: string;
  pressure: string;
  narrative: string;
}

export interface ScenarioNode {
  id: string;
  title: string;
  level: Level;
  chain_stage: ChainStage;
  context: Context;
  choices: Choice[];
  questions: Questions;
  next_map?: Record<ChoiceId, string>;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const GENERIC_PHRASES = [
  "protect runway",
  "engage directly",
  "take ownership",
  "your stance is visible",
  "lead with integrity",
  "do the right thing",
  "be your best",
  "show leadership",
];

const COACHY_PHRASES = [
  "how can you grow",
  "what lesson do you learn",
  "what would a great leader do",
  "how can you improve others",
  "what is the best leadership response",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function includesPhrase(text: string, phrases: string[]): string[] {
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p.toLowerCase()));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function validateScenarioNode(node: ScenarioNode): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isNonEmptyString(node.id)) {
    issues.push({ severity: "error", field: "id", message: "id is required." });
  }
  if (!isNonEmptyString(node.title)) {
    issues.push({ severity: "error", field: "title", message: "title is required." });
  }
  if (![1, 2, 3, 4, 5].includes(node.level)) {
    issues.push({ severity: "error", field: "level", message: "level must be 1-5." });
  }
  if (![1, 2, 3].includes(node.chain_stage)) {
    issues.push({ severity: "error", field: "chain_stage", message: "chain_stage must be 1-3." });
  }

  if (!node.context || typeof node.context !== "object") {
    issues.push({ severity: "error", field: "context", message: "context is required." });
  } else {
    if (!isNonEmptyString(node.context.role)) {
      issues.push({ severity: "error", field: "context.role", message: "role is required." });
    }
    if (!isNonEmptyString(node.context.pressure)) {
      issues.push({ severity: "error", field: "context.pressure", message: "pressure is required." });
    }
    if (!isNonEmptyString(node.context.narrative)) {
      issues.push({ severity: "error", field: "context.narrative", message: "narrative is required." });
    }
  }

  if (!Array.isArray(node.choices) || node.choices.length !== 3) {
    issues.push({
      severity: "error",
      field: "choices",
      message: "There must be exactly 3 choices.",
    });
  } else {
    const expectedIds: ChoiceId[] = ["A", "B", "C"];
    const actualIds = node.choices.map((c) => c.id);
    const sortedActual = [...actualIds].sort();
    const sortedExpected = [...expectedIds].sort();

    if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
      issues.push({
        severity: "error",
        field: "choices[].id",
        message: "Choices must have ids A, B, C exactly once.",
      });
    }

    const expectedArchetypes: Archetype[] = ["avoid", "structure", "confront"];
    const actualArchetypes = node.choices.map((c) => c.archetype);
    const sortedArchActual = [...actualArchetypes].sort();
    const sortedArchExpected = [...expectedArchetypes].sort();

    if (JSON.stringify(sortedArchActual) !== JSON.stringify(sortedArchExpected)) {
      issues.push({
        severity: "warning",
        field: "choices[].archetype",
        message: "Recommended archetype spread is avoid / structure / confront exactly once each.",
      });
    }

    for (const choice of node.choices) {
      if (!isNonEmptyString(choice.label)) {
        issues.push({
          severity: "error",
          field: `choices.${choice.id}.label`,
          message: "choice label is required.",
        });
      } else {
        const matchedGeneric = includesPhrase(choice.label, GENERIC_PHRASES);
        if (matchedGeneric.length > 0) {
          issues.push({
            severity: "error",
            field: `choices.${choice.id}.label`,
            message: `Choice contains generic phrasing: ${matchedGeneric.join(", ")}.`,
          });
        }

        if (tokenize(choice.label).length < 5) {
          issues.push({
            severity: "warning",
            field: `choices.${choice.id}.label`,
            message: "Choice label may be too short to feel concrete.",
          });
        }
      }

      const impact = choice.state_impact;
      const keys: (keyof StateImpact)[] = [
        "reputation",
        "trust",
        "self_narrative",
        "courage",
      ];

      for (const key of keys) {
        const value = impact?.[key];
        if (![-2, -1, 0, 1, 2].includes(value as number)) {
          issues.push({
            severity: "error",
            field: `choices.${choice.id}.state_impact.${key}`,
            message: `${key} must be one of -2, -1, 0, 1, 2.`,
          });
        }
      }
    }

    for (let i = 0; i < node.choices.length; i++) {
      for (let j = i + 1; j < node.choices.length; j++) {
        const sim = jaccardSimilarity(node.choices[i].label, node.choices[j].label);
        if (sim > 0.65) {
          issues.push({
            severity: "error",
            field: "choices",
            message: `Choices ${node.choices[i].id} and ${node.choices[j].id} appear too similar.`,
          });
        }
      }
    }

    const serializedImpacts = node.choices.map((c) => JSON.stringify(c.state_impact));
    const uniqueImpacts = new Set(serializedImpacts);
    if (uniqueImpacts.size < 3) {
      issues.push({
        severity: "warning",
        field: "choices[].state_impact",
        message: "Some choices have identical state impacts. Consider differentiating them.",
      });
    }
  }

  if (!node.questions || typeof node.questions !== "object") {
    issues.push({
      severity: "error",
      field: "questions",
      message: "questions object is required.",
    });
  } else {
    const questionEntries = Object.entries(node.questions).filter(([, v]) => isNonEmptyString(v));

    if (questionEntries.length === 0) {
      issues.push({
        severity: "error",
        field: "questions",
        message: "At least one question must be present.",
      });
    }

    for (const [key, value] of questionEntries) {
      const coachy = includesPhrase(value, COACHY_PHRASES);
      if (coachy.length > 0) {
        issues.push({
          severity: "error",
          field: `questions.${key}`,
          message: `Question sounds coaching-like: ${coachy.join(", ")}.`,
        });
      }
    }

    if (node.level >= 2 && !isNonEmptyString(node.questions.level_2)) {
      issues.push({
        severity: "warning",
        field: "questions.level_2",
        message: "Level 2+ should usually include a gratitude/relationship question.",
      });
    }

    if (node.level >= 3 && !isNonEmptyString(node.questions.level_3)) {
      issues.push({
        severity: "warning",
        field: "questions.level_3",
        message: "Level 3+ should usually include an integrity tension question.",
      });
    }

    if (node.level >= 4 && !isNonEmptyString(node.questions.level_4)) {
      issues.push({
        severity: "warning",
        field: "questions.level_4",
        message: "Level 4+ should usually include a downstream influence question.",
      });
    }

    if (node.level === 5 && !isNonEmptyString(node.questions.level_5)) {
      issues.push({
        severity: "error",
        field: "questions.level_5",
        message: "Level 5 requires an identity-under-weight question.",
      });
    }
  }

  if (isNonEmptyString(node.context?.narrative)) {
    const genericMatches = includesPhrase(node.context.narrative, GENERIC_PHRASES);
    if (genericMatches.length > 0) {
      issues.push({
        severity: "error",
        field: "context.narrative",
        message: `Narrative contains generic phrasing: ${genericMatches.join(", ")}.`,
      });
    }

    const tokenCount = tokenize(node.context.narrative).length;
    if (tokenCount < 12) {
      issues.push({
        severity: "warning",
        field: "context.narrative",
        message: "Narrative may be too thin to hold realistic pressure.",
      });
    }
  }

  if (node.chain_stage === 1 && isNonEmptyString(node.context?.narrative)) {
    const lower = node.context.narrative.toLowerCase();
    if (lower.includes("already damaged") || lower.includes("not fully repaired")) {
      issues.push({
        severity: "warning",
        field: "chain_stage",
        message: "Stage 1 should not usually feel like post-collapse identity weight.",
      });
    }
  }

  if (node.chain_stage === 3 && isNonEmptyString(node.context?.narrative)) {
    const lower = node.context.narrative.toLowerCase();
    const hasWeightCue =
      lower.includes("not fully") ||
      lower.includes("still") ||
      lower.includes("already") ||
      lower.includes("trust") ||
      lower.includes("distance") ||
      lower.includes("repair");

    if (!hasWeightCue) {
      issues.push({
        severity: "warning",
        field: "context.narrative",
        message: "Stage 3 should usually carry accumulated relational or identity weight.",
      });
    }
  }

  if (node.next_map) {
    for (const id of ["A", "B", "C"] as ChoiceId[]) {
      if (!isNonEmptyString(node.next_map[id])) {
        issues.push({
          severity: "error",
          field: `next_map.${id}`,
          message: `next_map for ${id} must be a non-empty string.`,
        });
      }
    }
  } else if (node.chain_stage < 3) {
    issues.push({
      severity: "warning",
      field: "next_map",
      message: "Non-final chain stages should usually define next_map.",
    });
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

export function validateScenarioSet(nodes: ScenarioNode[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) {
      issues.push({
        severity: "error",
        field: "id",
        message: `Duplicate scenario id found: ${node.id}`,
      });
    }
    ids.add(node.id);

    const result = validateScenarioNode(node);
    issues.push(
      ...result.issues.map((issue) => ({
        ...issue,
        field: `${node.id}.${issue.field}`,
      }))
    );
  }

  const allIds = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    if (!node.next_map) continue;
    for (const [choiceId, nextId] of Object.entries(node.next_map)) {
      if (!allIds.has(nextId)) {
        issues.push({
          severity: "error",
          field: `${node.id}.next_map.${choiceId}`,
          message: `next_map points to missing scenario id: ${nextId}`,
        });
      }
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}
