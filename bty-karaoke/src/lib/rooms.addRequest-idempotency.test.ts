// BUILD 18B — addRequest guest-queue idempotency. Proves a retried/concurrent submit of
// the SAME logical request never inserts a second row (replay), a key reused for a
// DIFFERENT song is a stable conflict (never a silent success), and legacy no-key inserts
// are unchanged.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-test knobs: whether the INSERT collides (23505) and what the existing row is.
let insertError: { code: string } | null = null;
let existingRow: Record<string, unknown> | null = null;
let capturedInsert: Record<string, unknown> | null = null;

function makeDb() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.is = () => b;
  b.in = () => b;
  b.insert = (payload: Record<string, unknown>) => {
    capturedInsert = payload;
    return b;
  };
  // insert(...).select('*').single()
  b.single = async () =>
    insertError
      ? { data: null, error: insertError }
      : { data: { id: 'new-req', ...(capturedInsert ?? {}) }, error: null };
  // findRequestByKey(...).maybeSingle()
  b.maybeSingle = async () => ({ data: existingRow, error: null });
  // listActiveRequests ends on .order(...)
  b.order = async () => ({ data: [], error: null });
  // positions query select('position').eq('room_id', id) is awaited directly
  b.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve({ data: [{ position: 1 }], error: null });
  return { from: () => b };
}

vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => makeDb() }));

import { addRequest } from './rooms.server';

const base = {
  roomId: 'room-1',
  guestName: '한빛',
  youtubeVideoId: 'dQw4w9WgXcQ',
  eventId: 'evt-1',
} as const;

beforeEach(() => {
  insertError = null;
  existingRow = null;
  capturedInsert = null;
});

describe('addRequest — idempotency', () => {
  it('created: a fresh insert stamps idempotency_key and returns outcome=created', async () => {
    const res = await addRequest({ ...base, idempotencyKey: 'key-1' });
    expect(res.outcome).toBe('created');
    expect(capturedInsert?.idempotency_key).toBe('key-1');
  });

  it('legacy: no key → plain insert, no idempotency_key, outcome=created', async () => {
    const res = await addRequest({ ...base });
    expect(res.outcome).toBe('created');
    expect(capturedInsert?.idempotency_key).toBeNull();
  });

  it('replayed: same key + SAME payload collides (23505) → returns the existing row, no 2nd insert', async () => {
    insertError = { code: '23505' };
    existingRow = { id: 'existing-req', youtube_video_id: base.youtubeVideoId, guest_name: base.guestName, status: 'waiting' };
    const res = await addRequest({ ...base, idempotencyKey: 'key-1' });
    expect(res.outcome).toBe('replayed');
    if (res.outcome === 'replayed') expect(res.request.id).toBe('existing-req');
  });

  it('concurrent duplicate: the losing insert (23505) replays the winner — still one row', async () => {
    // Same shape as a replay: the second concurrent request collides and returns the first.
    insertError = { code: '23505' };
    existingRow = { id: 'winner', youtube_video_id: base.youtubeVideoId, guest_name: base.guestName, status: 'waiting' };
    const res = await addRequest({ ...base, idempotencyKey: 'key-1' });
    expect(res.outcome).toBe('replayed');
    if (res.outcome === 'replayed') expect(res.request.id).toBe('winner');
  });

  it('conflict: same key reused for a DIFFERENT song → outcome=conflict (never silent success)', async () => {
    insertError = { code: '23505' };
    existingRow = { id: 'other', youtube_video_id: 'DIFFERENT_VID', guest_name: base.guestName, status: 'waiting' };
    const res = await addRequest({ ...base, idempotencyKey: 'key-1' });
    expect(res.outcome).toBe('conflict');
  });

  it('conflict: same key, different guest → conflict', async () => {
    insertError = { code: '23505' };
    existingRow = { id: 'other', youtube_video_id: base.youtubeVideoId, guest_name: '다른사람', status: 'waiting' };
    const res = await addRequest({ ...base, idempotencyKey: 'key-1' });
    expect(res.outcome).toBe('conflict');
  });

  it('a non-23505 insert error is never swallowed (throws)', async () => {
    insertError = { code: '23502' }; // not-null violation, unrelated
    await expect(addRequest({ ...base, idempotencyKey: 'key-1' })).rejects.toBeTruthy();
  });

  it('different keys for a legitimate repeat request each insert (two rows)', async () => {
    const r1 = await addRequest({ ...base, idempotencyKey: 'key-1' });
    const r2 = await addRequest({ ...base, idempotencyKey: 'key-2' });
    expect(r1.outcome).toBe('created');
    expect(r2.outcome).toBe('created'); // a genuinely new request → new key → new row
  });
});
