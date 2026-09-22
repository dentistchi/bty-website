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

import { parseTrainingFromSearch, parseTrainingTarget } from "./trainingTarget";

export type TrainingRequest = {
  target: { joinToken: string };
  /** Unique per OCCURRENCE. Never derived from the target alone. */
  requestKey: string;
  /** Which transport delivered it. Diagnostic only — never changes what is allowed. */
  transport: TrainingTransport;
};

/**
 * The two ways the SAME signed target reaches the tab.
 *
 *   context  `page.subPageId` / `subEntityId` — what a client that navigates the tab target supplies.
 *   query    `?training=` on `/teams` — what a client that opens `webUrl` instead supplies.
 *
 * Teams iOS was measured doing the second: it opened the BTY app full-screen and delivered no
 * `subPageId` at all. Both carry the identical `foundry-training:<signed token>` string and both
 * go through the same grammar; neither grants anything the other does not.
 */
export type TrainingTransport = "context" | "query";

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
  observation: { subPageId?: unknown; search?: string | null },
  source: ObservationSource,
  occurrence: number,
): TrainingRequest | null {
  /*
    CONTEXT WINS. When a client supplies both, the tab target is the more precise statement of
    what Teams is navigating to; the query is the fallback for clients that supply nothing. They
    carry the same string in practice, and preferring one deterministically means a client that
    somehow disagrees with itself cannot produce a different outcome on different runs.
  */
  const fromContext = parseTrainingTarget(observation.subPageId);
  const parsed = fromContext ?? parseTrainingFromSearch(observation.search);
  if (!parsed) return null;
  return {
    target: { joinToken: parsed.joinToken },
    requestKey: `${source}:${occurrence}`,
    transport: fromContext ? "context" : "query",
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
