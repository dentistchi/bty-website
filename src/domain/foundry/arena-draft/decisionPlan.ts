/**
 * THE DECISION PLAN — Arena decides BEFORE it writes (Plan-Then-Render V1).
 *
 * ★ WHY A PLAN EXISTS AT ALL.
 *
 * Measured across four dispatches: the generator was asked, in one call, for an opening, two primary
 * choices, two branches, four tradeoff choices and four action choices — and nothing in that request
 * ever obliged it to make more than ONE decision. So it made one and wrote it several times.
 *
 *   c18 (English, ACCEPTED, captured as a fixture)
 *     branch A tradeoff: "Prepare a detailed report" / "Focus on patient care and delay the report"
 *     branch A action:   "Finalize the report and communicate" / "Continue prioritizing patient care"
 *
 *   Founder practice run6 (Korean, ACCEPTED)
 *     tradeoff: "추가 인력을 요청하여 운영을 유지하기"
 *     action:   "추가 인력을 요청하여 운영을 유지한다."
 *
 * The second pair differs by a verb ending, so `normalizeText` equality could not see it. The first
 * pair shares no wording at all and is the same decision twice. Neither surface normalisation nor a
 * similarity threshold catches both, because the defect is not lexical — it is that no distinct
 * decision was ever committed to.
 *
 * ★ WHAT THIS FILE THEREFORE CONTAINS.
 *
 * A tiny structure the model must fill in FIRST, in which each decision carries an explicit semantic
 * id. Two decisions being the same then becomes `a.dimensionId === b.dimensionId` — an identity
 * comparison over declared keys, which is language-independent, threshold-free, and decided before a
 * single learner-facing sentence exists.
 *
 * ★ WHAT IT DELIBERATELY DOES NOT CLAIM.
 *
 * Today's runtime resolves `branches[primaryChoiceId]` and shows ONE `actionDecision` per branch
 * whichever tradeoff option the learner picked — `selectedTradeoffId` is telemetry. So a branch's
 * action dimension means "the new decision that follows this branch's tradeoff STAGE", never "a
 * different action per tradeoff option". Per-tradeoff causality is not represented here because it
 * does not exist in the runtime; inventing it in the plan would describe a graph the player cannot
 * walk. That is the Arena Runtime Graph V2 question, recorded and not answered here.
 *
 * Generation-only. Never persisted, never published, never sent to a learner. Pure: no I/O.
 */

/** The two primary choice ids the plan may use. Server-assigned, never authored by the model. */
export const PLAN_PRIMARY_IDS = ["p1", "p2"] as const;
export type PlanPrimaryId = (typeof PLAN_PRIMARY_IDS)[number];

export type PlanDecision = {
  /** Semantic key. Two decisions that MEAN the same thing must carry the same id. */
  dimensionId: string;
  /** What is being decided, in the output language. */
  dimension: string;
  /** What pulls in both directions. Absent on the action stage, which follows a tension already set. */
  tension?: string;
};

export type PlanPrimaryChoice = {
  id: PlanPrimaryId;
  /** The position taken — what it protects. */
  stance: string;
  /** What that position gives up. */
  acceptedCost: string;
};

export type PlanBranch = {
  primaryChoiceId: PlanPrimaryId;
  /** The world this choice produced. The learner sees prose derived from it. */
  resultingWorldState: string;
  tradeoff: PlanDecision;
  action: PlanDecision;
};

export type DecisionPlan = {
  primary: PlanDecision & { choices: PlanPrimaryChoice[] };
  branches: PlanBranch[];
};

const DIM_ID_MAX = 40;
const TEXT_MAX = 200;

