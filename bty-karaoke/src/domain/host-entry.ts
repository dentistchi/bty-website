// Pure decision for the single-URL browser Host entry (Simplify Browser Host
// Entry V1). The canonical public address is the site root; this function decides
// what the root resolver does, from nothing but "is there a session" and "which
// rooms does the account own". No I/O, no cookies, no redirects here — the caller
// performs the effect. Keeping it pure makes every branch trivially testable and
// keeps the routing layer honest.
//
//   signed out                    → render the Google Host login entry
//   signed in, exactly one room   → auto-enter that room (bridge → /r/{slug}/admin)
//   signed in, two or more rooms  → render the My Norebang chooser
//   signed in, zero rooms         → render first-room onboarding (create a Room)
//
// The 'empty' kind means "this account owns zero Rooms" — the screen renders the
// first-room onboarding form there (New Host Onboarding V1). Neither this decision
// nor auto-enter ever creates/starts/ends an Event or alters ownership; the only
// write that a zero-Room Host can trigger is the explicit "create my Norebang" POST.

export type HostEntryDecision =
  | { kind: 'signed_out' }
  | { kind: 'auto_enter'; slug: string }
  | { kind: 'chooser' }
  | { kind: 'empty' };

export function resolveHostEntry(args: {
  authenticated: boolean;
  roomSlugs: readonly string[];
}): HostEntryDecision {
  if (!args.authenticated) return { kind: 'signed_out' };
  if (args.roomSlugs.length === 0) return { kind: 'empty' };
  if (args.roomSlugs.length === 1) return { kind: 'auto_enter', slug: args.roomSlugs[0] };
  return { kind: 'chooser' };
}
