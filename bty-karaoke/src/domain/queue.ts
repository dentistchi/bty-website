// Pure queue logic for the Karaoke room. No I/O, no DB, no side effects.

export type RequestStatus = 'waiting' | 'playing' | 'completed' | 'skipped' | 'removed';

// Requests a guest still cares about (in the live queue).
export const ACTIVE_STATUSES: readonly RequestStatus[] = ['waiting', 'playing'];

/** Next append position for a room, given the positions already used. */
export function nextPosition(existingPositions: readonly number[]): number {
  if (existingPositions.length === 0) return 1;
  return Math.max(...existingPositions) + 1;
}

/**
 * 1-based position of a given request within the active queue (waiting/playing),
 * ordered by `position`. Returns 0 if the request is not in the active set.
 */
export function positionInQueue(
  activePositionsSorted: readonly number[],
  requestPosition: number,
): number {
  const idx = activePositionsSorted.indexOf(requestPosition);
  return idx === -1 ? 0 : idx + 1;
}

export type DjAction = 'play' | 'complete' | 'skip' | 'remove';

/** DJ state machine: play only from waiting, complete only from playing. */
export function isValidTransition(status: RequestStatus, action: DjAction): boolean {
  switch (action) {
    case 'play':
      return status === 'waiting';
    case 'complete':
      return status === 'playing';
    case 'skip':
      return status === 'waiting' || status === 'playing';
    case 'remove':
      // "곡 빼기" — only a still-waiting song; never the one on stage.
      return status === 'waiting';
    default:
      return false;
  }
}

/**
 * The position that places a request at the FRONT of the waiting line — one
 * before the smallest active position. "먼저 부르기" uses this: a narrow
 * single-row update (no full renumber) that the canonical resolver orders
 * ahead of every other waiting song, while the playing song stays on stage.
 */
export function frontPosition(activePositions: readonly number[]): number {
  if (activePositions.length === 0) return 1;
  return Math.min(...activePositions) - 1;
}

export interface QueueEntry {
  id: string;
  status: RequestStatus;
}

export interface DjView<T extends QueueEntry> {
  primary: T | null; // now playing, else the head of the waiting list
  upNext: T | null; // the next waiting request after the primary
  rest: T[]; // remaining active requests
}

/**
 * Pick the DJ's dominant card and the promoted "next" card from the active
 * queue. After a Complete removes the playing item, the previous up-next
 * naturally becomes the new primary on the next render.
 */
export function selectDjView<T extends QueueEntry>(active: readonly T[]): DjView<T> {
  const playing = active.find((r) => r.status === 'playing') ?? null;
  const waiting = active.filter((r) => r.status === 'waiting');
  const primary = playing ?? waiting[0] ?? null;
  const upNext = waiting.find((r) => !primary || r.id !== primary.id) ?? null;
  const chosen = new Set([primary?.id, upNext?.id].filter(Boolean));
  const rest = active.filter((r) => !chosen.has(r.id));
  return { primary, upNext, rest };
}

export interface StageView<T extends QueueEntry> {
  /** The song marked `playing` — the NOW SINGING hero. Null = the stage is open. */
  current: T | null;
  /** Waiting songs in queue order — UP NEXT. Excludes the current song. */
  queue: T[];
}

/**
 * The DJ console's stage model: the current (playing) song is shown ONLY when a
 * song is actually marked playing — the console never auto-promotes a waiting
 * song into "now singing". The DJ explicitly starts the next one.
 */
export function selectStage<T extends QueueEntry>(active: readonly T[]): StageView<T> {
  const current = active.find((r) => r.status === 'playing') ?? null;
  const queue = active.filter((r) => r.status === 'waiting');
  return { current, queue };
}

/**
 * Ids present now but absent from the previous snapshot — used purely for the
 * transient "✨ NEW" highlight on freshly-arrived requests. This is a UI
 * affordance derived from server truth, not a persisted "pending" state.
 */
