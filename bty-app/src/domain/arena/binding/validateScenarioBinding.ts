/**
 * Load-time binding validation — JSON must declare explicit DB ids before choices are clickable.
 * Pure domain: no HTTP or Supabase.
 */

export type BindingValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type ScenarioBindingInput = {
  dbScenarioId?: string;
  choices: Array<{ choiceId: string; dbChoiceId?: string }>;
};

/**
 * @param allowedDbChoiceIds — catalog / engine ids allowed for this scenario (e.g. from Supabase or elite map).
 */
export function validateScenarioBinding(
  scenario: ScenarioBindingInput,
  allowedDbChoiceIds: string[],
): BindingValidationResult {
  if (!scenario.dbScenarioId?.trim()) {
    return { ok: false, reason: "missing_dbScenarioId" };
  }

  if (!scenario.choices.length) {
    return { ok: false, reason: "missing_choices" };
  }

  const allowed = new Set(allowedDbChoiceIds);

  for (const choice of scenario.choices) {
    const cid = choice.choiceId;
    if (!choice.dbChoiceId?.trim()) {
      return { ok: false, reason: `missing_dbChoiceId:${cid}` };
    }
    if (!allowed.has(choice.dbChoiceId)) {
      return { ok: false, reason: `unmatched_dbChoiceId:${choice.dbChoiceId}` };
    }
  }

  return { ok: true };
}
