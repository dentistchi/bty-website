/**
 * Saved-for-later triage — the decision, as a pure value (Slice T2).
 *
 * A capture is something the user did not want to lose. Triage answers the one question that
 * follows: deal with it soon, or keep it for later. That is the entire vocabulary — there is no
 * third choice, no priority scale, no due date and no completion here, because none of those is a
 * thing this product promises about a saved message.
 *
 * TRIAGE IS NOT LIFECYCLE. `status` (captured | promoted | dismissed) records what HAPPENED to a
 * capture; triage records what the user WANTS. Keeping them in separate columns keeps them
 * separate questions, and this module deliberately knows nothing about `status`, Action Contracts,
 * deadlines, reminders or XP.
 *
 * No I/O, no DB, no UI copy. `soon`/`later` are stored values, not labels — the surface chooses
 * its own words and its own language.
 */

/** The two decisions, and nothing else. */
export const TRIAGE_CHOICES = ["soon", "later"] as const;

export type TriageChoice = (typeof TRIAGE_CHOICES)[number];

/** Untriaged is the ABSENCE of a decision, modelled as null — never a third enum value. */
export type TriageState = TriageChoice | null;

/**
 * Accept a client-supplied choice, or refuse it.
 *
 * Fail closed and exact: only the literal strings `"soon"` and `"later"` are choices. A boolean,
 * a number, `"SOON"`, `" soon "`, `"none"` or `null` are all refusals rather than quietly
 * normalised guesses — the caller is asking to write a decision, so an unrecognised value means we
 * do not know what they decided.
 */
export function parseTriageChoice(raw: unknown): TriageChoice | null {
  return typeof raw === "string" && (TRIAGE_CHOICES as readonly string[]).includes(raw)
    ? (raw as TriageChoice)
    : null;
}

/**
 * Read a stored triage value back into state. Anything the column should not contain reads as
 * untriaged rather than throwing: a surface must still render a row whose data is unexpected, and
 * showing it as "not yet decided" is the honest degradation.
 */
export function triageStateOf(raw: unknown): TriageState {
  return parseTriageChoice(raw);
}

/** True when the user has made no decision yet. The only group that shows triage controls. */
export function isUntriaged(state: TriageState): boolean {
  return state === null;
}

/**
 * The one ordering the saved lane uses, as a pure rank.
 *
 * Undecided first, because it is the only thing on the screen that asks anything of the person.
 * Then `soon`, then `later`. Within a group the surface orders by time; that is not this
 * function's business.
 */
export function triageGroupRank(state: TriageState): 0 | 1 | 2 {
  if (state === null) return 0;
  return state === "soon" ? 1 : 2;
}
