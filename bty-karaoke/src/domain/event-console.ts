// BUILD R4E-R1 — pure operator classification for the Manager Events list. No I/O, no clock of its
// own (every function takes `nowMs`), so the same inputs always produce the same class.
//
// WHY THIS EXISTS. The list is ordered `created_at desc` with no date predicate, so 43 rows of
// history arrived under the heading "Tonight's Events" and the operator had to work out which
// three were actually live. Classification moves that judgement out of the operator's head and out
// of JSX, into one tested place.
//
// THE RULE THIS MODULE REFUSES TO BREAK: a class is decided by PROVENANCE AND ACTIVITY, never by
// what an event is called. `테스트`, `테스트2` and `BTY Demo Room` belong to real Host accounts with
// real songs; calling them engineering tests because of their names would hide genuine user
// history. Conversely a founder test with an innocent name is still a test.

/** Operator-facing class. Exactly one applies to an event. */
export type EventClass =
  | 'ACTIVE'
  | 'STALE'
  | 'RECENT'
  | 'ENDED'
  | 'TEST'
  | 'DELETED_ARCHIVED';

/**
 * How long an active event may go without meaningful activity before it stops being "what is
 * happening now". Deliberately ONE constant for the whole page: it decides both whether an event
 * is ACTIVE and whether a DJ device is recent enough to call "connected", so the page never holds
 * two different opinions about what "current" means.
 */
export const ACTIVE_IDLE_DAYS = 7;
/** An ended event stays in the operator's recent window for this long. */
export const RECENT_ENDED_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EventClassInput {
  status: string;
  /** Strongest available activity signal: latest request, else the event's own start/creation. */
  lastActivityAt: string | null;
  endedAt: string | null;
  /** The event's room is retired — BUILD 26E freezes rooms this way on account deletion. */
  roomRetired: boolean;
  /**
   * PROVEN engineering/founder provenance — established structurally by the caller (a room with no
   * owning account was created through the manager console before Host accounts existed). Never
   * derived from a display name.
   */
  provenTest: boolean;
}

function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return (nowMs - ms) / DAY_MS;
}

/**
 * Classify one event.
 *
 * ORDER MATTERS, and it encodes a judgement: a retired room wins over everything, because the
 * event is account-deletion history and must never be presented as live or defective. Proven test
 * provenance comes next so a founder fixture is filed as a test rather than as ordinary history.
 * Only then does live-versus-stale get decided.
 */
export function classifyEvent(input: EventClassInput, nowMs: number): EventClass {
  if (input.roomRetired) return 'DELETED_ARCHIVED';
  if (input.provenTest) return 'TEST';

  if (input.status === 'active') {
    const idle = daysSince(input.lastActivityAt, nowMs);
    // No usable timestamp at all: treat as stale rather than live. An event we cannot show to be
    // current should never occupy the screen that answers "what is happening now".
    if (idle == null) return 'STALE';
    return idle <= ACTIVE_IDLE_DAYS ? 'ACTIVE' : 'STALE';
  }

  const sinceEnd = daysSince(input.endedAt, nowMs);
  if (sinceEnd != null && sinceEnd <= RECENT_ENDED_DAYS) return 'RECENT';
  return 'ENDED';
}

/** Whole days of inactivity, for the "inactive N days" copy on a stale card. */
export function idleDays(lastActivityAt: string | null, nowMs: number): number | null {
  const d = daysSince(lastActivityAt, nowMs);
  return d == null ? null : Math.floor(d);
}

/**
 * May the list show "DJ connected"?
 *
 * The stored signal is room-level and has no event linkage, so the badge used to appear on events
 * that ended a month ago simply because a device was still enrolled in that room. Rather than
 * inventing a link that does not exist, the badge is narrowed to the only situation where the
 * room-level fact and the event are plausibly the same thing: the event is live NOW, a device is
 * active, and that device was actually used inside the same freshness window that makes the event
 * live. An enrolled-but-unused device is not a connection.
 */
export function showDjConnected(
  eventClass: EventClass,
  djConnected: boolean,
  djLastUsedAt: string | null,
  nowMs: number,
): boolean {
  if (eventClass !== 'ACTIVE' || !djConnected) return false;
  const d = daysSince(djLastUsedAt, nowMs);
  return d != null && d <= ACTIVE_IDLE_DAYS;
}

/** The filter tabs, and which classes each admits. */
export type EventView = 'active' | 'needs-attention' | 'recent' | 'ended' | 'test' | 'deleted' | 'all';

export function matchesView(view: EventView, cls: EventClass): boolean {
  switch (view) {
    case 'active': return cls === 'ACTIVE';
    case 'needs-attention': return cls === 'STALE';
    case 'recent': return cls === 'RECENT';
    case 'ended': return cls === 'ENDED';
    case 'test': return cls === 'TEST';
    case 'deleted': return cls === 'DELETED_ARCHIVED';
    case 'all': return true;
  }
}

/**
 * Operator ordering. Never `created_at desc` alone — that is what buried the three live events
 * among forty rows of history.
 */
export function compareForView(
  view: EventView,
  a: { cls: EventClass; lastActivityAt: string | null; endedAt: string | null; createdAt: string },
  b: { cls: EventClass; lastActivityAt: string | null; endedAt: string | null; createdAt: string },
): number {
  const t = (v: string | null) => (v ? Date.parse(v) : 0);
  if (view === 'active') return t(b.lastActivityAt) - t(a.lastActivityAt); // most recently alive first
  if (view === 'needs-attention') return t(a.lastActivityAt) - t(b.lastActivityAt); // most stale first
  if (view === 'recent' || view === 'ended' || view === 'deleted') {
    return t(b.endedAt) - t(a.endedAt) || t(b.createdAt) - t(a.createdAt);
  }
  if (view === 'all') {
    // Current work ahead of history, then most recent first within each band.
    const rank: Record<EventClass, number> = {
      ACTIVE: 0, STALE: 1, RECENT: 2, ENDED: 3, TEST: 4, DELETED_ARCHIVED: 5,
    };
    const r = rank[a.cls] - rank[b.cls];
    if (r !== 0) return r;
  }
  return (t(b.lastActivityAt) || t(b.createdAt)) - (t(a.lastActivityAt) || t(a.createdAt));
}
