/**
 * Host Action Review Queue — pure types + ordering (Slice 3.1B-3N, Phase 5B).
 *
 * Read-only review surface DTOs. The queue answers "what requires my review now?" for a Host
 * holding an explicit ACTION_REVIEWER edge. Authorization is decided ONLY by the Phase 5A
 * resolver — appearing in a queue never grants authority. No private Reflection / response_text /
 * email / raw evidence URL is ever part of these shapes.
 */

export type ReviewableMode = "hybrid" | "link";

/** One reviewable contract card. `submittedAt` is null unless a truthful timestamp exists. */
export type HostActionReviewQueueItem = {
  actionContractId: string;
  learnerLabel: string;
  actionSummary: string;
  submittedAt: string | null;
  originalDeadline: string | null;
  verificationMode: ReviewableMode;
  statusLabel: string;
};

/** Read-only detail = queue fields + the canonical structured Action fields (no evidence URL). */
export type HostActionReviewDetail = HostActionReviewQueueItem & {
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  /**
   * Human source label: "Action plan" for a Foundry Field Action (an E3 submitted plan, NOT applied
   * evidence — 5D.1A), null for an Arena-sourced contract. Derived from the server-authored
   * `action_type` — NEVER exposes the raw action_type, pattern_family, scenario id, or any internal
   * source identifier.
   */
  sourceLabel: string | null;
};

/** Row shape the service sorts on before projecting to DTOs (kept out of the client DTO). */
export type HostActionReviewSortable = {
  actionContractId: string;
  submittedAt: string | null;
  createdAt: string | null;
};

/**
 * Deterministic order: oldest truthful `submittedAt` first; rows without a submitted timestamp
 * fall back to `createdAt`; stable `actionContractId` tie-break. Deduplicates by contract id.
 */
export function orderHostActionReviewQueue<T extends HostActionReviewSortable>(rows: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const r of rows) {
    if (seen.has(r.actionContractId)) continue;
    seen.add(r.actionContractId);
    deduped.push(r);
  }
  const key = (r: T): string => r.submittedAt ?? r.createdAt ?? "";
  return deduped.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) {
      // empty sort key (no timestamp) goes last, not first
      if (ka === "") return 1;
      if (kb === "") return -1;
      return ka < kb ? -1 : 1;
    }
    return a.actionContractId < b.actionContractId ? -1 : 1;
  });
}
