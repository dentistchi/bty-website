// Pure DJ queue-reorder policy. No I/O, no DB. This is the single spec of what a
// reorder means; the SQL RPC `reorder_karaoke_requests` mirrors it exactly (same
// outcomes, same "new arrivals appended at the tail" rule). Keeping the policy
// here makes it unit-testable without a database.

export type ReorderPlan =
  | { outcome: 'ok'; finalOrder: string[] }
  | { outcome: 'empty' } //          nothing to do (no ids given)
  | { outcome: 'invalid' } //        duplicate ids in the payload
  | { outcome: 'queue_changed' }; // a payload id is no longer waiting

/**
 * Plan a reorder from the DJ's requested order against the room's CURRENT waiting
 * set (already in canonical order).
 *
 * - Duplicate ids in `orderedIds` → 'invalid'.
 * - Any `orderedIds` entry not currently waiting (started/removed/unknown/other
 *   room) → 'queue_changed' (the client must refetch and retry).
 * - Otherwise 'ok', with `finalOrder` = the requested order followed by any
 *   waiting requests that arrived concurrently (present in the current set but
 *   absent from the payload), kept in their canonical order — so a guest's new
 *   request is never dropped or shuffled away.
 */
export function planReorder(
  currentWaitingCanonical: readonly string[],
  orderedIds: readonly string[],
): ReorderPlan {
  if (orderedIds.length === 0) return { outcome: 'empty' };

  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (seen.has(id)) return { outcome: 'invalid' };
    seen.add(id);
  }

  const waitingSet = new Set(currentWaitingCanonical);
  for (const id of orderedIds) {
    if (!waitingSet.has(id)) return { outcome: 'queue_changed' };
  }

  const leftover = currentWaitingCanonical.filter((id) => !seen.has(id));
  return { outcome: 'ok', finalOrder: [...orderedIds, ...leftover] };
}

/**
 * Drop semantics for one drag: move `activeId` to where `overId` currently sits,
 * shifting the rest. Mirrors dnd-kit's arrayMove(old→new index). Returns a new
 * array; returns the input order unchanged if either id is missing or they match
 * (so a no-op drop never triggers a save). Pure — the tested spec of a drop.
 */
export function moveWithin(ids: readonly string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return ids.slice();
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

/** True when two id orders differ (used to skip saving a no-op reorder). */
export function orderChanged(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}