/** Strict structured-output schema for the plan call. Compact by design — no prose, no labels. */
export const DECISION_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    primary: {
      type: "object",
      additionalProperties: false,
      properties: {
        dimensionId: { type: "string", maxLength: DIM_ID_MAX },
        dimension: { type: "string", maxLength: TEXT_MAX },
        tension: { type: "string", maxLength: TEXT_MAX },
        choices: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", enum: [...PLAN_PRIMARY_IDS] },
              stance: { type: "string", maxLength: TEXT_MAX },
              acceptedCost: { type: "string", maxLength: TEXT_MAX },
            },
            required: ["id", "stance", "acceptedCost"],
          },
        },
      },
      required: ["dimensionId", "dimension", "tension", "choices"],
    },
    branches: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          primaryChoiceId: { type: "string", enum: [...PLAN_PRIMARY_IDS] },
          resultingWorldState: { type: "string", maxLength: TEXT_MAX },
          tradeoff: {
            type: "object",
            additionalProperties: false,
            properties: {
              dimensionId: { type: "string", maxLength: DIM_ID_MAX },
              dimension: { type: "string", maxLength: TEXT_MAX },
              tension: { type: "string", maxLength: TEXT_MAX },
            },
            required: ["dimensionId", "dimension", "tension"],
          },
          action: {
            type: "object",
            additionalProperties: false,
            properties: {
              dimensionId: { type: "string", maxLength: DIM_ID_MAX },
              dimension: { type: "string", maxLength: TEXT_MAX },
            },
            required: ["dimensionId", "dimension"],
          },
        },
        required: ["primaryChoiceId", "resultingWorldState", "tradeoff", "action"],
      },
    },
  },
  required: ["primary", "branches"],
} as const;

// ---------------------------------------------------------------------------
// Structural parse — shape only. Meaning is judged by the validator below.
// ---------------------------------------------------------------------------

export type PlanParse = { ok: true; value: DecisionPlan } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function parseDecision(v: unknown): PlanDecision {
  const o = isObj(v) ? v : {};
  return { dimensionId: str(o.dimensionId), dimension: str(o.dimension), tension: str(o.tension) };
}

export function parseDecisionPlan(input: unknown): PlanParse {
  if (!isObj(input)) return { ok: false, errors: ["plan_not_an_object"] };
  const errors: string[] = [];

  const rawPrimary = isObj(input.primary) ? input.primary : null;
  if (!rawPrimary) errors.push("plan_primary_missing");
  const rawChoices = rawPrimary && Array.isArray(rawPrimary.choices) ? rawPrimary.choices : [];
  if (rawChoices.length !== 2) errors.push("plan_primary_choice_count");

  const choices: PlanPrimaryChoice[] = rawChoices.map((c) => {
    const o = isObj(c) ? c : {};
    const id = str(o.id);
    if (!(PLAN_PRIMARY_IDS as readonly string[]).includes(id)) errors.push("plan_primary_choice_id");
    return { id: id as PlanPrimaryId, stance: str(o.stance), acceptedCost: str(o.acceptedCost) };
  });

  const rawBranches = Array.isArray(input.branches) ? input.branches : [];
  if (rawBranches.length !== 2) errors.push("plan_branch_count");

  const branches: PlanBranch[] = rawBranches.map((b) => {
    const o = isObj(b) ? b : {};
    const pid = str(o.primaryChoiceId);
    if (!(PLAN_PRIMARY_IDS as readonly string[]).includes(pid)) errors.push("plan_branch_primary_id");
    return {
      primaryChoiceId: pid as PlanPrimaryId,
      resultingWorldState: str(o.resultingWorldState),
      tradeoff: parseDecision(o.tradeoff),
      action: parseDecision(o.action),
    };
  });

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: { primary: { ...parseDecision(rawPrimary), choices }, branches },
  };
}

// ---------------------------------------------------------------------------
// Deterministic plan validation — identity comparisons, never similarity.
// ---------------------------------------------------------------------------

/** One defect, with the plan coordinate that carries it. */
export type PlanFinding = {
  /** The branch it sits in, when it is branch-scoped. */
  branch?: PlanPrimaryId;
  /** Dotted plan path, e.g. `action.dimensionId`. */
  field: string;
  problem: string;
};

export type PlanValidation = { ok: boolean; findings: PlanFinding[] };

/** Semantic ids are lower_snake_case words. A positional or numbered id carries no meaning. */
const DIM_ID_SHAPE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const MEANINGLESS_ID = /^(dimension|dim|decision|axis|new|other|misc|general|generic|default|d|a|b|x|y)([_-]?\d+)?$/;
const NUMBERED_ONLY = /^[a-z]{1,3}\d+$/;

