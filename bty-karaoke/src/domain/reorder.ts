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

export interface DragRowRect {
  id: string;
  top: number;
  height: number;
}

/**
 * Insertion index for the dragged card given the pointer's Y and a FROZEN snapshot
 * of the row rects captured at drag start (V5.1.2). The list does not move during
 * a drag — only a thin insertion line shifts — so this is computed purely from the
 * snapshot + pointer, never a live DOM re-measure. Returns the slot (0..N) among
 * the OTHER rows where the active card would land: the count of non-active rows
 * whose vertical midpoint sits above the pointer.
 */
export function resolveInsertionIndex(
  pointerY: number,
  rows: readonly DragRowRect[],
  activeId: string,
): number {
  let idx = 0;
  for (const r of rows) {
    if (r.id === activeId) continue;
    if (r.top + r.height / 2 < pointerY) idx++;
  }
  return idx;
}

/**
 * Place `activeId` at `index` among the other ids (drop result). Pure: removes the
 * active id, clamps the index into range, and splices it back — the single array
 * mutation that happens once on drop.
 */
export function insertAt(order: readonly string[], activeId: string, index: number): string[] {
  const without = order.filter((id) => id !== activeId);
  const clamped = Math.max(0, Math.min(without.length, index));
  return [...without.slice(0, clamped), activeId, ...without.slice(clamped)];
}

/**
 * Choose the queue row the dragged card is currently over, from vertical geometry,
 * WITH HYSTERESIS — so a small wobble near a card boundary does not toggle the
 * order back and forth (the jitter the bare closest-center default produces on
 * iPad). Pure and deterministic: the tested spec of the drag collision (V5.1.1).
 *
 * `candidates` are the droppable rows as { id, center } (vertical centre, px).
 * Picks the row whose centre is nearest `pointerY` (closest-centre semantics), but
 * KEEPS `previousOverId` when the new nearest is only marginally closer — the
 * pointer must move past the midpoint by `hysteresis` px before the target flips,
 * so neighbours yield once and stay put instead of flickering around a boundary.
 */
export function resolveVerticalOverId(input: {
  pointerY: number;
  candidates: readonly { id: string; center: number }[];
  previousOverId?: string | null;
  hysteresis?: number;
}): string | null {
  const { pointerY, candidates, previousOverId = null, hysteresis = 8 } = input;
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestDist = Math.abs(pointerY - best.center);
  for (const c of candidates) {
    const d = Math.abs(pointerY - c.center);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }

  if (previousOverId != null && previousOverId !== best.id) {
    const prev = candidates.find((c) => c.id === previousOverId);
    if (prev && Math.abs(pointerY - prev.center) - bestDist < hysteresis) {
      return previousOverId;
    }
  }
  return best.id;
}

/** True when two id orders differ (used to skip saving a no-op reorder). */
export function orderChanged(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}

/**
 * Decide what a held optimistic drag order should do when a fresh server queue
 * arrives (V5.1 drag fluidity). Prevents the drop-flash: we hold the DJ's chosen
 * order until the server actually reflects it, instead of snapping back to a
 * stale poll the instant the mutation resolves.
 *
 * - 'confirm'   → server order EQUALS the optimistic order → drop the override
 *                 (no visual change — the list is already right).
 * - 'reconcile' → the id SET differs (a song was added / removed / force-finished
 *                 while dragging) → adopt the canonical server order once.
 * - 'hold'      → same set, different order = a stale pre-reorder poll that raced
 *                 in → keep the optimistic order and wait for the confirming poll.
 */
export function reconcileDecision(
  optimistic: readonly string[],
  serverIds: readonly string[],
): 'confirm' | 'reconcile' | 'hold' {
  const sameSet =
    optimistic.length === serverIds.length && optimistic.every((id) => serverIds.includes(id));
  if (!sameSet) return 'reconcile';
  return optimistic.every((id, i) => serverIds[i] === id) ? 'confirm' : 'hold';
}
