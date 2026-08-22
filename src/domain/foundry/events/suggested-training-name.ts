/**
 * SUGGESTED TRAINING NAME — pure domain rule (Slice R4-R5C7A).
 *
 * A signed-in learner opening their first Training Room was asked "What's your name?" from an
 * empty field, moments after signing in. R4-R5C7 measured why that could not simply be skipped:
 * `participant.display_name` is shown to the Host (roster, attention, review, history) and to an
 * observing colleague, and TODAY THE LEARNER CHOOSES IT. Substituting a provider profile name
 * silently would convert a chosen disclosure into an automatic one.
 *
 * So this resolves a SUGGESTION, never an identity. It fills the field; the learner still decides
 * what is submitted, and their submitted value remains the sole authority.
 *
 * THE PRECEDENCE IS DELIBERATELY SHORT, AND ENDS IN NULL
 * -----------------------------------------------------
 *   1. user_metadata.full_name
 *   2. user_metadata.name
 *   3. null  ->  the learner types one, exactly as before
 *
 * WHAT IS REFUSED, AND WHY EACH ONE
 * ---------------------------------
 *   email / local-part      an address is not a name; "j.smith88" is not what a colleague is called
 *   arena_profiles.display_name   a PUBLIC LEADERBOARD NICKNAME, tier-gated — wrong register for a
 *                                 workplace training roster a Host reads
 *   arena_profiles.full_name      measured to add ZERO coverage (0 accounts have it without a
 *                                 provider name), so it buys an Arena -> Foundry dependency for nothing
 *   org membership / invitation   same boundary, same absence of coverage
 *   another participant's name    that is somebody else, including the previous account on this device
 *   guessed initials              inventing identity is the failure this rule exists to avoid
 *
 * `/api/bty/events/mine/[eventId]` documents a broader "Locked identity precedence (R2)" whose last
 * rung is email. That is correct for ITS Host-facing participation list and is not copied here: a
 * suggestion the learner is about to publish to their Host must never default to their address.
 *
 * COVERAGE IS PARTIAL BY MEASUREMENT, NOT BY OVERSIGHT. 27 of 35 accounts carry a provider name
 * (Google 26/26, email 1/9). The other 23% legitimately keep typing one, which is why the field
 * and its validation are untouched.
 *
 * Pure: no I/O, no DB, no auth call. The caller supplies metadata it obtained server-side.
 */

/** Trim, and reject the strings that mean "absent" once serialized through metadata. */
function usable(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "null" || lower === "undefined") return null;
  return t;
}

/**
 * @param metadata the authenticated user's `user_metadata`, or null/undefined when anonymous.
 * @returns a name to PREFILL the field with, or null to leave it empty.
 */
export function resolveSuggestedTrainingName(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  return usable(metadata.full_name) ?? usable(metadata.name);
}
