/**
 * Serialized latest-state saver for the Guided Module Builder autosave.
 *
 * Framework-agnostic so the race-safety contract is unit-testable without a
 * renderer. Guarantees:
 *   - only ONE save is in flight at a time (serialized);
 *   - edits during an in-flight save queue the NEWEST snapshot and save it next;
 *   - an older in-flight response never overwrites newer queued state;
 *   - `flush(snapshot)` resolves only after that snapshot (or a newer queued one)
 *     has been persisted — Back/Next await it before advancing;
 *   - a failed save surfaces "error" and leaves the snapshot retryable via retry().
 *
 * It NEVER applies the server response back onto local state — the client keeps
 * authoritative form state; the saver only reports save status. So a slow/stale
 * response cannot clobber newer typing.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Persist one snapshot. Resolve true on success, false on failure (no throw). */
export type SaveFn<S> = (snapshot: S) => Promise<boolean>;

export type SerializedSaver<S> = {
  /** Fire-and-forget: persist `snapshot`, coalescing with any in-flight save. */
  schedule: (snapshot: S) => void;
  /** Persist `snapshot` and await settle (success or failure). Resolves ok flag. */
  flush: (snapshot: S) => Promise<boolean>;
  /** Re-attempt the last known snapshot after a failure. */
  retry: () => Promise<boolean>;
  isSaving: () => boolean;
};

export function createSerializedSaver<S>(
  save: SaveFn<S>,
  onState: (state: SaveState) => void,
): SerializedSaver<S> {
  let inFlight = false;
  let queued: S | null = null;
  let hasQueued = false;
  let last: S | null = null;
  let waiters: Array<(ok: boolean) => void> = [];

  function settle(ok: boolean) {
    const ws = waiters;
    waiters = [];
    for (const w of ws) w(ok);
  }

  async function loop(first: S): Promise<void> {
    inFlight = true;
    onState("saving");
    let current = first;
    let ok = true;
    // Drain: keep saving while newer snapshots were queued mid-flight.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      last = current;
      ok = await save(current);
      if (!ok) break;
      if (hasQueued) {
        current = queued as S;
        hasQueued = false;
        queued = null;
        continue;
      }
      break;
    }
    inFlight = false;
    onState(ok ? "saved" : "error");
    settle(ok);
  }

  function schedule(snapshot: S): void {
    last = snapshot;
    if (inFlight) {
      queued = snapshot;
      hasQueued = true;
      return;
    }
    void loop(snapshot);
  }

  function flush(snapshot: S): Promise<boolean> {
    const p = new Promise<boolean>((res) => waiters.push(res));
    schedule(snapshot);
    // If nothing is running (e.g. a synchronous no-op path), the promise still
    // settles because schedule() started a loop that will call settle().
    return p;
  }

  function retry(): Promise<boolean> {
    if (last === null) return Promise.resolve(true);
    return flush(last);
  }

  return { schedule, flush, retry, isSaving: () => inFlight };
}
