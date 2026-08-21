/**
 * Participant ↔ account compatibility — pure domain rule (Slice R4-R5C3A1).
 *
 * A participant session lives in a per-event HttpOnly cookie that outlives the BTY auth
 * session: signing out never clears `bty_fr_ps_*` (measured — the auth code contains zero
 * references to it). So one browser can present a participant created by one account while a
 * DIFFERENT account is signed in, and before this rule nothing noticed:
 *
 *     participant P (created by user A)  +  auth session = user B
 *       -> completion wrote progress.linked_user_id = B onto A's participant
 *       -> the assignment claim could bind A's participant to B's assignment
 *
 * That is contradictory identity truth, and it predates this slice — but the new
 * `participants.user_id` edge is what finally makes it VISIBLE, so it must not be the thing
 * that makes it worse.
 *
 * THE RULE IS DELIBERATELY NARROW. Incompatible means one specific, provable disagreement:
 * the participant is already bound to an account AND a different account is asking.
 *
 *   participant.user_id | auth user | verdict     | why
 *   -------------------|-----------|-------------|--------------------------------------------
 *   A                  | A         | compatible  | the same person returning
 *   A                  | B         | INCOMPATIBLE| a real conflict — the only refusing case
 *   A                  | none      | compatible  | signed-out room use is existing behaviour
 *   null               | B         | compatible  | an anonymous learner who signed in later;
 *                      |           |             | the claim flow depends on exactly this
 *   null               | none      | compatible  | ordinary anonymous participation
 *
 * A NULL participant is NOT a mismatch. Treating it as one would break the anonymous →
 * signed-in claim path, which is the product's most-used open-link flow.
 *
 * Pure: no I/O, no DB, no session reading. The caller supplies both values, both of which it
 * obtained server-side.
 */

/**
 * True when this participant session may be used ON BEHALF OF the given authenticated account
 * (or with no account at all). False ONLY for a proven cross-account conflict.
 *
 * @param participantUserId the account edge stored on the participant row (null = anonymous)
 * @param authUserId        the SERVER-DERIVED caller, or null when the request is anonymous
 */
export function isParticipantAccountCompatible(
  participantUserId: string | null | undefined,
  authUserId: string | null | undefined,
): boolean {
  if (!participantUserId) return true; // anonymous participant — never a conflict
  if (!authUserId) return true; // no account is asking — signed-out room use is unchanged
  return participantUserId === authUserId;
}

/**
 * True when account-level side effects (identity link, Core XP, follow-up, apply window,
 * assignment claim) may be attributed to `authUserId` through this participant.
 *
 * This is the completion-side safety belt (R4-R5C3A1 §7). It is the SAME predicate as
 * {@link isParticipantAccountCompatible} — stated separately because the two callers answer
 * different questions and must not drift: one decides whether a room session is usable, the
 * other decides whether an account may be credited. Both refuse the same single case, and a
 * refusal here never blocks the participant's own truthful completion.
 */
export function mayAttributeToAccount(
  participantUserId: string | null | undefined,
  authUserId: string | null | undefined,
): boolean {
  if (!authUserId) return false; // nothing to attribute to
  return isParticipantAccountCompatible(participantUserId, authUserId);
}
