import { describe, it, expect } from 'vitest';
import { signYouTubeProvenance, verifyYouTubeProvenance } from './youtube-provenance.server';

// BUILD 26T-R1B-R6-R1B-R3 §A — the DB freshness authority.
//
// These model exactly what the request/save routes do: build the snapshot from the values that
// will be PERSISTED, verify, and use the verifier's instant. The client's own `youtubeFetchedAt`
// is never consulted, so these tests treat it as the hostile input it is.

const T0 = Date.parse('2026-08-01T10:00:00.000Z');
const T1 = Date.parse('2026-08-30T10:00:00.000Z');
const snap = { videoId: 'dQw4w9WgXcQ', title: 'Amazing Grace', channelTitle: 'Traditional', thumbnailUrl: 'https://i.ytimg.com/x.jpg' };

/** The routes' logic, isolated: what actually reaches youtube_metadata_fetched_at. */
async function columnValue(body: { youtubeProvenance?: string; youtubeFetchedAt?: string }, persisted = snap) {
  const sealed = await verifyYouTubeProvenance(body.youtubeProvenance, persisted);
  return sealed ? sealed.toISOString() : null;   // NO fallback to body.youtubeFetchedAt, ever
}

describe('§A — only the verifier-sealed instant reaches the column', () => {
  it('CONTROL: a genuine seal writes its own T0', async () => {
    const token = await signYouTubeProvenance(snap, T0);
    expect(await columnValue({ youtubeProvenance: token })).toBe('2026-08-01T10:00:00.000Z');
  });

  it('M1/M3: a body timestamp of T1 alongside a T0 seal still writes T0', async () => {
    const token = await signYouTubeProvenance(snap, T0);
    const written = await columnValue({ youtubeProvenance: token, youtubeFetchedAt: new Date(T1).toISOString() });
    expect(written).toBe('2026-08-01T10:00:00.000Z');   // NOT T1
  });

  it('M2: a missing seal writes NULL — never now(), never the body value', async () => {
    expect(await columnValue({ youtubeFetchedAt: new Date().toISOString() })).toBeNull();
    expect(await columnValue({})).toBeNull();
  });

  it('M2: an invalid seal writes NULL even with a plausible body timestamp', async () => {
    expect(await columnValue({ youtubeProvenance: 'forged.token', youtubeFetchedAt: new Date(T0).toISOString() })).toBeNull();
  });

  it('M7: a seal for video A does not authorise the snapshot actually persisted (B)', async () => {
    const tokenA = await signYouTubeProvenance(snap, T0);
    const persistedB = { ...snap, videoId: 'jNQXAC9IVRw' };
    expect(await columnValue({ youtubeProvenance: tokenA }, persistedB)).toBeNull();
  });

  it('a mutation of ANY bound field invalidates the seal', async () => {
    const token = await signYouTubeProvenance(snap, T0);
    for (const mutated of [
      { ...snap, title: 'Other' },
      { ...snap, channelTitle: 'Other' },
      { ...snap, thumbnailUrl: 'https://evil.example/x.jpg' },
    ]) {
      expect(await columnValue({ youtubeProvenance: token }, mutated)).toBeNull();
    }
  });

  it('§F durable replay: the same seal replayed later still writes T0', async () => {
    // The intent stored the seal at T0 and is replayed at T1. A replay is not a refresh.
    const token = await signYouTubeProvenance(snap, T0);
    const atReplay = await columnValue({ youtubeProvenance: token, youtubeFetchedAt: new Date(T1).toISOString() });
    expect(atReplay).toBe('2026-08-01T10:00:00.000Z');
  });

  it('§G a legacy payload with neither field remains functional and unknown', async () => {
    expect(await columnValue({})).toBeNull();
  });
});
