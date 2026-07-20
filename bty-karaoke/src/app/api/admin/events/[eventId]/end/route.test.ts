import { describe, it, expect, vi, beforeEach } from 'vitest';

const s = { enabled: true, authorized: true, event: { id: 'evt-1', status: 'ended' as string } as unknown };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => s.enabled,
  managerAuthorized: async () => s.authorized,
}));
vi.mock('@/lib/events.server', () => ({
  endEvent: vi.fn(async () =>
    s.event ? { event: s.event, summary: { completedCount: 5, unfinishedClosedCount: 2 } } : null,
  ),
  publicEvent: (e: { id: string; status: string }) => ({ id: e.id, status: e.status }),
}));

import { POST } from './route';

function makeReq() {
  return {} as unknown as Parameters<typeof POST>[0];
}
const ctx = (eventId: string) => ({ params: Promise.resolve({ eventId }) });

beforeEach(() => {
  s.enabled = true;
  s.authorized = true;
  s.event = { id: 'evt-1', status: 'ended' };
});

describe('POST /api/admin/events/[eventId]/end', () => {
  it('rejects an unauthenticated caller (no manager cookie) with 401', async () => {
    s.authorized = false;
    const res = await POST(makeReq(), ctx('evt-1'));
    expect(res.status).toBe(401);
  });

  it('ends the event and returns its ended status + honest summary for an authorized manager', async () => {
    const res = await POST(makeReq(), ctx('evt-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.status).toBe('ended');
    expect(data.summary).toEqual({ completedCount: 5, unfinishedClosedCount: 2 });
  });

  it('returns 404 when the event does not exist', async () => {
    s.event = null;
    const res = await POST(makeReq(), ctx('missing'));
    expect(res.status).toBe(404);
  });
});
