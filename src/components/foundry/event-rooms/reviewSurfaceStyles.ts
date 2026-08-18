/**
 * REVIEW VISUAL GRAMMAR (Slice R4-R2E).
 *
 * THE MEASURED DEFECT. On the Review screen a Host could not tell what they were allowed to
 * change. Measured at `30311d96`, byte-identical class strings were carried by an element the
 * Host may type into and by one they may not:
 *
 *   ProgramAuthorship, read-only derived sentence   `rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85`
 *   ProgramAuthorship, editable narrative textarea  `rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85`
 *
 * The same string also dressed the Host's preserved wording (`program-current-*`, read-only), the
 * contract fields inside "Edit details" (editable), and every learner-facing box in the Learner
 * Preview (editable). Six surfaces, two opposite meanings, one appearance. Nothing on screen
 * separated them, so the only way to discover an editable box was to tap it.
 *
 * THE RULE, IN ONE PLACE. Both grammars live here so they cannot drift apart again, and so a test
 * can assert the DISTINCTION rather than a copy of whichever class string happens to be current.
 *
 * NOT COLOUR-ONLY. The two differ in shape before they differ in hue: an editable surface is a
 * real form control with a full boundary, a raised ground, a hover response and a focus ring; a
 * read-only one has no box at all — a left rule and quieter text, the shape of a quotation. Remove
 * every colour and the difference survives.
 */

/**
 * EDITABLE. Put this on the control itself — `input`, `textarea`, `select`. Never on a `div`
 * dressed to look like one: the affordance and the semantics have to be the same object, or the
 * keyboard and the screen reader disagree with the eye.
 *
 * `focus:` carries the visible focus state required for keyboard use; the ring is drawn INSIDE
 * (`ring-inset`) so a field sitting flush against a card edge cannot have its focus state clipped.
 */
export const EDITABLE_FIELD_FRAME =
  "w-full rounded-lg border border-[#C9A66B]/40 px-3 py-2 text-white/90 " +
  "placeholder:text-white/40 transition-colors hover:border-[#C9A66B]/65 " +
  "focus:border-[#C9A66B] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#C9A66B]/45";

/**
 * The frame plus the raised field ground. Split from the frame because a `<select>` needs an
 * OPAQUE background for its dropdown, and two background utilities in one class attribute do not
 * resolve by attribute order — the stylesheet's order decides, which is not ours to depend on.
 */
export const EDITABLE_FIELD = `${EDITABLE_FIELD_FRAME} bg-white/[0.07]`;

/**
 * READ-ONLY. A generated or already-settled sentence the Host is reading, not filling in. No
 * border box, no field ground — a left rule and text, so it reads as a summary rather than as a
 * disabled control.
 *
 * DELIBERATELY NOT A DISABLED FORM CONTROL. A `<textarea disabled>` would still look like a place
 * to type, would still be announced as a text field, and would invite exactly the tap-to-find-out
 * behaviour this slice removes. Read-only content is a paragraph.
 */
export const READONLY_TEXT =
  "border-l-2 border-white/15 pl-3 text-sm leading-6 text-white/75";

/*
  THE "EDITABLE" CHIP IS GONE (Slice R4-R2E-R3). R4-R2E shipped it as a words-based cue beside
  the shape-based one. On the device the two together read as clutter: an eyebrow, a chip, a
  sentence and a per-field badge, all saying what the gold field already says. The section-level
  sentence is kept — it is the one that explains — and the constant is deleted rather than left
  unused, so nothing invites the repetition back. Nothing was lost from the accessible tree:
  every chip was `aria-hidden`, and the names come from `htmlFor` / `aria-label`.
*/

/**
 * Stable hooks for the two grammars, so tests and future surfaces name the INTENT rather than
 * matching an incidental class string.
 */
export const SURFACE_EDITABLE = { "data-surface": "editable" } as const;
export const SURFACE_READONLY = { "data-surface": "readonly" } as const;
