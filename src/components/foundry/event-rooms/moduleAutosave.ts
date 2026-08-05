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

/**
 * How long a navigation will wait for an in-flight save before proceeding anyway.
 * Generous enough that an ordinary save is awaited, short enough that a wedged
 * request cannot make the Builder feel broken.
 */
export const FLUSH_TIMEOUT_MS = 4000;

/** Deadline for one save REQUEST. Beyond this the fetch aborts and becomes a normal failure. */
export const SAVE_REQUEST_TIMEOUT_MS = 15000;

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
  /** Longest a caller will WAIT for a flush. 0 disables the bound (tests only). */
  flushTimeoutMs = FLUSH_TIMEOUT_MS,
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
      if (!ok) {
        // R2E — a failed save must not strand the queue. Without this, `hasQueued`
        // stayed true after a failure and the next drain could replay a stale snapshot
        // it was never asked to save.
        queued = null;
        hasQueued = false;
        break;
      }
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

  /**
   * R2E — BOUNDED. The Founder's device proved the unbounded form could hang forever:
   * a `fetch` that never settles leaves `inFlight` true, so every later `flush` pushed a
   * waiter that `schedule()` then declined to start a loop for — and `settle()` was never
   * reached. Every caller awaiting it (Back, Next and every Review Edit) silently did
   * nothing, with no error and no feedback, for the rest of the session.
   *
   * A save is worth waiting for; it is not worth being trapped by. After `flushTimeoutMs`
   * the promise resolves `false` and the caller proceeds. The snapshot stays queued and
   * retryable, so nothing is lost — only the WAIT is abandoned, never the save.
   */
  function flush(snapshot: S): Promise<boolean> {
    const p = new Promise<boolean>((res) => {
      const waiter = (ok: boolean) => {
        if (timer !== null) clearTimeout(timer);
        res(ok);
      };
      waiters.push(waiter);
      const timer =
        flushTimeoutMs > 0
          ? setTimeout(() => {
              // Drop only THIS waiter; a slow save still settles the others normally.
              waiters = waiters.filter((w) => w !== waiter);
              res(false);
            }, flushTimeoutMs)
          : null;
    });
    schedule(snapshot);
    return p;
  }

  function retry(): Promise<boolean> {
    if (last === null) return Promise.resolve(true);
    return flush(last);
  }

  return { schedule, flush, retry, isSaving: () => inFlight };
}
