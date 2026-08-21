import { createHash } from "node:crypto";

/**
 * OPAQUE LOCAL-DRAFT NAMESPACE — Slice R4-R5C4A, Step 0.
 *
 * WHY THIS EXISTS AT ALL. R4-R5C4 measured that a learner can type three substantive answers
 * and lose every one of them by refreshing. The repair is a device-local draft, and a
 * device-local draft needs a per-participant key. The browser did not have one:
 *
 *   the participant cookie is HttpOnly            -> unreadable by script, correctly
 *   the room snapshot projects { display_name }   -> the ONLY per-participant value it carries
 *   nothing else in the snapshot is participant-scoped
 *
 * A name is not an identity — two colleagues called 민준 must not share a draft, and one learner
 * who renames must not lose theirs. So the browser is given exactly one new thing: a value that
 * DISTINGUISHES a participant without IDENTIFYING them.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not the participant session token. Not `participant_session_token_hash`. Not the account id,
 * the email, or the display name. It authorises NOTHING: no route reads it, no route accepts it,
 * and presenting it grants nothing — a fact asserted by a repository guard test rather than by
 * this paragraph. Its entire job is to name a slot in one device's localStorage.
 *
 * WHY A PLAIN DIGEST AND NOT AN HMAC. A keyed digest would defend against someone who already
 * knows a participant id computing this value. That attacker gains nothing: the namespace only
 * ever appears on the one device that also holds that participant's cookie, and localStorage is
 * partitioned by origin AND by device. Since the value carries no authority, a secret would add
 * key management, a new env var, and a rotation hazard to protect a string that unlocks nothing.
 * The digest is one-way, which is the property that actually matters: the participant id cannot
 * be recovered from it.
 *
 * WHY THE EVENT ID IS IN THE INPUT. A participant belongs to exactly one event, so the
 * participant id alone would already isolate events. Binding the event too costs nothing and
 * means event isolation survives even if participant ids were ever reused across events.
 *
 * STABILITY IS THE WHOLE CONTRACT. Same participant -> same value, forever, on every request.
 * A NEW participant row -> a different value, which is precisely what makes account-switch
 * isolation (R4-R5C3A1) automatic: when the containment rule refuses a participant and a new one
 * is created, the namespace changes with it and the previous learner's draft becomes unreachable
 * rather than merely hidden.
 */
export function participantDraftNamespace(eventId: string, participantId: string): string {
  return createHash("sha256")
    .update(`bty.fr.draft.v1|${eventId}|${participantId}`)
    .digest("base64url")
    .slice(0, 22);
}
