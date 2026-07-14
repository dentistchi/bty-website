// Pure event statistics. Computed from the event's request rows (no analytics
// table in V1) so the same numbers back the manager list, the event detail, and
// the DJ header. No I/O — the server hands the rows in.

import type { RequestStatus } from './queue';

/** The minimal request shape the stats need. */
export interface StatRequest {
  guest_name: string;
  status: RequestStatus;
}

export interface EventStats {
  /** Distinct singers (case-insensitive, whitespace-normalized names). */
  uniqueGuests: number;
  /** Every request ever made in the event, any status. */
  totalRequests: number;
  /** Songs that finished playing. */
  completed: number;
  /** Songs the DJ skipped. */
  skipped: number;
  /** Still waiting in line right now. */
  waiting: number;
  /** Currently on the stage (0 or 1 in normal operation). */
  playing: number;
}

/** Same normalization the room stats use, so guest counts agree everywhere. */
function guestKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Aggregate an event's requests into the V1 stat set. Order-independent. */
export function computeEventStats(requests: readonly StatRequest[]): EventStats {
  const guests = new Set<string>();
  let completed = 0;
  let skipped = 0;
  let waiting = 0;
  let playing = 0;

  for (const r of requests) {
    guests.add(guestKey(r.guest_name));
    switch (r.status) {
      case 'completed':
        completed += 1;
        break;
      case 'skipped':
        skipped += 1;
        break;
      case 'waiting':
        waiting += 1;
        break;
      case 'playing':
        playing += 1;
        break;
      // 'removed' rows count toward totals/guests but no bucket.
    }
  }

  return {
    uniqueGuests: guests.size,
    totalRequests: requests.length,
    completed,
    skipped,
    waiting,
    playing,
  };
}
