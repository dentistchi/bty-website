/**
 * Teams-native training delivery — the deep-link TARGET (pure). Slice Teams-Native Delivery V1.
 *
 * WHAT THIS REPLACES. A Host inside the Teams app shared a training by handing the learner a
 * public web URL (`/f/<token>`). On Teams mobile that is a "Link not supported" dialog or a jump
 * into Safari: a browser context with no Teams identity, so the learner joined anonymously and was
 * asked to sign in with Google AFTER finishing. The training was fine; the delivery was wrong.
 *
 * SO THE INVITATION NOW ADDRESSES THE BTY PERSONAL TAB, not the web. Teams' documented personal-tab
 * deep link carries a `context.subEntityId`, the tab reads it back out of `app.getContext()`, and
 * the training opens INSIDE the tab — same document, same Teams SSO, same session.
 *
 * THE TARGET IS A NAVIGATION CAPABILITY, NEVER AN IDENTITY. `subEntityId` arrives from the Teams
 * client and is, for our purposes, attacker-controllable: anyone can craft a deep link. So this
 * module is deliberately a NARROW grammar rather than a route:
 *
 *   - exactly one target kind exists (`foundry-training`);
 *   - its payload is the EXISTING signed Foundry room token (`btyfr1.<payload>.<sig>`), whose HMAC
 *     the server verifies as it always has — this module never validates the signature itself and
 *     never claims to;
 *   - anything else parses to `null`, which the tab renders as "open the app normally".
 *
 * What it therefore CANNOT express: a path, an origin, a query string, an internal route, a user
 * id, an event id, or any second kind of destination. A forged `subPageId` can at most name a
 * Foundry room, and naming one is not being admitted to it — admission is the signed token plus
 * the server's own authorization, exactly as on the public path.
 *
 * NO DATABASE IDS. The token already carries the event id under a signature; putting a bare
 * `event_id` in a chat message would publish an internal identifier for no gain.
 */

/** The Teams app registration id (manifest `id`). Public, and not a secret. */
export const BTY_TEAMS_APP_ID = "374ec662-0deb-4e0b-8514-e38a035a349e";

/** The personal tab's `entityId` in the manifest's `staticTabs`. */
export const BTY_TEAMS_PERSONAL_TAB_ENTITY_ID = "btyHome";

/** The one target kind this grammar admits. */
export const TRAINING_TARGET_PREFIX = "foundry-training";

/** The Foundry room token family, as minted by `foundry-room-token.ts`. */
const ROOM_TOKEN_PATTERN = /^btyfr1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,512}$/;

export type TrainingTarget = { kind: "foundry-training"; joinToken: string };

/**
 * Build the `subEntityId` for a training. Refuses a token that is not shaped like a Foundry room
 * token, so a malformed target can never be MINTED — the parser below is the second line, not the
 * only one.
 */
export function buildTrainingTarget(joinToken: string): string | null {
  const t = (joinToken ?? "").trim();
  if (!ROOM_TOKEN_PATTERN.test(t)) return null;
  return `${TRAINING_TARGET_PREFIX}:${t}`;
}

/**
 * Parse a `subEntityId` / `subPageId` into a target, or null.
 *
 * TOTAL and CLOSED: every input that is not exactly `foundry-training:<room-token>` yields null.
 * There is no default arm, no "treat it as a path", and no second prefix — which is what makes
 * "a forged subPageId cannot become arbitrary internal navigation" a property of the grammar
 * rather than a promise about the caller.
 */
export function parseTrainingTarget(raw: unknown): TrainingTarget | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 1200) return null;
  const marker = `${TRAINING_TARGET_PREFIX}:`;
  if (!value.startsWith(marker)) return null;
  const joinToken = value.slice(marker.length);
  if (!ROOM_TOKEN_PATTERN.test(joinToken)) return null;
  return { kind: "foundry-training", joinToken };
}

/**
 * The Teams personal-tab deep link for a training.
 *
 * `webUrl` is the Teams TAB's own address, never `/f/<token>`: it is what a client that cannot
 * honour the deep link falls back to, and falling back to the web room is precisely the browser
 * handoff this slice exists to remove. A learner who lands there gets the ordinary tab.
 *
 * `openInMeeting=false` keeps the training out of a meeting side panel, where a personal tab has
 * no business appearing.
 *
 * Returns null when the token is not a Foundry room token — a caller with nothing to link to must
 * show its own fallback rather than send a broken link into a chat.
 */
export function buildTrainingDeepLink(input: {
  joinToken: string;
  title: string;
  /** Absolute origin of the BTY deployment, e.g. `https://arena.btydaily.com`. */
  origin: string;
}): string | null {
  const subEntityId = buildTrainingTarget(input.joinToken);
  if (!subEntityId) return null;
  const origin = (input.origin ?? "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+$/.test(origin)) return null;

  const label = (input.title ?? "").trim().slice(0, 120) || "BTY";
  const params = new URLSearchParams({
    webUrl: `${origin}/teams`,
    label,
    context: JSON.stringify({ subEntityId }),
    openInMeeting: "false",
  });
  return `https://teams.microsoft.com/l/entity/${BTY_TEAMS_APP_ID}/${BTY_TEAMS_PERSONAL_TAB_ENTITY_ID}?${params.toString()}`;
}

/**
 * The prefilled chat message. SHORT on purpose: it is a draft the Host will read before sending,
 * and a wall of text is a draft nobody reads.
 *
 * The link is the PERSONAL-TAB deep link. A raw `/f/<token>` URL must never appear in a message
 * composed inside Teams — that is the browser handoff, and a test asserts it does not.
 */
export function buildTrainingInviteMessage(input: {
  hostName: string | null;
  title: string;
  deepLink: string;
  locale: "en" | "ko";
}): string {
  const title = (input.title ?? "").trim() || (input.locale === "ko" ? "훈련" : "Training");
  const host = (input.hostName ?? "").trim();
  if (input.locale === "ko") {
    const lead = host ? `${host}님이 훈련을 공유했습니다:` : "훈련이 공유되었습니다:";
    return `${lead}\n\n${title}\n\nBTY에서 열기:\n${input.deepLink}`;
  }
  const lead = host ? `${host} shared training with you:` : "Training shared with you:";
  return `${lead}\n\n${title}\n\nOpen in BTY:\n${input.deepLink}`;
}

/**
 * The join token inside a canonical participant URL (`…/f/<token>`), or null.
 *
 * The Host's control room holds `event.join_url`, not the bare token, and the deep link needs the
 * token. Parsing it here keeps the ONE grammar in one file: the same `ROOM_TOKEN_PATTERN` that
 * gates `buildTrainingTarget` gates this, so a URL that is not a Foundry room URL yields nothing
 * and the caller shows its web fallback instead of minting a broken invitation.
 */
export function joinTokenFromParticipantUrl(participantUrl: unknown): string | null {
  if (typeof participantUrl !== "string") return null;
  let url: URL;
  try {
    url = new URL(participantUrl.trim());
  } catch {
    return null;
  }
  const m = /^\/f\/([^/]+)\/?$/.exec(url.pathname);
  if (!m) return null;
  const token = decodeURIComponent(m[1]!);
  return ROOM_TOKEN_PATTERN.test(token) ? token : null;
}
