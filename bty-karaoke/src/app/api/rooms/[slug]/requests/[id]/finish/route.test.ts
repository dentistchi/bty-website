// V6: guest self-finish is removed — the route is closed (410). The Admin Player
// passes the turn after stopping the video on the TV. Guests keep cancel only.

import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('POST .../requests/[id]/finish (removed in V6)', () => {
  it('410 Gone with a clear code + no-store, never completing a song', async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const data = await res.json();
    expect(data.code).toBe('GUEST_FINISH_REMOVED');
  });
});