/** Whitespace units, and the Hangul-aware floor already established for construction metadata. */
const units = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const hasHangul = (s: string) => /[가-힣]/.test(s);
const tooThin = (s: string) => units(s) < (hasHangul(s) ? 2 : 3);

/*
  ★ A DIMENSION MUST NAME SOMETHING THAT CAN VARY (v1.1).

  Measured in v1: `리더십 가치` ("leadership value") cleared the length floor and named no decision,
  so the plan was structurally valid and semantically empty. The floor counted words; it could not
  tell a decision from a topic.

  This is a FORM rule, not a taxonomy. It asks only whether the text is phrased as something
  choosable — a Korean `-(으)ㄹ지` ending, or an interrogative/contrast word — and it deliberately
  knows nothing about leadership, operations or any domain. No morphology engine: the Korean test
  is jamo arithmetic on one syllable, and nothing else.
*/
const JONGSEONG_RIEUL = 8;
/** True when some syllable carries final ㄹ immediately before 지 — the `-(으)ㄹ지` decision ending. */
function hasRieulJiEnding(text: string): boolean {
  for (let i = 1; i < text.length; i++) {
    if (text[i] !== "지") continue;
    const c = text.charCodeAt(i - 1);
    if (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === JONGSEONG_RIEUL) return true;
  }
  return false;
}
const KO_CHOICE_FORMS = ["것인지", "는지", "얼마나", "언제", "어디", "어느 정도", "누구", "누가", "무엇", "선택", "우선순위"];
const EN_CHOICE_FORM = /\b(whether|when|where|which|who|whom|how much|how many|how to|what to|versus|vs)\b/i;
/** Does this read as a decision variable rather than a topic? */
const namesADecision = (text: string) =>
  hasRieulJiEnding(text) || KO_CHOICE_FORMS.some((f) => text.includes(f)) || EN_CHOICE_FORM.test(text);

const GENERIC_TEXT = new Set(["", "n/a", "na", "none", "tbd", "unknown", "various", "general", "generic", "decision", "the decision"]);
const isGenericText = (s: string) => GENERIC_TEXT.has(s.trim().toLowerCase());

/** Whitespace-collapsed comparison. Used ONLY for the byte-identical sibling rule. */
const flat = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function checkId(id: string, branch: PlanPrimaryId | undefined, field: string, out: PlanFinding[]): void {
  if (!id) return void out.push({ ...(branch ? { branch } : {}), field, problem: "dimension_id_missing" });
  if (!DIM_ID_SHAPE.test(id) || id.length > DIM_ID_MAX) {
    out.push({ ...(branch ? { branch } : {}), field, problem: "dimension_id_not_semantic" });
    return;
  }
  if (MEANINGLESS_ID.test(id) || NUMBERED_ONLY.test(id)) {
    out.push({ ...(branch ? { branch } : {}), field, problem: "dimension_id_carries_no_meaning" });
  }
}

/**
 * `requiresDecisionForm` is true only for the three DIMENSION fields. A `tension` states what pulls
 * in two directions and is prose by nature — demanding an interrogative there would reject correct
 * plans for describing the stakes properly.
 */
function checkText(
  text: string,
  branch: PlanPrimaryId | undefined,
  field: string,
  out: PlanFinding[],
  requiresDecisionForm = false,
): void {
  if (!text || isGenericText(text)) {
    out.push({ ...(branch ? { branch } : {}), field, problem: "description_empty_or_generic" });
    return;
  }
  if (tooThin(text)) {
    out.push({ ...(branch ? { branch } : {}), field, problem: "description_too_thin" });
    return;
  }
  if (requiresDecisionForm && !namesADecision(text)) {
    out.push({ ...(branch ? { branch } : {}), field, problem: "description_names_no_decision" });
  }
}

/**
 * Validate a parsed plan.
 *
 * Every rule here is an EQUALITY over a declared id or a presence check. There is no similarity
 * threshold anywhere in this file — that is the whole point of planning before writing.
 */
