/**
 * A PRIMARY CHOICE WHOSE OWN TEXT STATES THE PREREQUISITE IS UNMET
 * (Slice 3.2I-R5B1A.1-R2.36 Part 11).
 *
 * WHY THIS FIXTURE EXISTS
 *
 * R2.35's human oracle marks `primary[1]` — "Notify the families and proceed with one patient" — a
 * violation, and the live reviewer answered `not_applicable` in 3 of 3 runs. R2.36 does not fix
 * that, and must not pretend to: at the primary decision point NOTHING in the scenario states that
 * identifiers are unverified. The only signal is that the SIBLING choice offers to verify them.
 * Under this contract that is `not_established`, and `not_established` is deliberately not a
 * violation — silence is not failure. The live false negative on `primary[1]` is therefore carried
 * forward UNMEASURED, and no gate here is tuned to make it disappear.
 *
 * What this fixture DOES prove is the complementary half: when a primary choice's own text says the
 * prerequisite is unmet, the contract grounds a violation at the ROOT of the causal chain. Without
 * it, every causal-derivation test would have to root itself at a branch, and the claim "the
 * earliest causal violation is found" would never actually be exercised at a primary.
 *
 * It is a LOCAL fixture. It is not evidence about live reviewer behaviour.
 *
 * Pure domain: no I/O.
 */

import type { ArenaScenarioDraft } from "./types";

/** The single edit: `primary[1]` now states, in its own words, that the second patient is unverified. */
export const GROUNDED_PRIMARY_TEXT = "Proceed with treatment for the second, still unverified patient";

/**
 * The `draftFixture()` shape with that one choice replaced. Kept as a function so callers cannot
 * share mutable state between tests.
 */
export function groundedPrimaryDraft(base: ArenaScenarioDraft): ArenaScenarioDraft {
  const copy = JSON.parse(JSON.stringify(base)) as ArenaScenarioDraft;
  const choices = (copy.primary as { choices?: Array<{ text?: string; label?: string }> } | undefined)?.choices ?? [];
  const second = choices[1];
  if (second) {
    if (typeof second.text === "string") second.text = GROUNDED_PRIMARY_TEXT;
    if (typeof second.label === "string") second.label = GROUNDED_PRIMARY_TEXT;
  }
  return copy;
}
