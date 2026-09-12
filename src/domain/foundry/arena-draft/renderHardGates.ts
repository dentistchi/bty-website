/**
 * DETERMINISTIC RENDER HARD GATES V1 (Slice 3.2I-R5B1A.1-R2.29).
 *
 * TWO MEASURED RENDER FAILURES, caught by proof rather than by judgment.
 *
 * GATE 1 — SIBLING CHOICE-PAIR IDENTITY. The full-retention 36-run produced sibling branches whose
 * rendered choice pairs were the same two options, sometimes with the order swapped. A learner who
 * picks p1 and a learner who picks p2 are then handed the identical decision, so the primary choice
 * changed nothing about what they actually do next.
 *
 * GATE 2 — PLAN DIMENSION LEAKAGE. Plan-Then-Render drafts rendered planning metadata into
 * learner-facing labels: the dimension QUESTION offered as if it were an option, or the raw
 * snake_case `dimensionId` printed into text a learner reads.
 *
 * WHAT THESE GATES ARE NOT
 *
 * Neither gate understands meaning. Gate 1 is set identity over normalized text; Gate 2 is exact
 * equality against declared Plan text plus a literal metadata-token search. There is no similarity
 * score, no stemming, no synonym folding and no morphological analysis anywhere in this file. Two
 * labels a person would call "the same idea" but that differ as text are NOT caught here — that
 * class stayed with human review when Commander Decision B removed the reviewer's paraphrase veto,
 * and this file does not quietly take it back.
 *
 * Pure domain: no I/O, no provider, no DB.
 */

import { flat, type DecisionPlan } from "./decisionPlan";
import { enumerateChoices } from "./choiceConstruction";
import type { ArenaScenarioDraft } from "./types";

export const RENDER_HARD_GATE_CODES = ["sibling_choice_pair_identical", "plan_dimension_label_leakage"] as const;
export type RenderHardGateCode = (typeof RENDER_HARD_GATE_CODES)[number];

export type RenderGateResult = { ok: boolean; errors: string[]; warnings: string[] };

/** The two phases a branch renders. Tradeoff is compared with tradeoff, action with action. */
const BRANCH_PHASES = ["tradeoff", "action"] as const;

/**
 * Unordered multiset key for one rendered pair.
 *
 * Sorting is what makes ["A","B"] and ["B","A"] the same pair: a reversal is a presentation detail,
 * not a different decision. Sorting the NORMALIZED values keeps duplicates, so a pair repeating one
 * label twice never collapses into a single-element key.
 */
const pairKey = (labels: string[]): string => labels.map(flat).sort().join(" || ");

/** A pair only counts when it is actually there. Absence is a construction defect, never identity. */
const usablePair = (labels: string[]): boolean => labels.length === 2 && labels.every((l) => l.trim().length > 0);

function branchPair(draft: ArenaScenarioDraft, primaryId: string, phase: (typeof BRANCH_PHASES)[number]): string[] | null {
  const branch = draft.branches?.[primaryId];
  if (!branch) return null;
  const choices = phase === "tradeoff" ? branch.tradeoffChoices : branch.actionDecision?.choices;
  const labels = (choices ?? []).map((c) => String(c?.label ?? ""));
  return usablePair(labels) ? labels : null;
}

/**
 * GATE 1. Compares each phase ACROSS siblings, never tradeoff against action: a branch whose
 * tradeoff and action coincide is a within-branch loop, and the existing progression gates already
 * own that question.
 */
export function validateSiblingChoicePairs(draft: ArenaScenarioDraft): RenderGateResult {
  const errors: string[] = [];
  const primaryIds = (draft.primary?.choices ?? []).map((c) => c.id);

  for (const phase of BRANCH_PHASES) {
    const pairs = primaryIds.map((id) => branchPair(draft, id, phase)).filter((p): p is string[] => p !== null);
    const seen = new Set<string>();
    for (const labels of pairs) {
      const key = pairKey(labels);
      if (seen.has(key)) {
        errors.push("sibling_choice_pair_identical");
        break;
      }
      seen.add(key);
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [] };
}

/** Every Plan dimension the render must not hand back to the learner as an option. */
function planDimensions(plan: DecisionPlan): Array<{ id: string; text: string }> {
  const out = [{ id: plan.primary?.dimensionId ?? "", text: plan.primary?.dimension ?? "" }];
  for (const b of plan.branches ?? []) {
    out.push({ id: b.tradeoff?.dimensionId ?? "", text: b.tradeoff?.dimension ?? "" });
    out.push({ id: b.action?.dimensionId ?? "", text: b.action?.dimension ?? "" });
  }
  return out.filter((d) => d.id.trim() || d.text.trim());
}

/**
 * GATE 2 — PTR ONLY. A legacy draft has no Plan, so there is nothing to leak and the gate does not
 * apply; it returns ok rather than pretending to have checked.
 *
 * The id test deliberately requires an underscore. `what_to_communicate` appearing in learner text
 * is a metadata token that escaped; a one-word id like `timing` is an ordinary English word, and
 * matching it would reject natural options for using normal vocabulary. Narrow recall is the point:
 * this gate proves leakage, it does not hunt for it.
 */
export function validatePlanDimensionLeakage(draft: ArenaScenarioDraft, plan: DecisionPlan | null): RenderGateResult {
  if (!plan) return { ok: true, errors: [], warnings: [] };
  const dims = planDimensions(plan);
  const errors: string[] = [];

  for (const choice of enumerateChoices(draft)) {
    const raw = String(choice.label ?? "");
    if (!raw.trim()) continue;
    const normalized = flat(raw);
    for (const d of dims) {
      // A. the dimension QUESTION offered as if it were something to choose.
      if (d.text.trim() && normalized === flat(d.text)) errors.push("plan_dimension_label_leakage");
      // B. the literal metadata token printed into learner-facing text.
      if (d.id.includes("_") && raw.includes(d.id)) errors.push("plan_dimension_label_leakage");
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [] };
}
