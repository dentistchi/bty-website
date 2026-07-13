import { describe, it, expect } from 'vitest';
import { rateLimitKeys, shouldLock, IP_MAX, ROOM_MAX } from './rate-limit.server';

describe('rate-limit key derivation', () => {
  it('namespaces keys per room and pseudonymized IP', () => {
    const k = rateLimitKeys('room-1', 'abc123');
    expect(k.ipFail).toBe('apin:fail:ip:room-1:abc123');
    expect(k.ipLock).toBe('apin:lock:ip:room-1:abc123');
    expect(k.roomFail).toBe('apin:fail:room:room-1');
    expect(k.roomLock).toBe('apin:lock:room:room-1');
  });
  it('different rooms/IPs never share keys', () => {
    expect(rateLimitKeys('a', 'x').ipFail).not.toBe(rateLimitKeys('b', 'x').ipFail);
    expect(rateLimitKeys('a', 'x').ipFail).not.toBe(rateLimitKeys('a', 'y').ipFail);
  });
});

describe('shouldLock', () => {
  it('trips at the threshold', () => {
    expect(shouldLock(IP_MAX - 1, IP_MAX)).toBe(false);
    expect(shouldLock(IP_MAX, IP_MAX)).toBe(true);
    expect(shouldLock(ROOM_MAX, ROOM_MAX)).toBe(true);
  });
});
