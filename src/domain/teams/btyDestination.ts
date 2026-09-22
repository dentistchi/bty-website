/**
 * IS THIS DESTINATION OURS, AND CAN THE SHELL RENDER IT? PURE. Slice No-Browser-Escape V1.
 *
 * ★ THE RULE THIS FILE EXISTS TO HOLD. When someone is already inside BTY in Teams, a BTY-owned
 * destination must not hand them to Safari. The previous containment guard asked only one
 * question — "does this href leave /teams?" — and answered every yes the same way, by opening a
 * browser. That is correct for a third-party article and wrong for our own Center, which is how
 * "View my private reflection in Center" ended up launching Safari.
 *
 * ★ SO THERE ARE THREE ANSWERS, NOT TWO. Collapsing them is the original defect:
 *
 *     shell          A BTY destination the app shell can already render as its own state
 *                    (`/{locale}/app?tab=…`). It must stay inside the current BTY surface.
 *     bty_unframed   BTY-owned, but a separate page with no in-shell representation. Every BTY
 *                    route outside `/teams/*` is served `X-Frame-Options: DENY`, so it cannot be
 *                    rendered in the frame TODAY. It is named rather than silently lumped in with
 *                    third-party content, because it is a gap to close, not a decision we made.
 *     external       Genuinely somebody else's content. A browser is the right answer.
 *
 * ★ NO I/O, NO SDK, NO DOM. The transport decision belongs to the caller; this only says what the
 * destination IS.
 */

export type BtyDestinationKind = "shell" | "bty_unframed" | "external";

/** Schemes that do not navigate a document at all. */
const NON_NAVIGATING = /^(mailto:|tel:|sms:|javascript:|blob:|data:)/i;

/**
 * The shell's own address. `/{locale}/app` is the canonical product surface on the web, and
 * `/teams` is the same shell inside the Teams tab — both express their destination as a query.
 */
const APP_PATH = /^\/[A-Za-z-]{2,5}\/app\/?$/;

function parse(rawUrl: string, origin: string): URL | null {
  const raw = (rawUrl ?? "").trim();
  if (raw === "" || raw.startsWith("#")) return null;
  if (NON_NAVIGATING.test(raw)) return null;
  try {
    return new URL(raw, origin);
  } catch {
    return null;
  }
}

/**
 * What kind of destination is this href?
 *
 * Returns null when following it would not navigate anywhere (an in-page anchor, a `mailto:`),
 * which is not a destination at all and must be left completely alone.
 */
export function classifyBtyHref(rawUrl: string, origin: string): BtyDestinationKind | null {
  const target = parse(rawUrl, origin);
  if (!target) return null;

  /*
    SAME ORIGIN IS THE DEFINITION OF "OURS". Everything served from the BTY deployment is a BTY
    destination; nothing third-party is. This is deliberately not a list of product paths to keep
    in sync — a new BTY route is internal on the day it ships, without anyone remembering to add
    it here.
  */
  if (target.origin !== origin) return "external";

  // Already the shell's own document: `/teams` and `/teams/*` render in the frame as they are.
  if (target.pathname === "/teams" || target.pathname.startsWith("/teams/")) return "shell";

  return APP_PATH.test(target.pathname) ? "shell" : "bty_unframed";
}

/**
 * The shell state this destination is asking for, as a query string (leading `?`, or `""`).
 *
 * The shell already reads a rich deep-link vocabulary from its own search string — `tab`, `view`,
 * `entry`, `followup`, `review`, `event`, `focus` and the rest. A shell destination is therefore
 * fully described by its query, and moving between shells is just carrying that query across.
 * There is no second destination language to invent or keep in sync.
 *
 * Returns null for anything that is not a shell destination.
 */
export function shellSearchFor(rawUrl: string, origin: string): string | null {
  if (classifyBtyHref(rawUrl, origin) !== "shell") return null;
  const target = parse(rawUrl, origin);
  if (!target) return null;
  return target.search;
}

/**
 * Would following this href navigate the Teams frame away from `/teams`?
 *
 * Kept as a separate question from "what kind of destination is it", because a `shell` destination
 * at `/{locale}/app` DOES leave the frame as an href and yet must NOT be opened in a browser — it
 * is re-expressed as shell state instead. Conflating the two is what produced the defect.
 */
export function leavesTeamsDocument(rawUrl: string, origin: string): boolean {
  const target = parse(rawUrl, origin);
  if (!target) return false;
  if (target.origin !== origin) return true;
  return !(target.pathname === "/teams" || target.pathname.startsWith("/teams/"));
}

/**
 * The event a shell listens for when something asks it to show a different destination.
 *
 * WHY AN EVENT AND NOT A ROUTER PUSH. Inside Teams there is nowhere to push to: `/teams` is the
 * only route the frame may render, and the shell is already mounted on it. The destination is
 * written into the document's own query with `history.replaceState` — no navigation, no history
 * entry — and this event tells the shell to read it, using the exact same deep-link code that
 * already runs on a cold open. One destination vocabulary, one interpreter, two entry points.
 */
export const BTY_SHELL_DESTINATION_EVENT = "bty:shell-destination";

/**
 * A shell destination carried through a Teams personal-tab deep link's `context.subEntityId`.
 *
 * ★ WHY A PREFIX. `subEntityId` already carries ONE thing — a signed training target, parsed by
 * `readTrainingRequest`. A bare query string would be silently handed to that parser, fail to be a
 * training, and leave the learner on the default surface with nothing explaining why. The `q:`
 * prefix makes the two kinds tellable apart, so each is read by the thing that understands it.
 *
 * ★ IT IS NOT PERMISSION, AND IT IS NOT IDENTITY. The value comes from the Teams client and anyone
 * can craft one. It names a SURFACE — which tab, which view, which entry — and every one of those
 * destinations does its own owner-scoped read. Nothing here grants access to anything.
 */
export const SHELL_DESTINATION_PREFIX = "q:";

/** Encode a shell query as a `subEntityId`. Empty query → null, because there is nothing to say. */
export function encodeShellSubEntityId(search: string): string | null {
  const raw = (search ?? "").trim().replace(/^\?/, "");
  return raw ? `${SHELL_DESTINATION_PREFIX}${raw}` : null;
}

/**
 * Read a shell destination back out of a `subEntityId`, as a query string (leading `?`).
 *
 * Returns null for anything that is not one — a training target, a stale value, a crafted string —
 * so a caller can tell "not a destination" from "a destination that happens to be empty".
 */
export function decodeShellSubEntityId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v.startsWith(SHELL_DESTINATION_PREFIX)) return null;
  const query = v.slice(SHELL_DESTINATION_PREFIX.length);
  // A query only: no scheme, no host, no path. This can never become a navigation target.
  if (!query || /[\s#/\\]/.test(query) || query.includes("://")) return null;
  try {
    const params = new URLSearchParams(query);
    const out = params.toString();
    return out ? `?${out}` : null;
  } catch {
    return null;
  }
}