export function newArrivals(prevIds: readonly string[], nowIds: readonly string[]): string[] {
  const prev = new Set(prevIds);
  return nowIds.filter((id) => !prev.has(id));
}

/**
 * Whether a guest may cancel their own request from its status card. Allowed
 * only while it is still in line (waiting / up_next). Once it is on stage
 * (now_playing) or terminal (done / removed / not_found) it can't be cancelled.
 * The server re-checks the stored status — this mirrors it for the UI.
 */
export function canGuestCancel(state: GuestQueueState): boolean {
  return state === 'waiting' || state === 'up_next';
}

// ── Guest position resolver ──────────────────────────────────────────────
// One canonical model of "where am I in line" for a single request, derived
// from the room's active queue. Presentation-agnostic; the guest client renders
// copy from these fields but never recomputes ordering.

export type GuestQueueState =
  | 'waiting' // in line with songs ahead
  | 'up_next' // first in the waiting line (aheadCount === 0)
  | 'now_playing' // on stage right now
  | 'done' // finished singing
  | 'removed' // skipped/removed — no longer active
  | 'not_found'; // never existed in this room

export interface GuestQueueStatus {
  requestId: string;
  state: GuestQueueState;
  /** 1-based slot among WAITING songs; 0 when not waiting. */
  position: number;
  /** Count of WAITING songs strictly ahead; 0 when not waiting. */
  aheadCount: number;
  isUpNext: boolean;
  isNowPlaying: boolean;
  /** V6: the guest's shared "I'm ready" signal (null when not readied). */
  readyAt: string | null;
}

/** Minimal ordering fields for one queue row. */
export interface QueueOrderEntry {
  id: string;
  status: RequestStatus;
  position: number;
  created_at: string;
}

/**
 * Canonical ordering comparator: `position`, then `created_at`, then `id`.
 * The trailing keys give stable tie-breaking if two rows ever share a position.
 * Returns <0 when `a` comes before `b`.
 */
export function canonicalRank(a: QueueOrderEntry, b: QueueOrderEntry): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Resolve one guest request's live status from the room's active queue.
 *
 * `activeQueue` is the room's waiting+playing rows (any order); `targetStatus`
 * is the request's own stored status (null when the row does not exist).
 *
 * Position counts ONLY waiting songs ahead of this one — the song on stage
 * (`playing`) is never counted as "ahead in line", and completed / skipped /
 * removed rows never count. A waiting request that happens to be first in line
 * resolves to `up_next`; the request on stage resolves to `now_playing`.
 */
export function resolveGuestStatus(
  requestId: string,
  activeQueue: readonly QueueOrderEntry[],
  targetStatus: RequestStatus | null,
  readyAt: string | null = null,
): GuestQueueStatus {
  const idle = { requestId, position: 0, aheadCount: 0, isUpNext: false, isNowPlaying: false, readyAt };
  if (targetStatus === null) return { ...idle, state: 'not_found', readyAt: null };
  if (targetStatus === 'playing') return { ...idle, state: 'now_playing', isNowPlaying: true };
  if (targetStatus === 'completed') return { ...idle, state: 'done', readyAt: null };
  if (targetStatus === 'skipped' || targetStatus === 'removed') return { ...idle, state: 'removed', readyAt: null };

  // targetStatus === 'waiting'
  const target = activeQueue.find((e) => e.id === requestId);
  if (!target) return { ...idle, state: 'not_found', readyAt: null };
  const aheadCount = activeQueue.filter(
    (e) => e.status === 'waiting' && e.id !== target.id && canonicalRank(e, target) < 0,
  ).length;
  const isUpNext = aheadCount === 0;
  return {
    requestId,
    state: isUpNext ? 'up_next' : 'waiting',
    position: aheadCount + 1,
    aheadCount,
    isUpNext,
    isNowPlaying: false,
    readyAt,
  };
}
