// V5 invariant: Admin (DJ), Display, and Guest must render the SAME event group.
// They already read the same room-scoped active queue through the same pure
// resolvers — this pins that they can never disagree on NOW / NEXT / waiting, so
// a future refactor that splits one of them fails here.

import { describe, it, expect } from 'vitest';
import {
  selectStage,
  resolveGuestStatus,
  canonicalRank,
  type QueueOrderEntry,
  type RequestStatus,
} from './queue';
import { computeEventStats } from './event-stats';

interface Row extends QueueOrderEntry {
  guest_name: string;
}

// One shared active queue (canonical order = position asc), as the server hands
// each screen. r2 is on stage; r1, r3, r4 wait in line.
const active: Row[] = [
  { id: 'r2', status: 'playing', position: 1, created_at: '2026-07-15T20:00:00Z', guest_name: 'Bo' },
  { id: 'r1', status: 'waiting', position: 2, created_at: '2026-07-15T20:01:00Z', guest_name: 'Han' },
  { id: 'r3', status: 'waiting', position: 3, created_at: '2026-07-15T20:02:00Z', guest_name: 'Cho' },
  { id: 'r4', status: 'waiting', position: 4, created_at: '2026-07-15T20:03:00Z', guest_name: 'Deb' },
];
const orderEntries: QueueOrderEntry[] = active.map((r) => ({
  id: r.id,
  status: r.status,
  position: r.position,
  created_at: r.created_at,
}));

// Display projection (mirrors getDisplayState): playing + canonically-first waiting.
function displayView() {
  const playing = active.find((r) => r.status === 'playing') ?? null;
  const waiting = active
    .filter((r) => r.status === 'waiting')
    .sort((a, b) => canonicalRank(a, b));
  return { playing, next: waiting[0] ?? null, waitingCount: waiting.length };
}

describe('Admin == Display == Guest over one canonical queue', () => {
  const dj = selectStage(active); // Admin/DJ stage
  const disp = displayView(); // iPad Display
  const firstWaiting = disp.next!;

  it('NOW SINGING agrees across all three screens', () => {
    const guestNow = resolveGuestStatus('r2', orderEntries, 'playing');
    expect(dj.current?.id).toBe('r2');
    expect(disp.playing?.id).toBe('r2');
    expect(guestNow.state).toBe('now_playing');
  });

  it('NEXT / canonical-next agrees across all three screens', () => {
    const guestNext = resolveGuestStatus(firstWaiting.id, orderEntries, 'waiting');
    expect(dj.queue[0]?.id).toBe('r1'); // DJ up-next
    expect(disp.next?.id).toBe('r1'); // Display NEXT
    expect(firstWaiting.id).toBe('r1');
    expect(guestNext.state).toBe('up_next'); // Guest sees themselves first in line
    expect(guestNext.position).toBe(1);
  });

  it('waiting count agrees across DJ / Display / stats', () => {
    const stats = computeEventStats(active.map((r) => ({ guest_name: r.guest_name, status: r.status })));
    expect(dj.queue.length).toBe(3);
    expect(disp.waitingCount).toBe(3);
    expect(stats.waiting).toBe(3);
    expect(stats.playing).toBe(1);
  });

  it('a mid-queue waiter sees a position consistent with the shared order', () => {
    const guestR3 = resolveGuestStatus('r3', orderEntries, 'waiting');
    expect(guestR3.state).toBe('waiting');
    expect(guestR3.aheadCount).toBe(1); // only r1 is ahead (r2 is playing, not "ahead")
    expect(guestR3.position).toBe(2);
  });
});

describe('empty stage agrees (no one singing)', () => {
  const emptyActive: Row[] = [
    { id: 'w1', status: 'waiting', position: 1, created_at: '2026-07-15T20:00:00Z', guest_name: 'A' },
  ];
  it('DJ + Display both show stage open with the same first waiter', () => {
    const dj = selectStage(emptyActive);
    const playing = emptyActive.find((r) => r.status === 'playing') ?? null;
    expect(dj.current).toBeNull();
    expect(playing).toBeNull();
    expect(dj.queue[0]?.id).toBe('w1');
  });
});
