/**
 * SNAPSHOT PRESERVATION — one rule, shared by all three learner rooms (Slice R4-R3B1-R1).
 *
 * WHAT WENT WRONG, TWICE.
 *
 * Every learner client keeps a `Snapshot` in state and updates it after an action (join, declare,
 * complete, claim, heartbeat). All three did that update by REBUILDING the object from an
 * exhaustive literal — naming each key and reading it off the response. That shape has a defect
 * that is invisible until someone adds a field:
 *
 *   3.2R-R8A-R1  `journey` was added to the server response. `load()` fetched it, the reader's
 *                first heartbeat came back through the rebuild, and the published program vanished
 *                from the learner's screen a second after it appeared.
 *   R4-R3B1      `follow_up_days` was added. `load()` fetched 7 correctly; the learner declared,
 *                the rebuild dropped it, they completed, it was still gone — and the terminal fell
 *                back to XP-only copy. The Founder saw exactly that on a training that HAD a
 *                7-day checkpoint configured.
 *
 * Both times the fix was to add `?? prev?.x` for the one key that had just been lost. That is not
 * a fix, it is a patch on an instance: the literal is still exhaustive, so the NEXT additive field
 * disappears in the same way, and nobody finds out until a device test.
 *
 * SO THE RULE IS STRUCTURAL NOW, NOT PER-KEY. The previous snapshot is the base. Only the keys a
 * response ACTUALLY SUPPLIED overwrite it. A key the response does not carry survives, whatever it
 * is called and whenever it was added — including keys that do not exist yet.
 *
 * ABSENT IS NOT NULL. A response that sends `shared_question: null` is stating that the question
 * is locked, and that null overwrites. Only a key that is genuinely missing is preserved. The
 * distinction is the same one `readContentType` draws for content types (R4-R2G): an absent field
 * is a read-shape artifact, an explicit value is an answer.
 *
 * TRANSPORT IS NOT STATE. `ok`, `error` and `assignmentClaim` travel on the same JSON envelope but
 * describe the REQUEST, not the training. A spread would smuggle them into snapshot state, where
 * they would outlive the request that produced them and be readable as if the server had said
 * something about the room. They are dropped here, in one place, rather than trusted not to matter.
 */

/**
 * Envelope fields that ride along with a snapshot response and must never become snapshot state.
 *
 * `assignmentClaim` is deliberately included: the Join client reads it directly off the response
 * to decide a one-shot banner (3.1B-3D), which is correct — but it is an outcome of THIS claim,
 * not a property of the training, and it has no place in persisted state.
 */
const TRANSPORT_KEYS: ReadonlySet<string> = new Set([
  "ok",
  "error",
  "reason",
  "assignmentClaim",
  "assignment_claim",
]);

/**
 * The snapshot fields a response actually supplied — transport stripped, absent keys omitted.
 *
 * Deliberately generic over the snapshot type. Each room has its own `Snapshot` shape and they do
 * not share a base type; what they share is this rule, and a rule that only worked for one of them
 * would be the same trap in a new place.
 */
export function suppliedSnapshotFields<S extends object>(response: unknown): Partial<S> {
  const out: Record<string, unknown> = {};
  if (!response || typeof response !== "object" || Array.isArray(response)) return out as Partial<S>;
  for (const [key, value] of Object.entries(response as Record<string, unknown>)) {
    if (TRANSPORT_KEYS.has(key)) continue;
    // `undefined` means the response did not answer for this key — the previous value stands.
    if (value === undefined) continue;
    out[key] = value;
  }
  return out as Partial<S>;
}

/**
 * Merge an action response over the snapshot on screen.
 *
 * `base` is what the room falls back to when there is nothing on screen yet (an action can land
 * before the first `load()` resolves), so a first response still produces a complete object with
 * the room's own defaults. `fixed` carries the values the CLIENT owns rather than the server —
 * `content_type` is the room the learner is standing in, and a response can never move them.
 */
export function mergeSnapshot<S extends object>(
  prev: S | null | undefined,
  response: unknown,
  base: S,
  fixed?: Partial<S>,
): S {
  return {
    ...(prev ?? base),
    ...suppliedSnapshotFields<S>(response),
    ...(fixed ?? {}),
  } as S;
}
