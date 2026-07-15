// V6: guest self-start is removed — the route is closed (410) so no client can
// promote a song to the stage. Only the Admin Player starts songs on the TV.

import { describe, it, expect } from 'vitest';
import { POST } from './route';

const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

describe('POST .../requests/[id]/start (removed in V6)', () => {
  it('410 Gone with a clear code, no-store, and never starts a song', async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const data = await res.json();
    expect(data.code).toBe('GUEST_START_REMOVED');
  });
  // The route ignores params entirely (it can never act) — a stale client with any
  // request id gets the same honest refusal.
  void ctx;
});
