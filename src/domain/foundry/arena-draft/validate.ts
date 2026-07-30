/**
 * Foundry Guided Arena Builder — deterministic draft validator (pure).
 *
 * AI output is an UNTRUSTED DRAFT. This layer decides, deterministically, whether
 * a three-phase scenario draft is structurally valid; it is the single gate the
 * generation service and the save route both consult so malformed content can
 * never be persisted as valid or previewed as complete. No DB, no I/O, no
 * providers, no display strings.
 *
 * Modeled on the Arena runtime's `validateBaseScenario` / `validateLocalizedScenario`
 * (src/data/scenario) but with the looser V1 draft cardinality and stable
 * free-form choice ids instead of the fixed A/B/C/D + X/Y + AD1/AD2 enums.
 */

import {
  ACTION_CHOICES_MAX,
  ACTION_CHOICES_MIN,
  ACTION_PROMPT_MAX,
  CHOICE_LABEL_MAX,
  ESCALATION_MAX,
  OPENING_MAX,
  PRIMARY_CHOICES_MAX,
  PRIMARY_CHOICES_MIN,
  TITLE_MAX,
  TRADEOFF_CHOICES_MAX,
  TRADEOFF_CHOICES_MIN,
  isHardestWhenOption,
  type ActionDecisionChoice,
  type ArenaScenarioDraft,
  type GuidedAnswers,
  type ScenarioBranch,
  type ScenarioDraftChoice,
} from "./types";

