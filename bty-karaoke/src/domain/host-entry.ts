// Pure decision for the single-URL browser Host entry (Simplify Browser Host
// Entry V1). The canonical public address is the site root; this function decides
// what the root resolver does, from nothing but "is there a session" and "which
// rooms does the account own". No I/O, no cookies, no redirects here — the caller
// performs the effect. Keeping it pure makes every branch trivially testable and
// keeps the routing layer honest.
//
//   signed out                       → render the Google Host login entry
//   signed in, zero rooms            → render first-room onboarding (create a Room)
//   signed in, one room (normal)      → auto-enter that room (bridge → /r/{slug}/admin)
//   signed in, one room (explicit hub)→ chooser (Host asked for "My Norebang")
//   signed in, two or more rooms      → chooser
//
// Room count is not a plan boundary, so the decision is plan-agnostic. The one-Room
// auto-enter fast path is preserved for normal entry; a Host who EXPLICITLY opens the
// hub (the "My Norebang · 내 노래방 관리" action, e.g. `/?view=rooms`) is never
// auto-entered, so a single-Room Host can reach the chooser to add another Room. The
// 'empty' kind still renders the unchanged first-room onboarding. Neither this decision
// nor auto-enter ever creates/starts/ends an Event or alters ownership; the only writes
// a Host can trigger are the explicit "create Norebang" POSTs.

export type HostEntryDecision =
  | { kind: 'signed_out' }
  | { kind: 'auto_enter'; slug: string }
  | { kind: 'chooser' }
  | { kind: 'empty' };

export function resolveHostEntry(args: {
  authenticated: boolean;
  roomSlugs: readonly string[];
  /** True when the Host explicitly requested the hub (never auto-enter then). */
  explicitHub?: boolean;
}): HostEntryDecision {
  if (!args.authenticated) return { kind: 'signed_out' };
  if (args.roomSlugs.length === 0) return { kind: 'empty' };
  if (args.roomSlugs.length === 1 && !args.explicitHub) {
    return { kind: 'auto_enter', slug: args.roomSlugs[0] };
  }
  return { kind: 'chooser' };
}
