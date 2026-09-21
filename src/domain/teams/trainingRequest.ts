/**
 * A Teams training NAVIGATION REQUEST — an occurrence, not a value. PURE.
 * Slice Teams iOS Deep-Link Resume.
 *
 * THE DEFECT THIS SHAPE EXISTS TO FIX, measured on a real iPhone:
 *
 *   The Host's invitation opened BTY inside Teams — deep-link routing worked — but the tab landed
 *   on ordinary Learn instead of the named training. On Teams iOS, tapping a deep link RESUMES the
 *   existing personal-tab WebView rather than remounting it, and the old code read
 *   `app.getContext()` exactly once during bootstrap and copied the target into React state in a
 *   mount-time initialiser. A target that arrives after that first mount was therefore observed by
 *   nobody.
 *
 * WHY A KEY AND NOT JUST A TARGET. "Which training" is not enough, because the same training may
 * legitimately be asked for twice:
 *
 *     open Training A → Back to Learn → return to the chat → tap the SAME invitation again
 *
 * A contract that de-duplicates on `joinToken` forever would make that second tap do nothing. So a
 * request carries an OCCURRENCE identity: two requests for the same training with different keys
 * are two separate asks, and the consumer decides what to do about each.
 *
 * Nothing here talks to Teams, to React, or to the network. It only says what a request IS and
 * when one observation should become a new one.
 */

import { parseTrainingTarget } from "./trainingTarget";

export type TrainingRequest = {
  target: { joinToken: string };
  /** Unique per OCCURRENCE. Never derived from the target alone. */
  requestKey: string;
};

/** Where an observation came from — the two moments a target can be seen. */
export type ObservationSource = "bootstrap" | "refresh";

/**
 * Turn an observed `subPageId` into a request, given how many have been observed before.
 *
 * `occurrence` is supplied by the caller and is expected to increase for each observation it
 * decides is a new ask. Returning null means "this context names no training" — which is also the
 * state a successful subpage clear produces, and is what lets a later tap of the same link count
 * as a fresh occurrence rather than a repeat.
 */
export function readTrainingRequest(
  rawSubPageId: unknown,
  source: ObservationSource,
  occurrence: number,
): TrainingRequest | null {
  const parsed = parseTrainingTarget(rawSubPageId);
  if (!parsed) return null;
  return {
    target: { joinToken: parsed.joinToken },
    requestKey: `${source}:${occurrence}`,
  };
}

/**
 * Should a consumer act on this request?
 *
 * Three rules, and each one is a defect that was reasoned about rather than a guess:
 *
 *   1. A request already handled is not handled twice. Re-renders and re-deliveries of the same
 *      occurrence are ordinary and must be inert.
 *
 *   2. A request for the training ALREADY OPEN is inert. Switching to another app mid-quiz and
 *      returning fires a refresh; acting on it would remount the room and destroy an attempt in
 *      progress. The training the learner is looking at is already the training being asked for.
 *
 *   3. Anything else opens. In particular, the same target AFTER the room was closed does open,
 *      which is the "tap the same invitation again" case the product requires.
 */
export function shouldOpenTrainingRequest(input: {
  request: TrainingRequest | null;
  /** The last `requestKey` this consumer acted on, or null. */
  handledKey: string | null;
  /** The training currently open in the shell, or null when none is. */
  openJoinToken: string | null;
}): boolean {
  const { request, handledKey, openJoinToken } = input;
  if (!request) return false;
  if (handledKey === request.requestKey) return false;
  if (openJoinToken !== null && openJoinToken === request.target.joinToken) return false;
  return true;
}
