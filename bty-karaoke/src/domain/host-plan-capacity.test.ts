// PRO Multi-Room V1 — the pure Room-capacity vocabulary. This is the DISPLAY mirror
// the Host Hub reads; the DB RPC is the enforcement authority (see host-auth.multiroom
// tests). These lock the numbers (FREE=1 / PRO=3) and the legacy over-cap behavior.

import { describe, it, expect } from 'vitest';
import { maxRoomsForPlan, canCreateAnotherRoom, ROOM_LIMITS } from './host-plan';

describe('maxRoomsForPlan', () => {
  it('FREE grants 1, PRO grants 3', () => {
    expect(maxRoomsForPlan('FREE')).toBe(1);
    expect(maxRoomsForPlan('PRO')).toBe(3);
    expect(ROOM_LIMITS).toEqual({ FREE: 1, PRO: 3 });
  });
});

describe('canCreateAnotherRoom', () => {
  it('FREE: allowed at 0, blocked at 1+ (incl. legacy over-cap)', () => {
    expect(canCreateAnotherRoom('FREE', 0)).toBe(true);
    expect(canCreateAnotherRoom('FREE', 1)).toBe(false);
    expect(canCreateAnotherRoom('FREE', 2)).toBe(false); // legacy multi-Room FREE
  });

  it('PRO: allowed at 0,1,2 — blocked at 3+', () => {
    expect(canCreateAnotherRoom('PRO', 0)).toBe(true);
    expect(canCreateAnotherRoom('PRO', 1)).toBe(true);
    expect(canCreateAnotherRoom('PRO', 2)).toBe(true);
    expect(canCreateAnotherRoom('PRO', 3)).toBe(false);
    expect(canCreateAnotherRoom('PRO', 4)).toBe(false);
  });

  it('treats a negative/NaN count as 0 (never throws)', () => {
    expect(canCreateAnotherRoom('PRO', -5)).toBe(true);
    expect(canCreateAnotherRoom('FREE', Number.NaN)).toBe(true);
  });

  it('SERIALIZED CONCURRENCY: PRO at count 2, two lock-serialized requests → exactly 3', () => {
    // The per-account advisory xact lock serializes concurrent creates; simulate that
    // serialization over the pure decision to prove the count never overshoots.
    let count = 2;
    const outcomes: string[] = [];
    for (const _req of [0, 1]) {
      if (canCreateAnotherRoom('PRO', count)) {
        count += 1;
        outcomes.push('created');
      } else {
        outcomes.push('limit_reached');
      }
    }
    expect(count).toBe(3); // never 4
    expect(outcomes).toEqual(['created', 'limit_reached']);
  });
});
