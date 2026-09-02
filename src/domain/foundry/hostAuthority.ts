/**
 * Host authority — provenance and sync planning. PURE. No I/O, no DB, no Graph.
 *
 * BTY Host authority has exactly TWO independent sources:
 *
 *   manual              a human granted it out-of-band (the Founder's grant is this)
 *   microsoft_manager   Microsoft Entra says this person has >= 1 current direct report
 *
 * A person may hold both. Effective Host is the OR of the two, so losing one can never
 * remove the other — that single rule is what keeps a manager sync from revoking the Founder,
 * who has no Microsoft direct report and must not need one.
 *
 * The revocation half is the dangerous half, so it is decided here, in a pure function, where the
 * completeness precondition is visible and testable rather than buried in a network loop.
 */

export type HostGrantState = {
  userId: string;
  manualGranted: boolean;
  microsoftManagerGranted: boolean;
};

/** Effective Host status. The `status` column is this value, never an independent fact. */
export function effectiveHostStatus(grant: {
  manualGranted: boolean;
  microsoftManagerGranted: boolean;
}): "active" | "revoked" {
  return grant.manualGranted || grant.microsoftManagerGranted ? "active" : "revoked";
}

/**
 * Manager entitlement from Microsoft, and from nothing else.
 *
 * The ONLY input is how many current direct reports Entra reports. jobTitle, department, mail,
 * userPrincipalName, Teams team ownership and BTY role names are not parameters of this function,
 * so they cannot become authority by accident later.
 */
export function isMicrosoftManager(directReportCount: number): boolean {
  return Number.isFinite(directReportCount) && directReportCount >= 1;
}

/** One user's Graph probe outcome. `indeterminate` is NOT "not a manager". */
export type ManagerProbe =
  | { userId: string; outcome: "manager" }
  | { userId: string; outcome: "not_manager" }
  | { userId: string; outcome: "indeterminate" };

export type ManagerSyncPlan = {
  /** Complete = every probe answered. Only a complete run may revoke anything. */
  complete: boolean;
  toGrant: string[];
  toRevoke: string[];
  unchanged: string[];
  indeterminate: string[];
};

/**
 * Decide what a sync run may change.
 *
 * ★ THE SAFETY RULE IS A PRECONDITION, NOT A CATCH BLOCK.
 *
 * `toRevoke` is empty unless EVERY probe in the run answered. A Graph outage, an expired secret, a
 * throttle, a single 404 — any of them leaves at least one `indeterminate`, and an incomplete run
 * revokes nobody. The failure this prevents is specific and severe: a network blip reading as
 * "nobody in this tenant manages anyone" and stripping Host from every manager at once.
 *
 * Granting is safe on an incomplete run and is therefore still allowed: a probe that positively
 * answered "manager" is authoritative about that person regardless of what happened to the others.
 *
 * Manual authority is never an input to `toRevoke`. The sync only ever clears the Microsoft flag;
 * whether the row stays active afterwards is decided by `effectiveHostStatus`.
 */
export function planManagerSync(
  probes: ManagerProbe[],
  currentGrants: HostGrantState[],
): ManagerSyncPlan {
  const byUser = new Map(currentGrants.map((g) => [g.userId, g]));
  const complete = probes.every((p) => p.outcome !== "indeterminate");

  const toGrant: string[] = [];
  const unchanged: string[] = [];
  const indeterminate: string[] = [];
  const managers = new Set<string>();

  for (const p of probes) {
    if (p.outcome === "indeterminate") {
      indeterminate.push(p.userId);
      continue;
    }
    if (p.outcome === "manager") {
      managers.add(p.userId);
      if (byUser.get(p.userId)?.microsoftManagerGranted) unchanged.push(p.userId);
      else toGrant.push(p.userId);
    }
  }

  // Anyone currently holding MICROSOFT-derived authority who this complete run did not confirm.
  // Note what is not consulted: `manualGranted`. A manual grant is not the sync's to touch.
  const toRevoke = complete
    ? currentGrants
        .filter((g) => g.microsoftManagerGranted && !managers.has(g.userId))
        .map((g) => g.userId)
    : [];

  return { complete, toGrant, toRevoke, unchanged, indeterminate };
}