export function validateDecisionPlan(plan: DecisionPlan): PlanValidation {
  const findings: PlanFinding[] = [];

  // --- the primary decision ---
  checkId(plan.primary.dimensionId, undefined, "primary.dimensionId", findings);
  checkText(plan.primary.dimension, undefined, "primary.dimension", findings, true);
  checkText(plan.primary.tension ?? "", undefined, "primary.tension", findings);

  const ids = plan.primary.choices.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    findings.push({ field: "primary.choices", problem: "primary_choice_ids_not_unique" });
  }
  plan.primary.choices.forEach((c, i) => {
    if (!c.stance.trim()) findings.push({ field: `primary.choices[${i}].stance`, problem: "stance_missing" });
    if (!c.acceptedCost.trim()) findings.push({ field: `primary.choices[${i}].acceptedCost`, problem: "accepted_cost_missing" });
  });

  // --- one branch per primary choice, and the link is explicit, not positional ---
  const byId = new Map<PlanPrimaryId, PlanBranch>();
  for (const b of plan.branches) {
    if (byId.has(b.primaryChoiceId)) {
      findings.push({ branch: b.primaryChoiceId, field: "primaryChoiceId", problem: "two_branches_for_one_choice" });
    }
    byId.set(b.primaryChoiceId, b);
  }
  for (const c of plan.primary.choices) {
    if (!byId.has(c.id)) findings.push({ branch: c.id, field: "branches", problem: "branch_missing_for_primary_choice" });
  }

  for (const b of plan.branches) {
    const at = b.primaryChoiceId;
    if (!b.resultingWorldState.trim() || isGenericText(b.resultingWorldState)) {
      findings.push({ branch: at, field: "resultingWorldState", problem: "consequence_empty_or_generic" });
    } else if (tooThin(b.resultingWorldState)) {
      findings.push({ branch: at, field: "resultingWorldState", problem: "consequence_too_thin" });
    }

    checkId(b.tradeoff.dimensionId, at, "tradeoff.dimensionId", findings);
    checkText(b.tradeoff.dimension, at, "tradeoff.dimension", findings, true);
    checkText(b.tradeoff.tension ?? "", at, "tradeoff.tension", findings);
    checkId(b.action.dimensionId, at, "action.dimensionId", findings);
    checkText(b.action.dimension, at, "action.dimension", findings, true);

    // RULE A — the measured collapse: the action restating the tradeoff.
    if (b.tradeoff.dimensionId && b.tradeoff.dimensionId === b.action.dimensionId) {
      findings.push({ branch: at, field: "action.dimensionId", problem: "same_as_tradeoff_dimension" });
    }
    // RULE C — the action re-opening the decision the primary choice already settled.
    if (plan.primary.dimensionId && plan.primary.dimensionId === b.action.dimensionId) {
      findings.push({ branch: at, field: "action.dimensionId", problem: "same_as_primary_dimension" });
    }
  }

  /*
    ★ RULE B (v1.1) — THE PRIMARY CHOICE MUST CHANGE THE TRAINING.

    v1 rejected a sibling pair only when it shared BOTH the resulting world AND the tradeoff
    dimension. Measured against nine live plans, that caught nothing: run3 was approved with
    `p1.action = p2.action = communication_timing`, run4 with
    `p1.tradeoff = p2.tradeoff = priority_protect` under different worlds. Both rendered as the
    collapse they described — the renderer was faithful; the rule was wrong.

    Each stage is now checked on its own. If both branches reach the same tradeoff decision, the
    primary choice did not change what is at stake. If both end on the same action decision, the
    paths reconverged before they taught anything different. `resultingWorldState` inequality is
    kept, but only as secondary evidence — prose can differ while the decision does not.
  */
  const [b1, b2] = plan.branches;
  if (b1 && b2 && b1.primaryChoiceId !== b2.primaryChoiceId) {
    if (b1.tradeoff.dimensionId && b1.tradeoff.dimensionId === b2.tradeoff.dimensionId) {
      findings.push({ branch: b2.primaryChoiceId, field: "tradeoff.dimensionId", problem: "sibling_tradeoff_dimension_repeated" });
    }
    if (b1.action.dimensionId && b1.action.dimensionId === b2.action.dimensionId) {
      findings.push({ branch: b2.primaryChoiceId, field: "action.dimensionId", problem: "sibling_action_dimension_repeated" });
    }
    if (flat(b1.resultingWorldState) === flat(b2.resultingWorldState)) {
      findings.push({ branch: b2.primaryChoiceId, field: "resultingWorldState", problem: "sibling_world_state_identical" });
    }
  }

  return { ok: findings.length === 0, findings };
}

