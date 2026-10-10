/**
 * Practice Debrief V1 — what each choice protected, and what it cost (pure).
 *
 * THE GAP
 *
 * A learner finished a Practice and read "Practice complete — nothing here counts against you."
 * That is the whole of the feedback. Meanwhile the generator had written, for EVERY choice, the
 * legitimate value it protects and the real cost it accepts (`ProviderChoiceConstruction`, R2.22),
 * the deterministic gates had refused placeholder or bad-faith justifications, the independent
 * reviewer had checked them — and then they were discarded. The learner did the TRY and never got
 * the FEEDBACK: why each option was defensible, and what their own choice gave up.
 *
 * WHAT THIS KEEPS, AND WHAT IT DOES NOT
 *
 * Only `legitimateValue` and `acceptedCost`, only from an ACCEPTED generation, and only after the
 * learner has decided. They were never shown during the choice and still are not — the generation
 * prompt's "do not write those labels into the learner-facing copy" governs the decision surface,
 * where naming the value would cue the answer. Nothing here ranks a choice: Arena has no correct
 * answer, and both options at every decision are, by construction, defensible.
 *
 * Every entry is bound to the label it was written for. A Host can edit a label after generation;
 * an entry whose label no longer matches describes a choice the learner never saw, so it is dropped
 * rather than shown. Missing or unusable debrief is never an error — the learner gets the old
 * completion screen, which is exactly what every existing Practice already shows.
 *
 * Pure domain: no I/O, no provider, no DB, no display strings.
 */

import { GEN_COST_MAX, GEN_VALUE_MAX, isBranchAware, type ArenaScenarioDraft, type ScenarioDraftChoice } from "./types";
import { enumerateChoices } from "./choiceConstruction";

/** One choice's reviewed reasoning, bound to the exact label it explains. */
export type ChoiceDebrief = {
  forLabel: string;
  protects: string;
  costs: string;
};

/** Keyed by canonical (server-assigned) choice id. */
export type ScenarioDebrief = Record<string, ChoiceDebrief>;

export type DebriefStage = "primary" | "tradeoff" | "action";

export type DebriefSide = { label: string; protects: string; costs: string };

export type DebriefStageView = {
  stage: DebriefStage;
  chosen: DebriefSide;
  /** The option the learner did not take at this moment. Null when it has no usable entry. */
  other: DebriefSide | null;
};

const hasHangul = (s: string) => /[가-힣]/.test(s);

/**
 * The construction fields are written as internal metadata, so a Korean scenario can come back with
 * English reasoning. Showing English inside a Korean Practice is worse than showing nothing.
 */
function matchesScenarioLanguage(text: string, scenarioIsKorean: boolean): boolean {
  return scenarioIsKorean ? hasHangul(text) : !hasHangul(text);
}

function cleanField(raw: unknown, max: number, scenarioIsKorean: boolean): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > max) return null;
  if (!matchesScenarioLanguage(s, scenarioIsKorean)) return null;
  return s;
}

function scenarioIsKorean(draft: ArenaScenarioDraft): boolean {
  return hasHangul(`${draft.title} ${draft.opening}`);
}

/**
 * Build the debrief from an ACCEPTED generation's construction records. All-or-nothing: if any
 * learner-facing choice lacks a usable value and cost, there is no debrief at all — a debrief that
 * explains one side of a decision and not the other would read as a preference.
 */
export function buildScenarioDebrief(draft: ArenaScenarioDraft, constructionsByChoiceId: unknown): ScenarioDebrief | null {
  if (typeof constructionsByChoiceId !== "object" || constructionsByChoiceId === null) return null;
  const map = constructionsByChoiceId as Record<string, unknown>;
  const ko = scenarioIsKorean(draft);
  const out: ScenarioDebrief = {};
  for (const c of enumerateChoices(draft)) {
    const raw = map[c.id];
    if (typeof raw !== "object" || raw === null) return null;
    const k = raw as { legitimateValue?: unknown; acceptedCost?: unknown };
    const protects = cleanField(k.legitimateValue, GEN_VALUE_MAX, ko);
    const costs = cleanField(k.acceptedCost, GEN_COST_MAX, ko);
    if (!protects || !costs) return null;
    out[c.id] = { forLabel: c.label.trim(), protects, costs };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Coerce an UNTRUSTED stored/edited debrief against the scenario it rides on. Keeps only entries for
 * choices that exist AND whose label is still the one the entry was written for. Never an error:
 * a malformed debrief is dropped, because losing it only removes help — it never changes what the
 * learner is asked to decide.
 */
export function parseScenarioDebrief(raw: unknown, draft: ArenaScenarioDraft): ScenarioDebrief | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const map = raw as Record<string, unknown>;
  const ko = scenarioIsKorean(draft);
  const out: ScenarioDebrief = {};
  for (const c of enumerateChoices(draft)) {
    const e = map[c.id];
    if (typeof e !== "object" || e === null) continue;
    const entry = e as { forLabel?: unknown; protects?: unknown; costs?: unknown };
    if (typeof entry.forLabel !== "string" || entry.forLabel.trim() !== c.label.trim()) continue;
    const protects = cleanField(entry.protects, GEN_VALUE_MAX, ko);
    const costs = cleanField(entry.costs, GEN_COST_MAX, ko);
    if (!protects || !costs) continue;
    out[c.id] = { forLabel: c.label.trim(), protects, costs };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function side(debrief: ScenarioDebrief, c: ScenarioDraftChoice): DebriefSide | null {
  const e = debrief[c.id];
  if (!e || e.forLabel.trim() !== c.label.trim()) return null;
  return { label: c.label, protects: e.protects, costs: e.costs };
}

function stageView(
  stage: DebriefStage,
  siblings: ScenarioDraftChoice[],
  chosenId: string | null | undefined,
  debrief: ScenarioDebrief,
): DebriefStageView | null {
  if (!chosenId) return null;
  const chosenChoice = siblings.find((c) => c.id === chosenId);
  if (!chosenChoice) return null;
  const chosen = side(debrief, chosenChoice);
  if (!chosen) return null;
  const others = siblings.filter((c) => c.id !== chosenId).map((c) => side(debrief, c));
  // Generated Practice has exactly two options per decision. With more (legacy shapes) there is no
  // single "other" to set beside the learner's choice, so only their own reasoning is shown.
  const other = others.length === 1 ? others[0] : null;
  return { stage, chosen, other };
}

/**
 * The debrief for the path the learner actually walked, in decision order. Empty when the scenario
 * carries no debrief, or none of the walked choices has a usable entry — the caller then shows the
 * plain completion screen.
 */
export function debriefForPath(
  scenario: ArenaScenarioDraft,
  path: { primaryChoiceId?: string | null; tradeoffChoiceId?: string | null; actionChoiceId?: string | null },
): DebriefStageView[] {
  const debrief = scenario.debrief;
  if (!debrief || !path.primaryChoiceId) return [];
  const branch = isBranchAware(scenario) ? scenario.branches[path.primaryChoiceId] : undefined;
  if (isBranchAware(scenario) && !branch) return [];
  const tradeoffChoices = branch ? branch.tradeoffChoices : scenario.tradeoff.choices;
  const actionChoices = branch ? branch.actionDecision.choices : scenario.actionDecision.choices;
  return [
    stageView("primary", scenario.primary.choices, path.primaryChoiceId, debrief),
    stageView("tradeoff", tradeoffChoices, path.tradeoffChoiceId, debrief),
    stageView("action", actionChoices, path.actionChoiceId, debrief),
  ].filter((v): v is DebriefStageView => v !== null);
}
