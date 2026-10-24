/** Founder-only preview of the local-model selector and Case 001 variant B.
 * An explicit allowlist of BTY user ids in `CLINICAL_DISCOVERY_FOUNDER_USER_IDS` (comma-separated),
 * decided on the server for every request. Unset or empty means nobody: every other user keeps the
 * authored rules and the existing packs. User ids only — never email.
 */
export function clinicalFounderUserIds(): Set<string> {
  return new Set((process.env.CLINICAL_DISCOVERY_FOUNDER_USER_IDS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
}

export const isClinicalFounder = (userId: string): boolean => clinicalFounderUserIds().has(userId.trim().toLowerCase());
