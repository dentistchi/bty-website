// V1.1.1 MANUAL-FIRST — request creation is never a playback transition.
//
// Regression guard for the idle-stage false-playing defect: a brand-new request in
// an idle event must be persisted as `waiting`, and NO code path (creation, Ready,
// queue read) may flip it to `playing`. Only explicit dj/start (ensurePlaying) or the
// finish→next continuation (promoteNextReady) may create a playing row — both proven
// in autopilot-v81.server.test.ts. Here we pin the creation side + the route wiring.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Capture the exact row inserted by addRequest.
let capturedInsert: Record<string, unknown> | null = null;

function makeDb() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.in = () => b;
  b.insert = (payload: Record<string, unknown>) => {
    capturedInsert = payload;
    return b;
  };
  // insert(...).select('*').single() → the created row echoes the inserted payload.
  b.single = async () => ({ data: { id: 'new-req', ...(capturedInsert ?? {}) }, error: null });
  // listActiveRequests ends on .order(...) (awaited) → empty active queue is fine here.
  b.order = async () => ({ data: [], error: null });
  // The bare positions query `select('position').eq('room_id', id)` is awaited directly.
  b.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve({ data: [{ position: 1 }], error: null });
  return { from: () => b };
}

vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => makeDb() }));

import { addRequest } from './rooms.server';

beforeEach(() => {
  capturedInsert = null;
});

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('manual-first — request creation persists waiting, never playing', () => {
  it('addRequest inserts status:"waiting" (new request in an idle event stays waiting)', async () => {
    const res = await addRequest({
      roomId: 'room-1',
      guestName: '한빛',
      youtubeVideoId: 'dQw4w9WgXcQ',
      eventId: 'evt-1',
    });
    expect(capturedInsert?.status).toBe('waiting');
    expect(res.outcome).toBe('created');
    if (res.outcome !== 'conflict') expect(res.request.status).toBe('waiting');
  });

  it('addRequest NEVER inserts a playing/started row (no auto-stage on creation)', async () => {
    await addRequest({ roomId: 'room-1', guestName: 'G', youtubeVideoId: 'dQw4w9WgXcQ', eventId: 'evt-1' });
    expect(capturedInsert?.status).not.toBe('playing');
    expect(capturedInsert).not.toHaveProperty('started_at');
  });
});

describe('manual-first — creation routes never promote after adding a request', () => {
  it('guest POST /requests adds and returns — it never starts/promotes', () => {
    const src = strip(read('../app/api/rooms/[slug]/requests/route.ts'));
    expect(src).toContain('addRequest');
    expect(src).not.toMatch(/promoteNextReady|ensurePlaying|reconcileStage|start_karaoke_request|passTurnAndPromote/);
  });

  it('DJ POST /dj/requests adds and returns — it never starts/promotes', () => {
    const src = strip(read('../app/api/rooms/[slug]/dj/requests/route.ts'));
    expect(src).toContain('addRequest');
    expect(src).not.toMatch(/promoteNextReady|ensurePlaying|reconcileStage|start_karaoke_request|passTurnAndPromote/);
  });

  it('the source-level rooms service exposes NO reconcileStage seam (idle self-heal gone)', () => {
    const rooms = strip(read('./rooms.server.ts'));
    expect(rooms).not.toContain('reconcileStage');
  });
});
