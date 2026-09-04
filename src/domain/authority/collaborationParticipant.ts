/**
 * Who may collaborate in BTY. PURE — no I/O, no DB, no side effects.
 *
 * ★ THE PRODUCT DECISION THIS ENCODES.
 *
 * Collaboration capabilities — Save to BTY, Track with BTY, receiving a Track, reading your own
 * tracked runs, answering one — belong to every legitimate participant of the BTY organization.
 * They are not organizational authoring. Asking someone for a Foundry Host grant before they may
 * send a colleague "please acknowledge this" is the same class of boundary error that already
 * locked a Host out of his own tracking behind an Arena learner-consent gate: the wrong authority,
 * borrowed because it was nearby.
 *
 * ORGANIZATIONAL AUTHORING — opening an Event, creating Training, publishing or assigning learning,
 * setting or awarding participation XP — stays Manager+ and is NOT decided here. Nothing in this
 * file may ever be consulted for those.
 *
 * ---------------------------------------------------------------------------
 * ★ WHAT MAKES SOMEONE A PARTICIPANT, MEASURED (2026-09-04).
 *
 * Exactly two facts, both already established before this function can be called:
 *
 *   1. the Microsoft identity RESOLVED to a canonical BTY user   (tenant_id + aad_object_id)
 *   2. that identity belongs to BTY's own tenant
 *
 * The first is the rule Save to BTY has always used, and this reuses it rather than inventing a
 * second definition of "is this a real person". Never an email, never a UPN, never a display name,
 * never `from.id`, never `sub` — the resolver refuses all of those by construction.
 *
 * ★ WHY THE TENANT HALF IS LOAD-BEARING AND NOT DECORATION. The Entra registration is
 * `AzureADMultipleOrgs`, so a person in a DIFFERENT tenant can complete Microsoft sign-in and
 * become a canonical BTY user. Until now `hasHostCapability` incidentally kept them out of Track —
 * not because anyone decided a tenant boundary, but because they held no grant. Removing the
 * capability gate without this check would widen the boundary silently, which is precisely how a
 * permission change becomes an incident. Measured: all 15 Microsoft-linked BTY users are in tenant
 * `10110d5c…`, so this refuses nobody who exists today.
 *
 * ★ IT IS A FLOOR, NOT AN OWNERSHIP CHECK. Being a participant says a person may USE the feature.
 * It never says which rows are theirs. Every announcement read and write stays owner-scoped in its
 * own query or SECURITY DEFINER function, so "may I track" and "may I touch THIS run" remain two
 * different questions with two different answers.
 */

/** The resolver's verdict, narrowed to the only value that means "this is a real BTY user". */
export const RESOLVED = "RESOLVED";

export type CollaborationParticipantInput = {
  /** Status from `resolveBtyUserFromMicrosoftIdentity`. Anything but RESOLVED is not a participant. */
  resolutionStatus: string;
  /** Tenant from the VERIFIED activity — never from a body, never from a claim the caller chose. */
  tenantId: string | null | undefined;
  /** BTY's own tenant (`TEAMS_BOT_TENANT_ID`). Absent = misconfiguration, and we fail closed. */
  btyTenantId: string | null | undefined;
};

export type CollaborationParticipantVerdict =
  | { participant: true }
  | { participant: false; reason: "not_linked" | "foreign_tenant" | "tenant_not_configured" };

/** GUIDs are case-insensitive; SQL and string compares are not. Normalise both sides, always. */
const norm = (v: string | null | undefined) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * May this Microsoft caller use BTY's collaboration features?
 *
 * FAILS CLOSED on every uncertainty, including a missing BTY tenant id: a boundary that cannot be
 * evaluated has not been satisfied. The three reasons are distinct because they need three
 * different human responses — sign in, you are outside this organization, and the service is
 * misconfigured are not the same sentence.
 */
export function isCollaborationParticipant(
  input: CollaborationParticipantInput,
): CollaborationParticipantVerdict {
  const bty = norm(input.btyTenantId);
  if (!bty) return { participant: false, reason: "tenant_not_configured" };
  if (input.resolutionStatus !== RESOLVED) return { participant: false, reason: "not_linked" };
  if (norm(input.tenantId) !== bty) return { participant: false, reason: "foreign_tenant" };
  return { participant: true };
}
