// BUILD 26E — permanent account deletion: the pure contract constants.
//
// These live in `domain` rather than beside the route because a Next.js App Router route
// module may export ONLY its recognised fields (the HTTP verbs, `dynamic`, `runtime`, …).
// Exporting a constant from `route.ts` fails the production build with
// "<name> is not a valid Route export field" — a constraint neither `tsc --noEmit` nor the
// unit suite can see, because it is enforced by Next.js at build time.
//
// No I/O, no framework imports — the route and its tests both read from here, so the
// destructive phrase and the re-auth window are stated in exactly one place.

/**
 * The exact phrase a deletion request must carry.
 *
 * A constant rather than a boolean flag: it makes a stray, malformed, or replayed POST
 * structurally unable to delete an account. The native client sends the same literal.
 */
export const DELETE_CONFIRMATION = 'DELETE_MY_ACCOUNT';

/**
 * How recently the caller must have re-proved identity with a provider.
 *
 * Host sessions deliberately live 90 days (a Host must not be logged out mid-party), which
 * is exactly why possession of a long-lived token must NOT by itself authorize an
 * irreversible action. Ten minutes is long enough to complete a provider re-auth and read
 * the consequences, short enough that a recovered device cannot delete an account hours
 * later.
 */
export const RECENT_AUTH_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Tolerance for a client clock running ahead of the server. A re-auth timestamp further in
 * the future than this is rejected, so a skewed or manipulated clock cannot buy extra
 * validity for a destructive action.
 */
export const REAUTH_FUTURE_SKEW_MS = 60 * 1000;
