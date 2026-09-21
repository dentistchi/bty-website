"use client";

/**
 * Participant-session transport for a FRAMED learner room. BROWSER ONLY.
 * Slice Teams-Native Delivery V1.
 *
 * WHY A TRANSPORT AND NOT A PROP. The three learner clients (video, document, guidance) make
 * their ~25 room calls through plain `fetch(..., { credentials: "include" })`, on the assumption
 * that a per-event HttpOnly cookie identifies the participant. Inside `/teams` that cookie never
 * travels. Threading a token through three 1,200-line components and every call site would be a
 * large diff whose only purpose is to say one thing many times — and it would put the web and
 * native paths in the blast radius of a change they do not need.
 *
 * So the same shape the Teams tab already uses for its Supabase bearer is used here: ONE wrapper,
 * installed only while an in-shell room is mounted, that says it once.
 *
 * DELIBERATELY NARROW. The header is attached ONLY to same-origin requests under this ONE room's
 * `/api/bty/foundry/public/<joinToken>/` prefix. Not to another room, not to the rest of the API,
 * not to any third party — a participant session is a capability for one participant on one event,
 * and it has no business anywhere else.
 */

import { PARTICIPANT_SESSION_HEADER } from "./publicRoute.shared";

type Uninstall = () => void;

/** The public API prefix this room's calls live under. */
function roomPrefix(joinToken: string): string {
  return `/api/bty/foundry/public/${encodeURIComponent(joinToken)}/`;
}

/**
 * Wrap `window.fetch` so this room's public calls carry the participant session explicitly.
 * Returns an uninstall that restores exactly the function that was there.
 */
export function installParticipantSessionTransport(
  joinToken: string,
  getSession: () => string | null,
): Uninstall {
  if (typeof window === "undefined") return () => {};
  const original = window.fetch;
  const origin = window.location.origin;
  const prefix = roomPrefix(joinToken);
  const call = (input: RequestInfo | URL, init?: RequestInit) => original.call(window, input, init);

  const wrapped: typeof window.fetch = async (input, init) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    let target: URL;
    try {
      target = new URL(raw, origin);
    } catch {
      return call(input as RequestInfo | URL, init);
    }
    const sameRoom =
      target.origin === origin &&
      (target.pathname === prefix.slice(0, -1) || target.pathname.startsWith(prefix));
    if (!sameRoom) return call(input as RequestInfo | URL, init);

    const session = getSession();
    if (!session) return call(input as RequestInfo | URL, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    // Never overwrite a header a caller set deliberately.
    if (!headers.has(PARTICIPANT_SESSION_HEADER)) headers.set(PARTICIPANT_SESSION_HEADER, session);
    return call(input as RequestInfo | URL, { ...(init ?? {}), headers });
  };

  window.fetch = wrapped;
  return () => {
    if (window.fetch === wrapped) window.fetch = original;
  };
}
