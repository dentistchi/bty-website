// Pure decision for the single-URL browser Host entry (Simplify Browser Host
// Entry V1). The canonical public address is the site root; this function decides
// what the root resolver does, from nothing but "is there a session" and "which
// rooms does the account own". No I/O, no cookies, no redirects here — the caller
// performs the effect. Keeping it pure makes every branch trivially testable and
// keeps the routing layer honest.
//
//   signed out                     → render the Google Host login entry
//   signed in, zero rooms          → render first-room onboarding (create a Room)
//   signed in, one room, FREE       → auto-enter that room (bridge → /r/{slug}/admin)
//   signed in, one room, PRO        → chooser (so a PRO Host can add more Rooms)
//   signed in, two or more rooms    → chooser (any plan)
//
// PRO Multi-Room V1 adjusts ONLY the one-room case: a single-Room FREE Host keeps the
// shipped auto-enter convenience (they can't create more anyway), while a single-Room
// PRO Host lands on the hub so the plan-aware "create another" action is reachable.
// The 'empty' kind still renders the unchanged first-room onboarding. Neither this
// decision nor auto-enter ever creates/starts/ends an Event or alters ownership; the
// only writes a Host can trigger are the explicit "create Norebang" POSTs.

export type HostEntryDecision =
  | { kind: 'signed_out' }
  | { kind: 'auto_enter'; slug: string }
  | { kind: 'chooser' }
  | { kind: 'empty' };

import type { PlanCode } from './host-plan';

export function resolveHostEntry(args: {
  authenticated: boolean;
  roomSlugs: readonly string[];
  plan: PlanCode;
}): HostEntryDecision {
  if (!args.authenticated) return { kind: 'signed_out' };
  if (args.roomSlugs.length === 0) return { kind: 'empty' };
  // Single-Room FREE keeps the fast path; single-Room PRO needs the hub to add Rooms.
  if (args.roomSlugs.length === 1 && args.plan === 'FREE') {
    return { kind: 'auto_enter', slug: args.roomSlugs[0] };
  }
  return { kind: 'chooser' };
}