export type DraftValidation = {
  ok: boolean;
  /** Blocking, stable machine codes — a draft with any of these is invalid. */
  errors: string[];
  /** Non-blocking advisories (e.g. possible sensitive info) surfaced to the host. */
  warnings: string[];
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Sensitive-info heuristic (privacy) — patient/PII patterns. WARNING, not block.
// ---------------------------------------------------------------------------

/**
 * Heuristic detectors for obviously sensitive / patient-identifying content that
 * should never live in a practice scenario. Deterministic and pure. Returns stable
 * warning codes. It is a denylist (false negatives possible) so it WARNS the host
 * rather than silently blocking — but the service also surfaces it before save.
 */
const SENSITIVE_PATTERNS: ReadonlyArray<{ code: string; re: RegExp }> = [
  // Korean resident registration number (RRN): 6 digits - 7 digits.
  { code: "sensitive_rrn", re: /\b\d{6}\s*-\s*\d{7}\b/ },
  // Long medical record / chart / patient id numbers.
  { code: "sensitive_mrn", re: /\b(?:mrn|chart|patient(?:\s*id)?|환자(?:\s*번호)?|병록번호)\s*[:#]?\s*\d{4,}\b/i },
  // Email addresses.
  { code: "sensitive_email", re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i },
  // Phone numbers (loose international/KR).
  { code: "sensitive_phone", re: /\b(?:\+?\d{1,3}[\s-]?)?(?:0\d{1,2}[\s-]?)?\d{3,4}[\s-]\d{4}\b/ },
];

export function detectSensitiveInfo(text: unknown): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const out: string[] = [];
  for (const { code, re } of SENSITIVE_PATTERNS) {
    if (re.test(text) && !out.includes(code)) out.push(code);
  }
  return out;
}

/** Every learner-facing string in a draft, for a full sensitive-info sweep. */
function allDraftText(draft: ArenaScenarioDraft): string[] {
  const out: string[] = [draft.title, draft.opening, draft.tradeoff.escalationText, draft.actionDecision.prompt];
  for (const c of draft.primary.choices ?? []) out.push(c.label);
  for (const c of draft.tradeoff.choices ?? []) out.push(c.label);
  for (const c of draft.actionDecision.choices ?? []) out.push(c.label);
  // Branch-aware (Slice 3.2I): sweep every branch's learner-facing text too.
  for (const b of Object.values(draft.branches ?? {})) {
    out.push(b.escalationText, b.actionDecision.prompt);
    if (b.resultingWorldState) out.push(b.resultingWorldState);
    for (const c of b.tradeoffChoices ?? []) out.push(c.label);
    for (const c of b.actionDecision.choices ?? []) out.push(c.label);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Choice-list validation
// ---------------------------------------------------------------------------

function validateChoiceList(
  choices: unknown,
  phase: string,
  min: number,
  max: number,
  seenIds: Set<string>,
  errors: string[],
): void {
  if (!Array.isArray(choices)) {
    errors.push(`${phase}_choices_invalid`);
    return;
  }
  if (choices.length < min || choices.length > max) {
    errors.push(`${phase}_choice_count`);
  }
  for (const c of choices) {
    if (!isObject(c)) {
      errors.push(`${phase}_choice_invalid`);
      continue;
    }
    const id = c.id;
    const label = c.label;
    if (!isNonEmptyString(id)) {
      errors.push(`${phase}_choice_missing_id`);
    } else {
      if (seenIds.has(id)) errors.push("duplicate_choice_id");
      seenIds.add(id);
    }
    if (!isNonEmptyString(label)) errors.push(`${phase}_choice_empty_label`);
    else if (label.trim().length > CHOICE_LABEL_MAX) errors.push(`${phase}_choice_label_too_long`);
  }
}

// ---------------------------------------------------------------------------
// Branch validation (Slice 3.2I) — per-primary causal branches. Fail-closed.
// ---------------------------------------------------------------------------

/**
 * Validate the `branches` map of a branch-aware draft against the primary choice ids.
 * Every primary id must have exactly one structurally-valid branch; no orphan keys, no
 * missing branches. A malformed branch fails the whole draft (never flattened to legacy).
 */
function validateBranches(branchesRaw: unknown, primaryIds: string[], errors: string[]): void {
  if (!isObject(branchesRaw)) {
    errors.push("branches_invalid");
    return;
  }
  const keys = Object.keys(branchesRaw);
  const primarySet = new Set(primaryIds);
  for (const k of keys) if (!primarySet.has(k)) errors.push("branch_orphan_key");
  for (const pid of primaryIds) if (!keys.includes(pid)) errors.push("branch_missing");

  // Branch choice ids must be GLOBALLY unique across all branches (+ distinct from the
  // primary ids) so the runtime can unambiguously reject a cross-branch selection.
  const seen = new Set<string>(primaryIds);

  for (const b of Object.values(branchesRaw)) {
    if (!isObject(b)) {
      errors.push("branch_invalid");
      continue;
    }
    if (b.resultingWorldState !== undefined && typeof b.resultingWorldState !== "string") {
      errors.push("branch_world_state_invalid");
    }
    if (!isNonEmptyString(b.escalationText)) errors.push("branch_missing_escalation");
    else if (b.escalationText.trim().length > ESCALATION_MAX) errors.push("branch_escalation_too_long");
    validateChoiceList(b.tradeoffChoices, "branch_tradeoff", TRADEOFF_CHOICES_MIN, TRADEOFF_CHOICES_MAX, seen, errors);
    if (!isObject(b.actionDecision)) {
      errors.push("branch_action_missing");
    } else {
      if (!isNonEmptyString(b.actionDecision.prompt)) errors.push("branch_missing_action_prompt");
      else if (b.actionDecision.prompt.trim().length > ACTION_PROMPT_MAX) errors.push("branch_action_prompt_too_long");
      validateChoiceList(b.actionDecision.choices, "branch_action", ACTION_CHOICES_MIN, ACTION_CHOICES_MAX, seen, errors);
      const choices = Array.isArray(b.actionDecision.choices) ? b.actionDecision.choices : [];
      if (!choices.some((c) => isObject(c) && (c as ActionDecisionChoice).isActionCommitment === true)) {
        errors.push("branch_no_action_commitment");
      }
      for (const c of choices) {
        if (isObject(c) && typeof (c as { isActionCommitment?: unknown }).isActionCommitment !== "boolean") {
          errors.push("branch_action_choice_missing_commitment_flag");
        }
      }
    }
  }
}

/** Normalize one validated branch (trimmed strings, projected choice fields). */
function normalizeBranch(b: ScenarioBranch): ScenarioBranch {
  const choice = (c: ScenarioDraftChoice): ScenarioDraftChoice => ({ id: c.id.trim(), label: c.label.trim() });
  const actionChoice = (c: ActionDecisionChoice): ActionDecisionChoice => ({
    id: c.id.trim(),
    label: c.label.trim(),
    isActionCommitment: c.isActionCommitment === true,
  });
  const ws = typeof b.resultingWorldState === "string" ? b.resultingWorldState.trim() : "";
  return {
    ...(ws.length > 0 ? { resultingWorldState: ws } : {}),
    escalationText: b.escalationText.trim(),
    tradeoffChoices: b.tradeoffChoices.map(choice),
    actionDecision: { prompt: b.actionDecision.prompt.trim(), choices: b.actionDecision.choices.map(actionChoice) },
  };
}

// ---------------------------------------------------------------------------
// Full-draft validation
// ---------------------------------------------------------------------------

/**
 * Deterministically validate a three-phase draft. Checks: all three phases exist;
 * required text present + bounded; valid choice count per phase; stable non-empty
 * choice ids, globally unique; non-empty choice labels; at least one Action
 * Decision choice is a real action commitment. Sensitive-info matches are surfaced
 * as WARNINGS (never a silent block). Pure.
 */
export function validateArenaScenarioDraft(draft: unknown): DraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(draft)) return { ok: false, errors: ["draft_invalid"], warnings };

  const d = draft as Partial<ArenaScenarioDraft>;

  // Title + opening.
  if (!isNonEmptyString(d.title)) errors.push("missing_title");
  else if (d.title.trim().length > TITLE_MAX) errors.push("title_too_long");
  if (!isNonEmptyString(d.opening)) errors.push("missing_opening");
  else if (d.opening.trim().length > OPENING_MAX) errors.push("opening_too_long");

  const seenIds = new Set<string>();

  // PRIMARY.
  if (!isObject(d.primary)) errors.push("primary_missing");
  else validateChoiceList(d.primary.choices, "primary", PRIMARY_CHOICES_MIN, PRIMARY_CHOICES_MAX, seenIds, errors);

  // TRADEOFF (escalation + choices).
  if (!isObject(d.tradeoff)) {
    errors.push("tradeoff_missing");
  } else {
    if (!isNonEmptyString(d.tradeoff.escalationText)) errors.push("missing_escalation");
    else if (d.tradeoff.escalationText.trim().length > ESCALATION_MAX) errors.push("escalation_too_long");
    validateChoiceList(d.tradeoff.choices, "tradeoff", TRADEOFF_CHOICES_MIN, TRADEOFF_CHOICES_MAX, seenIds, errors);
  }

  // ACTION DECISION (prompt + choices + >=1 commitment).
  if (!isObject(d.actionDecision)) {
    errors.push("action_missing");
  } else {
    if (!isNonEmptyString(d.actionDecision.prompt)) errors.push("missing_action_prompt");
    else if (d.actionDecision.prompt.trim().length > ACTION_PROMPT_MAX) errors.push("action_prompt_too_long");
    validateChoiceList(d.actionDecision.choices, "action", ACTION_CHOICES_MIN, ACTION_CHOICES_MAX, seenIds, errors);

    const choices = Array.isArray(d.actionDecision.choices) ? d.actionDecision.choices : [];
    const anyCommitment = choices.some(
      (c) => isObject(c) && (c as ActionDecisionChoice).isActionCommitment === true,
    );
    if (!anyCommitment) errors.push("no_action_commitment");
    // Every action choice must carry an explicit boolean commitment flag.
    for (const c of choices) {
      if (isObject(c) && typeof (c as { isActionCommitment?: unknown }).isActionCommitment !== "boolean") {
        errors.push("action_choice_missing_commitment_flag");
      }
    }
  }

  // Branches (Slice 3.2I) — only when present. A branch-aware draft must still carry
  // valid flat fields (legacy fallback) AND one valid branch per primary choice id.
  if ((d as { branches?: unknown }).branches !== undefined) {
    const primaryIds = isObject(d.primary)
      ? (Array.isArray(d.primary.choices) ? d.primary.choices : [])
          .filter((c): c is ScenarioDraftChoice => isObject(c) && isNonEmptyString((c as { id?: unknown }).id))
          .map((c) => c.id.trim())
      : [];
    validateBranches((d as { branches?: unknown }).branches, primaryIds, errors);
  }

  // Sensitive-info sweep across every learner-facing string (advisory).
  if (errors.length === 0) {
    for (const s of allDraftText(draft as ArenaScenarioDraft)) {
      for (const code of detectSensitiveInfo(s)) if (!warnings.includes(code)) warnings.push(code);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Coerce + validate an UNTRUSTED value (LLM JSON output) into a typed draft. On
 * success returns the normalized `ArenaScenarioDraft` (trimmed strings, choices
 * projected to their exact fields). On failure returns the blocking error codes.
 * Warnings (sensitive info) are carried through so the caller can surface them.
 */
export function parseArenaScenarioDraft(
  raw: unknown,
): { ok: true; value: ArenaScenarioDraft; warnings: string[] } | { ok: false; errors: string[] } {
  const v = validateArenaScenarioDraft(raw);
  if (!v.ok) return { ok: false, errors: v.errors };

  const r = raw as ArenaScenarioDraft;
  const choice = (c: ScenarioDraftChoice): ScenarioDraftChoice => ({ id: c.id.trim(), label: c.label.trim() });
  const actionChoice = (c: ActionDecisionChoice): ActionDecisionChoice => ({
    id: c.id.trim(),
    label: c.label.trim(),
    isActionCommitment: c.isActionCommitment === true,
  });

  const value: ArenaScenarioDraft = {
    title: r.title.trim(),
    opening: r.opening.trim(),
    primary: { choices: r.primary.choices.map(choice) },
    tradeoff: { escalationText: r.tradeoff.escalationText.trim(), choices: r.tradeoff.choices.map(choice) },
    actionDecision: { prompt: r.actionDecision.prompt.trim(), choices: r.actionDecision.choices.map(actionChoice) },
  };

  // Slice 3.2I — PRESERVE branches (the historical flattening bug: this projection
  // dropped every unknown key). Validation above already proved the branch map valid.
  if (r.branches && isObject(r.branches)) {
    const branches: Record<string, ScenarioBranch> = {};
    for (const [key, b] of Object.entries(r.branches)) branches[key] = normalizeBranch(b as ScenarioBranch);
    value.branches = branches;
  }

  return { ok: true, value, warnings: v.warnings };
}

// ---------------------------------------------------------------------------
// Guided-answer validation
// ---------------------------------------------------------------------------

export const AVOIDANCE_TEXT_MAX = 600;
export const HARDEST_CUSTOM_MAX = 300;

/**
 * Validate the two guided answers from an untrusted payload. Q1 requires a valid
 * option (and non-empty custom text when "other"); Q2 requires non-empty free
 * text. Returns the normalized answers or blocking codes. Pure.
 */
export function parseGuidedAnswers(
  raw: unknown,
): { ok: true; value: GuidedAnswers } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(raw)) return { ok: false, errors: ["guided_answers_invalid"] };

  const hw = (raw as { hardestWhen?: unknown }).hardestWhen;
  const ap = (raw as { avoidancePressure?: unknown }).avoidancePressure;

  let choice: GuidedAnswers["hardestWhen"]["choice"] | null = null;
  let customText: string | undefined;
  if (!isObject(hw) || !isHardestWhenOption((hw as { choice?: unknown }).choice)) {
    errors.push("hardest_when_invalid");
  } else {
    choice = (hw as { choice: GuidedAnswers["hardestWhen"]["choice"] }).choice;
    const custom = (hw as { customText?: unknown }).customText;
    if (choice === "other") {
      if (!isNonEmptyString(custom)) errors.push("hardest_when_custom_required");
      else if (custom.trim().length > HARDEST_CUSTOM_MAX) errors.push("hardest_when_custom_too_long");
      else customText = custom.trim();
    } else if (isNonEmptyString(custom)) {
      customText = custom.trim().slice(0, HARDEST_CUSTOM_MAX);
    }
  }

  let avoidanceText = "";
  const apText = isObject(ap) ? (ap as { text?: unknown }).text : undefined;
  if (!isNonEmptyString(apText)) errors.push("avoidance_pressure_required");
  else if (apText.trim().length > AVOIDANCE_TEXT_MAX) errors.push("avoidance_pressure_too_long");
  else avoidanceText = apText.trim();

  if (errors.length > 0 || choice === null) return { ok: false, errors: errors.length ? errors : ["guided_answers_invalid"] };

  return {
    ok: true,
    value: { hardestWhen: { choice, ...(customText ? { customText } : {}) }, avoidancePressure: { text: avoidanceText } },
  };
}
