/**
 * yesterdayMemory (domain) — Yesterday → Today Memory Bridge V1.
 *
 * A PURE, deterministic resolver: given provenance-safe evidence of what the user actually
 * committed to YESTERDAY, produce ONE quiet remembered line for today's arrival trace — or null.
 *
 * Product law: "BTY remembers yesterday without judging it." This is a remembered *relationship*,
 * NOT a report. No scores, no streaks, no completion claims, no coaching, no diagnosis. The only
 * fact surfaced is the relationship the user themself chose — never fabricated, never inflated.
 *
 * Boundaries this resolver deliberately keeps:
 *   - A committed relationship is a CHOICE, not an action completed → the copy never says
 *     "you did", "you completed", "you succeeded", or names any outcome.
 *   - Presence (a user_day row) is NOT completion, so it is not an input here.
 *   - If yesterday has no commitment, or the stored relationship is unusable, → null (render
 *     nothing; Today's existing arrival stays byte-identical for no-evidence users).
 *
 * English-only by scope (V1 does not extend the KO locale surface).
 */
import type { LivingResponseRelationship } from "./livingResponse";
import { isLivingResponseRelationship } from "./livingResponse";

/** Provenance-safe evidence of yesterday, as read by the server loader. */
export type YesterdayMemoryEvidence = {
  /** True when a yesterday commitment row existed for this user/day. */
  existed: boolean;
  /** The canonical relationship the user committed to yesterday (or null if degraded/absent). */
  relationship: LivingResponseRelationship | null;
};

/** The resolved memory: one short line for the existing arrival trace. */
export type YesterdayMemory = { line: string; source: "relationship" };

/**
 * The one remembered line per relationship. Single line (matches the arrival trace's reserved
 * one-line height → zero layout shift). Warm, observational, present-tense choice — no verdict.
 */
const RELATIONSHIP_LINE: Record<LivingResponseRelationship, string> = {
  self: "Yesterday, you chose to return to yourself.",
  others: "Yesterday, you chose to show up for someone.",
  world: "Yesterday, you chose to meet the world.",
};

/**
 * Resolve yesterday's remembered line, deterministically. Returns null whenever there is no
 * honest relationship to reflect — the caller then renders the existing arrival trace unchanged.
 */
export function resolveYesterdayMemory(ev: YesterdayMemoryEvidence): YesterdayMemory | null {
  if (!ev.existed) return null;
  // Never fabricate: only a valid, canonical relationship becomes a memory.
  if (!isLivingResponseRelationship(ev.relationship)) return null;
  return { line: RELATIONSHIP_LINE[ev.relationship], source: "relationship" };
}
