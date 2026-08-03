import { HARDEST_WHEN_OPTIONS, type HardestWhenOption } from "@/domain/foundry/arena-draft/types";

/**
 * ONE GUIDED-QUESTION VOCABULARY (Slice 3.2I-R5B2-R5C-4B-R1).
 *
 * Review setup edits the same two answers the creation flow collects. Giving it its own option list
 * would let the two drift, and a Host would then be offered a choice at edit time that generation
 * has never seen — or lose one that it has. So both screens resolve their options through here, and
 * a parity test asserts it against the domain constant rather than a copied literal.
 */

/** The complete domain vocabulary, in the domain's own order. */
export const ALL_HARDEST_WHEN_OPTIONS: readonly HardestWhenOption[] = HARDEST_WHEN_OPTIONS;

/**
 * The options to offer for one draft.
 *
 * A source may narrow the list, but it may never introduce a value the domain does not define —
 * an unrecognised option would be stored and then fail validation on save. An empty or absent
 * source list falls back to the full vocabulary rather than rendering nothing.
 */
export function resolveHardestWhenOptions(sourceOptions: readonly string[] | null | undefined): HardestWhenOption[] {
  const known = (sourceOptions ?? []).filter((o): o is HardestWhenOption =>
    (ALL_HARDEST_WHEN_OPTIONS as readonly string[]).includes(o),
  );
  return known.length > 0 ? known : [...ALL_HARDEST_WHEN_OPTIONS];
}

/**
 * Does this choice make its free-text field generation-relevant?
 *
 * Measured from the prompt builder: `customText` is read ONLY under `other`. Showing the field
 * elsewhere would invite a Host to write something the model will never see.
 */
export const showsCustomText = (choice: HardestWhenOption | null | undefined): boolean => choice === "other";

/** Ready to save: a choice, and — only where it is read — non-empty text. */
export function guidedAnswersReady(choice: HardestWhenOption | null, customText: string, pressure: string): boolean {
  if (!choice) return false;
  if (showsCustomText(choice) && customText.trim().length === 0) return false;
  return pressure.trim().length > 0;
}
