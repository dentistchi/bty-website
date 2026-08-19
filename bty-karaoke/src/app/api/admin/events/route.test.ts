import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks: authority + service + link builders (DB is never touched) --------
const managerState = { enabled: true, authorized: true };
vi.mock('@/lib/manager-auth.server', () => ({
  managerEnabled: () => managerState.enabled,
  managerAuthorized: async () => managerState.authorized,
}));

const fakeEvent = {
  id: 'evt-1',
  room_id: 'room-1',
  name: 'Friday Night',
  host_name: 'Dr. Chi',
  public_code: '7K4M2P',
  guest_slug: 'friday-night-7k4m2p',
  status: 'active' as const,
  starts_at: '2026-07-14T10:00:00.000Z',
  ended_at: null,
  created_by: null,
  created_at: '2026-07-14T10:00:00.000Z',
  updated_at: '2026-07-14T10:00:00.000Z',
};

vi.mock('@/lib/events.server', () => ({
  createEvent: vi.fn(async () => ({ event: fakeEvent, roomSlug: 'evt-7k4m2p' })),
  mintDjEnrollment: vi.fn(async () => ({
    token: 'dj-enroll-token',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })),
  listEventSummaries: vi.fn(async () => []),
  // BUILD R4E-R1 — the list route now reads the classified console projection.
  listEventConsole: vi.fn(async () => ({
    events: [],
    totals: { active: 0, stale: 0, recent: 0, ended: 0, test: 0, deleted: 0, all: 0 },
    window: { limit: 50, returned: 0 },
  })),
  publicEvent: (e: typeof fakeEvent) => ({
    id: e.id,
    name: e.name,
    hostName: e.host_name,
    status: e.status,
    publicCode: e.public_code,
    guestSlug: e.guest_slug,
    startsAt: e.starts_at,
    endedAt: e.ended_at,
    createdAt: e.created_at,
  }),
}));

vi.mock('@/lib/event-links.server', () => ({
  guestQrFor: async () => ({ url: 'https://x.test/j/friday-night-7k4m2p', qrSvg: '<svg id="guest"/>' }),
  djEnrollQrFor: async () => ({
    url: 'https://x.test/r/evt-7k4m2p/dj/pair?token=dj-enroll-token',
    qrSvg: '<svg id="dj"/>',
  }),
}));

import { GET, POST } from './route';

interface FakeReqInit {
  authorization?: string;
  body?: unknown;
}
function makeReq({ authorization, body }: FakeReqInit) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
    nextUrl: { origin: 'https://x.test', searchParams: new URLSearchParams() },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  managerState.enabled = true;
  managerState.authorized = true;
});

describe('POST /api/admin/events', () => {
  it('rejects an unauthorized caller with 401', async () => {
    managerState.authorized = false;
    const res = await POST(makeReq({ body: { name: 'X' } }));
    expect(res.status).toBe(401);
  });

  it('returns 503 when the feature is disabled', async () => {
    managerState.enabled = false;
    const res = await POST(makeReq({ authorization: 'Bearer t', body: { name: 'X' } }));
    expect(res.status).toBe(503);
  });

  it('creates an event and returns both QRs with NO raw credential', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer t', body: { name: 'Friday Night', hostName: 'Dr. Chi' } }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.event.publicCode).toBe('7K4M2P');
    expect(data.event.guestSlug).toBe('friday-night-7k4m2p');
    expect(data.guestQrSvg).toContain('<svg');
    expect(data.djEnrollmentQrSvg).toContain('<svg');
    expect(typeof data.djEnrollmentExpiresAt).toBe('string');

    // Security: the serialized response must not leak any secret/credential.
    const raw = JSON.stringify(data).toLowerCase();
    expect(raw).not.toContain('dj_secret');
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('credential');
    expect(raw).not.toContain('room_id');
  });

  it('rejects an empty name with 400', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer t', body: { name: '  ' } }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/events', () => {
  it('rejects an unauthorized caller with 401', async () => {
    managerState.authorized = false;
    const res = await GET(makeReq({}));
    expect(res.status).toBe(401);
  });

  it('lists events for an authorized manager', async () => {
    const res = await GET(makeReq({ authorization: 'Bearer t' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.events)).toBe(true);
    // R4E-R1: the list now carries operator totals and its management window.
    expect(data.totals).toBeTruthy();
    expect(data.window).toEqual({ limit: 50, returned: 0 });
  });
});
