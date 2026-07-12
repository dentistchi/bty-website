/**
 * todayRelationshipCommitment (domain) — the canonical vocabulary + mapping for a confirmed daily
 * relationship commitment. Pure: no I/O, no Date.now(), no side effects.
 *
 * The COMMITMENT is the user's confirmed relationship DECISION for one canonical BTY day
 * (Self/Others/World → 'self'/'others'/'world'). It is intentionally separate from any generated
 * "Living Response": this module knows nothing about AI, prompts, evidence, or provider output.
 *
 * Storage/UI split:
 *  - DB / wire value  = lowercase RelationshipValue ('self' | 'others' | 'world').
 *  - UI door key      = capitalized RelationshipFocus ('Self' | 'Others' | 'World'), matching the
 *    existing TodayFocusKey used by the Today doors. Mapping lives here (pure string maps) so the
 *    domain stays UI-free while the shell can reuse it without duplicating literals.
 */

export const RELATIONSHIP_VALUES = ["self", "others", "world"] as const;
export type RelationshipValue = (typeof RELATIONSHIP_VALUES)[number];

export type RelationshipFocus = "Self" | "Others" | "World";

/** Canonical shape returned to the client for a committed day (never exposes user_id/id). */
export type TodayCommitment = {
  relationship: RelationshipValue;
  suggestedRelationship: RelationshipValue | null;
  dayKey: string;
  confirmedAt: string;
  locale: string | null;
  timezoneSnapshot: string;
  tzFallback: boolean;
};

/** Runtime guard for untrusted input (route body). */
export function isRelationshipValue(x: unknown): x is RelationshipValue {
  return typeof x === "string" && (RELATIONSHIP_VALUES as readonly string[]).includes(x);
}

const FOCUS_TO_VALUE: Record<RelationshipFocus, RelationshipValue> = {
  Self: "self",
  Others: "others",
  World: "world",
};
const VALUE_TO_FOCUS: Record<RelationshipValue, RelationshipFocus> = {
  self: "Self",
  others: "Others",
  world: "World",
};

export function relationshipFromFocus(focus: RelationshipFocus): RelationshipValue {
  return FOCUS_TO_VALUE[focus];
}

export function focusFromRelationship(value: RelationshipValue): RelationshipFocus {
  return VALUE_TO_FOCUS[value];
}
