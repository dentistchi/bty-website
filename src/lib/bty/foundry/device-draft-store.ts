/**
 * DEVICE-LOCAL DRAFT STORE — key ownership and the sign-out purge (Slice R4-R5C4A-R1).
 *
 * R4-R5C4A gave the training room a device-local draft so a learner stops losing what they
 * typed. That created a privacy seam that did not exist while the text lived only in memory:
 *
 *   the participant cookie is HttpOnly and SURVIVES sign-out
 *   participant.user_id = A with auth = null is COMPATIBLE by design (C3A1)
 *   so a signed-out browser can still resolve participant A, receive A's `draft_ns`,
 *   and restore A's unfinished private text
 *
 * That is not the account-switch case — C3A1 already contains account B by giving it a
 * different participant, and therefore a different namespace. It is the SHARED DEVICE case:
 * the person who signs out, and whoever picks the device up next.
 *
 * WHY THE WHOLE PREFIX, NOT ONE PARTICIPANT. A browser may hold drafts for several
 * participants — several events, or an anonymous room alongside an assigned one — and there is
 * no safe client-side map from a draft to the account that owns it. Guessing which ones belong
 * to the person leaving would be a privacy decision made on incomplete information. Removing
 * every draft is the boundary that needs no such guess.
 *
 * THIS FILE LIVES IN `lib` DELIBERATELY. The sign-out path (`lib/native/accountSession`) needs
 * the purge, and `lib` may not import from `app` — so the key prefix and the purge live here,
 * and the room's React hook imports the prefix from this module rather than restating it. One
 * definition, so a rename cannot leave the purge sweeping a prefix nobody writes any more.
 */

/**
 * The one true prefix. Measured unique across the product: the other device-draft families are
 * `bty_program_proposal_v2:` (Host module proposals) and `bty-arena-action-draft:` (Arena action
 * drafts), and neither begins with this, so purging here cannot reach them.
 */
export const DEVICE_DRAFT_KEY_PREFIX = "bty.fr.draft.v1:";

/**
 * Remove every device-local learner draft on this browser. Best-effort by construction: a
 * browser that refuses storage, or throws part-way through, must never prevent someone from
 * signing out. Nothing here is logged — a key contains a namespace, and the value contains the
 * learner's own unfinished words.
 */
export function clearAllDeviceDrafts(): void {
  try {
    if (typeof window === "undefined") return;
    const s = window.localStorage;
    if (!s) return;
    // Collect first, then delete: removing while iterating re-indexes the store and would skip
    // keys — the bug that leaves exactly the draft you meant to remove behind.
    const doomed: string[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k && k.startsWith(DEVICE_DRAFT_KEY_PREFIX)) doomed.push(k);
    }
    for (const k of doomed) {
      try {
        s.removeItem(k);
      } catch {
        /* one stubborn key must not abandon the rest */
      }
    }
  } catch {
    /* storage unavailable or blocked — sign-out proceeds regardless */
  }
}