// ---------------------------------------------------------------------------
// Correction — plan coordinates, no answers.
// ---------------------------------------------------------------------------

/** What each problem asks the model to reconsider. Never supplies the replacement. */
const PLAN_CORRECTIONS: Record<string, string> = {
  same_as_tradeoff_dimension:
    "This branch decides the same thing twice. The action stage must open a decision the tradeoff stage did not settle — give it its own dimensionId and its own dimension.",
  same_as_primary_dimension:
    "This branch's action re-opens the decision the primary choice already made. Move it forward to a decision that only becomes live after the primary choice was taken.",
  sibling_tradeoff_dimension_repeated:
    "Both branches face the SAME tradeoff decision, so the primary choice changed nothing about what is at stake. Give each branch the tradeoff its own primary choice actually creates.",
  sibling_action_dimension_repeated:
    "Both branches end on the SAME action decision, so the two paths reconverge and teach one thing. Each branch must end on the decision its own situation leaves open.",
  sibling_world_state_identical:
    "Both primary choices produced the same world. State what is actually different after each one.",
  description_names_no_decision:
    "This names a topic, not a decision. Say what varies or what is being chosen between.",
  dimension_id_missing: "Give this decision a semantic dimensionId.",
  dimension_id_not_semantic: "dimensionId must be lower_snake_case words that name the decision.",
  dimension_id_carries_no_meaning:
    "This dimensionId names nothing. Use words that say what is being decided. Reuse an existing id when the decision genuinely is the same one — do not number them apart.",
  description_empty_or_generic: "State what is actually being decided here.",
  description_too_thin: "This description is too thin to name a decision.",
  consequence_empty_or_generic: "State the world this choice produced.",
  consequence_too_thin: "State the world this choice produced, concretely.",
  stance_missing: "State what this option protects.",
  accepted_cost_missing: "State what this option gives up.",
  primary_choice_ids_not_unique: "The two primary choices must carry different ids.",
  branch_missing_for_primary_choice: "Every primary choice needs its own branch.",
  two_branches_for_one_choice: "Each primary choice has exactly one branch.",
};

/** The correction message for a failed plan. Coordinates, the rule, and nothing else. */
export function renderPlanCorrection(findings: PlanFinding[]): string {
  const lines = ["Your decision plan was not accepted. Correct exactly these points and return the plan again."];
  for (const f of findings) {
    const where = [f.branch ? `branch=${f.branch}` : null, `field=${f.field}`, `problem=${f.problem}`]
      .filter(Boolean)
      .join(" ");
    lines.push(`- ${where}`);
    const how = PLAN_CORRECTIONS[f.problem];
    if (how) lines.push(`  ${how}`);
  }
  lines.push("Do not change anything that was not listed. Do not add facts the training context does not contain.");
  return lines.join("\n");
}

/** The approved plan, as the render call must receive it. Stable ordering, no commentary. */
export function renderPlanForPrompt(plan: DecisionPlan): string {
  const out = [
    "APPROVED DECISION PLAN — render this. Do not redesign it.",
    `PRIMARY [${plan.primary.dimensionId}] ${plan.primary.dimension}`,
    `  tension: ${plan.primary.tension ?? ""}`,
  ];
  for (const c of plan.primary.choices) {
    out.push(`  ${c.id}: protects ${c.stance} / accepts ${c.acceptedCost}`);
  }
  for (const b of plan.branches) {
    out.push(
      `BRANCH ${b.primaryChoiceId}`,
      `  resulting world: ${b.resultingWorldState}`,
      `  tradeoff [${b.tradeoff.dimensionId}] ${b.tradeoff.dimension}`,
      `    tension: ${b.tradeoff.tension ?? ""}`,
      `  action [${b.action.dimensionId}] ${b.action.dimension}`,
    );
  }
  return out.join("\n");
}
