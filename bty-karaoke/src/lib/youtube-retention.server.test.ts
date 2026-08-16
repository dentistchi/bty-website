import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyFreshness,
  isOverRetentionMax,
  probeVideoSnapshots,
  decideRetention,
  deferralStillPermitted,
  HARD_TRANSITION_DAYS,
  sweepRetention,
  isActiveRequestStatus,
  PROHIBITED_WRITER,
  RetentionWriteViolation,
  REFRESH_BATCH_MAX,
  REFRESH_MARGIN_DAYS,
  RETENTION_MAX_DAYS,
  type RetentionRow,
  type RetentionWriter,
  type FetchLike,
} from './youtube-retention.server';

// BUILD 26T-R1B-R6-R1B-R5 — the retention taxonomy.
//
// The failure this suite exists to prevent: a customer's history quietly erased because a network
// call failed. Every "do not clear" assertion below is about that, and the shape of the YouTube
// API is what decides which responses are allowed to be destructive.

const DAY = 86_400_000;
const NOW = new Date('2026-08-15T12:00:00.000Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

const KEY = 'test-key';
/** A response builder — the real `videos.list` shape, not an invented one. */
function ok(items: unknown[]): Response {
  return new Response(JSON.stringify({ items }), { status: 200, headers: { 'content-type': 'application/json' } });
}
function err(status: number, reason?: string): Response {
  const body = reason ? JSON.stringify({ error: { errors: [{ reason }] } }) : 'not json';
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}
const snippetItem = (id: string) => ({
  id,
  snippet: {
    title: `Title ${id}`,
    channelTitle: `Channel ${id}`,
    thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hq.jpg` } },
  },
});

const reqRow = (over: Partial<RetentionRow> = {}): RetentionRow => ({
  id: 'row-1',
  table: 'karaoke_requests',
  videoId: 'VID00000001',
  fetchedAt: ago(40),
  status: 'completed',
  ...over,
});

// =============================================================================
// §A — the freshness window
// =============================================================================
describe('§A freshness classification', () => {
  it('the ratified window is 23-day refresh inside a 30-day maximum', () => {
    expect(REFRESH_MARGIN_DAYS).toBe(23);
    expect(RETENTION_MAX_DAYS).toBe(30);
  });

  it('P1: under 23 days is FRESH — no retention action, no API call', () => {
    expect(classifyFreshness(ago(22.9), NOW)).toBe('FRESH');
  });

  it('P2: exactly 23 days is a REFRESH_CANDIDATE (the margin is inclusive)', () => {
    expect(classifyFreshness(ago(23), NOW)).toBe('REFRESH_CANDIDATE');
  });

  it('P3: older factual provenance is a REFRESH_CANDIDATE', () => {
    expect(classifyFreshness(ago(40), NOW)).toBe('REFRESH_CANDIDATE');
  });

  it('M1: NULL provenance is UNKNOWN and is NEVER classified fresh', () => {
    // The mutant this kills returns FRESH for null, which would leave every legacy row
    // permanently unexamined while reporting a clean sweep.
    expect(classifyFreshness(null, NOW)).toBe('UNKNOWN_PROVENANCE');
    expect(classifyFreshness(undefined, NOW)).toBe('UNKNOWN_PROVENANCE');
    expect(classifyFreshness(null, NOW)).not.toBe('FRESH');
  });

  it('M2: the classifier takes ONLY the provenance instant — there is no created_at parameter', () => {
    // Structural, not behavioural: a created_at fallback cannot be added without changing this
    // signature, and the SQL matrix proves the same for the selection view.
    expect(classifyFreshness.length).toBe(2);
  });

  it('an unknown age is not a MEASURED breach of the maximum', () => {
    expect(isOverRetentionMax(null, NOW)).toBe(false);
    expect(isOverRetentionMax(ago(31), NOW)).toBe(true);
    expect(isOverRetentionMax(ago(29), NOW)).toBe(false);
  });
});

// =============================================================================
// §B/§C — the measured API contract and the taxonomy
// =============================================================================
describe('§B the measured videos.list contract', () => {
  it('calls videos?part=snippet with comma-joined ids and batches at 50', async () => {
    const urls: string[] = [];
    const f: FetchLike = async (u) => {
      urls.push(u);
      return ok([]);
    };
    const ids = Array.from({ length: 120 }, (_, i) => `V${String(i).padStart(10, '0')}`);
    const probe = await probeVideoSnapshots(ids, { fetchImpl: f, apiKey: KEY, nowMs: NOW.getTime() });
    expect(REFRESH_BATCH_MAX).toBe(50);
    expect(urls.length).toBe(3); // 50 + 50 + 20
    expect(probe.apiCallsAttempted).toBe(3);
    expect(urls[0]).toContain('part=snippet');
    expect(urls[0]).toContain('/youtube/v3/videos');
    expect(urls[0].split('id=')[1].split('&')[0].split('%2C').length).toBe(50);
  });

  it('the API key never appears in a thrown message or an outcome', async () => {
    const probe = await probeVideoSnapshots(['VID00000001'], {
      fetchImpl: async () => err(403, 'forbidden'),
      apiKey: 'SUPER-SECRET-KEY',
      nowMs: NOW.getTime(),
    });
    expect(JSON.stringify([...probe.outcomes])).not.toContain('SUPER-SECRET-KEY');
  });

  it('REFRESHED carries the current snapshot and the factual fetch instant', async () => {
    const probe = await probeVideoSnapshots(['VID00000001'], {
      fetchImpl: async () => ok([snippetItem('VID00000001')]),
      apiKey: KEY,
      nowMs: NOW.getTime(),
    });
    const o = probe.outcomes.get('VID00000001')!;
    expect(o.kind).toBe('REFRESHED');
    if (o.kind !== 'REFRESHED') throw new Error('unreachable');
    expect(o.snapshot.title).toBe('Title VID00000001');
    expect(o.snapshot.channelTitle).toBe('Channel VID00000001');
    expect(o.snapshot.thumbnailUrl).toContain('hq.jpg');
    expect(o.fetchedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('THE AUTHORITATIVE SIGNAL: an understood 200 with the id absent is HARD_UNAVAILABLE', async () => {
    // videos.list does NOT 404 for a missing video — it returns 200 with an empty/short items
    // array. This is the only response permitted to be destructive.
    const probe = await probeVideoSnapshots(['GONE0000001', 'VID00000001'], {
      fetchImpl: async () => ok([snippetItem('VID00000001')]),
      apiKey: KEY,
      nowMs: NOW.getTime(),
    });
    expect(probe.outcomes.get('GONE0000001')!.kind).toBe('HARD_UNAVAILABLE');
    expect(probe.outcomes.get('VID00000001')!.kind).toBe('REFRESHED');
  });
});

describe('§C nothing else is ever HARD_UNAVAILABLE', () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ['429 rate limit', async () => err(429, 'rateLimitExceeded')],
    ['quota exhausted', async () => err(403, 'quotaExceeded')],
    ['daily limit', async () => err(403, 'dailyLimitExceeded')],
    ['500', async () => err(500, 'backendError')],
    ['503', async () => err(503)],
    [
      'malformed 200',
      async () => new Response('<html>not json</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ],
    [
      '200 with items missing entirely',
      async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ],
  ];

  for (const [name, f] of cases) {
    it(`P23-P26: ${name} is TRANSIENT_ERROR, never unavailable`, async () => {
      const probe = await probeVideoSnapshots(['VID00000001'], { fetchImpl: f, apiKey: KEY, nowMs: NOW.getTime() });
      const o = probe.outcomes.get('VID00000001')!;
      expect(o.kind).toBe('TRANSIENT_ERROR');
      expect(o.kind).not.toBe('HARD_UNAVAILABLE');
    });
  }

  it('a thrown fetch (timeout / DNS) is TRANSIENT_ERROR', async () => {
    const probe = await probeVideoSnapshots(['VID00000001'], {
      fetchImpl: async () => {
        throw new Error('ETIMEDOUT');
      },
      apiKey: KEY,
      nowMs: NOW.getTime(),
    });
    expect(probe.outcomes.get('VID00000001')!.kind).toBe('TRANSIENT_ERROR');
  });

  it('an ambiguous 4xx is ERROR — not a guess in either direction', async () => {
    const probe = await probeVideoSnapshots(['VID00000001'], {
      fetchImpl: async () => err(400, 'badRequest'),
      apiKey: KEY,
      nowMs: NOW.getTime(),
    });
    expect(probe.outcomes.get('VID00000001')!.kind).toBe('ERROR');
  });

  it('an unconfigured API key is ERROR about US, not evidence about the video', async () => {
    // An explicit null must NOT fall through to the ambient env key. A `??` here previously did
    // exactly that and the test issued a REAL YouTube call, which is why the assertion below is
    // paired with a fetch that would fail loudly if it were ever reached.
    const probe = await probeVideoSnapshots(['VID00000001'], {
      apiKey: null,
      nowMs: NOW.getTime(),
      fetchImpl: async () => {
        throw new Error('the unconfigured path must never reach the network');
      },
    });
    const o = probe.outcomes.get('VID00000001')!;
    expect(o.kind).toBe('ERROR');
    expect(probe.apiCallsAttempted).toBe(0);
  });

  it('a malformed 200 does NOT count as a succeeded API call', async () => {
    const probe = await probeVideoSnapshots(['VID00000001'], {
      fetchImpl: async () => new Response('nope', { status: 200 }),
      apiKey: KEY,
      nowMs: NOW.getTime(),
    });
    expect(probe.apiCallsAttempted).toBe(1);
    expect(probe.apiCallsSucceeded).toBe(0);
  });
});

// =============================================================================
// The decision
// =============================================================================
describe('decideRetention — one outcome, one action', () => {
  it('M3: a transient error NEVER produces a clearing action', () => {
    const a = decideRetention(reqRow(), { kind: 'TRANSIENT_ERROR', reason: 'network' }, NOW);
    expect(a.kind).toBe('TRANSIENT_ERROR');
    expect(a.kind).not.toBe('MARK_UNAVAILABLE');
  });

  it('P13-P17: a historical row + HARD_UNAVAILABLE marks unavailable', () => {
    expect(decideRetention(reqRow({ status: 'completed' }), { kind: 'HARD_UNAVAILABLE' }, NOW).kind).toBe(
      'MARK_UNAVAILABLE',
    );
  });

  it('M4/P29: an ACTIVE queue row INSIDE the deadline defers instead of clearing', () => {
    // EVOLVED by R6 §A: deferral is now bounded, so this row must be inside the 29-day window.
    // The historical R5 contract deferred at ANY age; that permanent exemption is retired.
    for (const status of ['waiting', 'playing']) {
      const a = decideRetention(reqRow({ status, fetchedAt: ago(25) }), { kind: 'HARD_UNAVAILABLE' }, NOW);
      expect(a.kind, `status=${status}`).toBe('DEFER_ACTIVE');
      expect(a.kind).not.toBe('MARK_UNAVAILABLE');
    }
  });

  it('terminal statuses are not active — history is clearable', () => {
    for (const status of ['completed', 'skipped', 'removed']) {
      expect(isActiveRequestStatus(status), status).toBe(false);
      expect(decideRetention(reqRow({ status }), { kind: 'HARD_UNAVAILABLE' }, NOW).kind).toBe('MARK_UNAVAILABLE');
    }
  });

  it('P28: an active row that REFRESHES successfully is safe to update', () => {
    const a = decideRetention(
      reqRow({ status: 'playing' }),
      {
        kind: 'REFRESHED',
        snapshot: { videoId: 'VID00000001', title: 'T', channelTitle: 'C', thumbnailUrl: 'u' },
        fetchedAt: NOW,
      },
      NOW,
    );
    expect(a.kind).toBe('REFRESH');
  });

  it('a saved song is never "active" — there is no live queue to break', () => {
    const a = decideRetention(
      { id: 's1', table: 'karaoke_user_saved_songs', videoId: 'VID00000001', fetchedAt: ago(25), status: 'waiting' },
      { kind: 'HARD_UNAVAILABLE' },
      NOW,
    );
    expect(a.kind).toBe('MARK_UNAVAILABLE');
  });

  it('a missing probe outcome is ERROR, never a silent pass', () => {
    expect(decideRetention(reqRow(), undefined, NOW).kind).toBe('ERROR');
  });
});

// =============================================================================
// §L / §M — dry run and the write-detection control
// =============================================================================
describe('§L dry run', () => {
  const rows: RetentionRow[] = [
    reqRow({ id: 'fresh', fetchedAt: ago(5) }),
    reqRow({ id: 'refreshable', videoId: 'VID00000001', fetchedAt: ago(40) }),
    reqRow({ id: 'gone', videoId: 'GONE0000001', fetchedAt: ago(40) }),
    reqRow({ id: 'active-gone', videoId: 'GONE0000002', fetchedAt: ago(25), status: 'playing' }),
    reqRow({ id: 'legacy', videoId: 'LEGACY00001', fetchedAt: null }),
  ];
  const fetchImpl: FetchLike = async () => ok([snippetItem('VID00000001'), snippetItem('LEGACY00001')]);

  it('P38: reports every bucket and performs ZERO writes', async () => {
    const r = await sweepRetention(rows, { dryRun: true, now: NOW, fetchImpl, apiKey: KEY });
    expect(r.dbWrites).toBe(0);
    expect(r.rowsExamined).toBe(5);
    expect(r.buckets.FRESH).toBe(1);
    expect(r.buckets.WOULD_REFRESH).toBe(2); // refreshable + legacy
    expect(r.buckets.WOULD_MARK_UNAVAILABLE).toBe(1); // gone
    expect(r.buckets.WOULD_CLEAR_API_DATA).toBe(1);
    expect(r.buckets.DEFER_ACTIVE).toBe(1); // active-gone
    expect(r.buckets.UNKNOWN_PROVENANCE).toBe(1); // legacy
    expect(r.apiCallsAttempted).toBe(1);
    expect(r.apiCallsSucceeded).toBe(1);
  });

  it('P39-P42: the classification is deterministic across repeated runs', async () => {
    const a = await sweepRetention(rows, { dryRun: true, now: NOW, fetchImpl, apiKey: KEY });
    const b = await sweepRetention(rows, { dryRun: true, now: NOW, fetchImpl, apiKey: KEY });
    expect(a.buckets).toEqual(b.buckets);
  });

  it('a FRESH row costs no API call at all', async () => {
    const r = await sweepRetention([reqRow({ fetchedAt: ago(1) })], {
      dryRun: true,
      now: NOW,
      fetchImpl,
      apiKey: KEY,
    });
    expect(r.apiCallsAttempted).toBe(0);
    expect(r.buckets.FRESH).toBe(1);
  });

  it('the report carries counts only — no titles, ids, guest names or accounts', async () => {
    const r = await sweepRetention(rows, { dryRun: true, now: NOW, fetchImpl, apiKey: KEY });
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('VID00000001');
    expect(serialized).not.toContain('GONE0000001');
    expect(serialized).not.toContain('Title ');
    expect(serialized).not.toContain(KEY);
    for (const v of Object.values(r.buckets)) expect(typeof v).toBe('number');
  });

  it('P30: DEFER_ACTIVE performs no destructive work even in a LIVE sweep', async () => {
    // The prohibiting writer proves it: a live sweep over only-deferred rows must still never
    // reach persistence.
    const r = await sweepRetention([reqRow({ videoId: 'GONE0000002', status: 'waiting', fetchedAt: ago(25) })], {
      dryRun: false,
      now: NOW,
      fetchImpl,
      apiKey: KEY,
      writer: PROHIBITED_WRITER,
    });
    expect(r.buckets.DEFER_ACTIVE).toBe(1);
    expect(r.dbWrites).toBe(0);
  });

  it('M5: a live refresh writes the NEW factual instant, never the old one', async () => {
    const seen: Array<{ fetchedAt: Date; snapshotTitle: string | null }> = [];
    const spy: RetentionWriter = {
      async applyRefresh(_t, _id, snapshot, fetchedAt) {
        seen.push({ fetchedAt, snapshotTitle: snapshot.title });
      },
      async applyUnavailable() {},
      async deleteDuration() {},
    };
    const stale = ago(40);
    await sweepRetention([reqRow({ videoId: 'VID00000001', fetchedAt: stale })], {
      dryRun: false,
      now: NOW,
      fetchImpl,
      apiKey: KEY,
      writer: spy,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].fetchedAt.toISOString()).toBe(NOW.toISOString());
    expect(seen[0].fetchedAt.getTime()).not.toBe(stale.getTime());
  });

  it('P26/H: a transient failure writes NOTHING — no fake fetched_at, no clear', async () => {
    const r = await sweepRetention([reqRow({ fetchedAt: null })], {
      dryRun: false,
      now: NOW,
      fetchImpl: async () => err(429, 'rateLimitExceeded'),
      apiKey: KEY,
      writer: PROHIBITED_WRITER, // any write at all would throw
    });
    expect(r.buckets.TRANSIENT_ERROR).toBe(1);
    expect(r.buckets.UNKNOWN_PROVENANCE).toBe(1);
    expect(r.dbWrites).toBe(0);
  });

  it('the batch bound is honoured and the sweep is safe to rerun', async () => {
    const many = Array.from({ length: 10 }, (_, i) => reqRow({ id: `r${i}` }));
    const r = await sweepRetention(many, { dryRun: true, now: NOW, fetchImpl, apiKey: KEY, limit: 3 });
    expect(r.rowsExamined).toBe(3);
  });
});

describe('§M the write-detection CONTROL — a zero-write claim is worthless without it', () => {
  /** Records writes instead of performing them, so "the harness can see a write" is measurable. */
  function countingWriter(): { writer: RetentionWriter; writes: () => number } {
    let n = 0;
    return {
      writes: () => n,
      writer: {
        async applyRefresh() {
          n++;
        },
        async applyUnavailable() {
          n++;
        },
        async deleteDuration() {
          n++;
        },
      },
    };
  }

  const gone = [reqRow({ videoId: 'GONE0000001', fetchedAt: ago(40), status: 'completed' })];
  const fetchImpl: FetchLike = async () => ok([]);

  it('CONTROL: the live path demonstrably CAN write, and the harness sees it', async () => {
    const { writer, writes } = countingWriter();
    const r = await sweepRetention(gone, { dryRun: false, now: NOW, fetchImpl, apiKey: KEY, writer });
    expect(writes()).toBe(1); // the control fires — the detector is not blind
    expect(r.dbWrites).toBe(1);
    expect(r.buckets.MARKED_UNAVAILABLE).toBe(1);
  });

  it('M7: routing a persistence attempt through dry-run is DETECTED and kills the run', async () => {
    // Deliberately hand dry-run a writer that would succeed, and force the code path that would
    // use it. If the sweeper ever calls a writer while dryRun is true, this throws.
    await expect(
      sweepRetention(gone, {
        dryRun: true,
        now: NOW,
        fetchImpl,
        apiKey: KEY,
        writer: {
          async applyRefresh() {
            throw new RetentionWriteViolation('applyRefresh');
          },
          async applyUnavailable() {
            throw new RetentionWriteViolation('applyUnavailable');
          },
          async deleteDuration() {
            throw new RetentionWriteViolation('deleteDuration');
          },
        },
      }),
    ).resolves.toMatchObject({ dbWrites: 0, buckets: expect.objectContaining({ WOULD_MARK_UNAVAILABLE: 1 }) });
  });

  it('M7: and the prohibiting writer really does throw when touched', async () => {
    // The detector itself, verified directly. Without this the dry-run guarantee would rest on a
    // writer nobody proved was armed.
    await expect(PROHIBITED_WRITER.applyUnavailable('karaoke_requests', 'x', NOW)).rejects.toBeInstanceOf(
      RetentionWriteViolation,
    );
    await expect(PROHIBITED_WRITER.applyRefresh('karaoke_requests', 'x', { videoId: 'v', title: null, channelTitle: null, thumbnailUrl: null }, NOW)).rejects.toBeInstanceOf(RetentionWriteViolation);
    await expect(PROHIBITED_WRITER.deleteDuration('v')).rejects.toBeInstanceOf(RetentionWriteViolation);
  });

  it('M7: dry-run defaults to the prohibiting writer when none is supplied', async () => {
    // The structural guarantee: dry-run never receives a live writer by default, so a future edge
    // that adds a write to a shared path fails loudly instead of persisting quietly.
    const r = await sweepRetention(gone, { dryRun: true, now: NOW, fetchImpl, apiKey: KEY });
    expect(r.dbWrites).toBe(0);
  });
});

describe('§K/§P44-45 the sweep has NO client-reachable surface', () => {
  it('no API route imports the retention engine — there is no sweep to invoke', async () => {
    const { execSync } = await import('node:child_process');
    // Structural: absence of a route is what makes "a client cannot invoke an arbitrary sweep"
    // true, and it is cheaper to keep true than any authorization check would be.
    const hits = execSync(
      "grep -rl 'youtube-retention.server' src/app 2>/dev/null || true",
      { encoding: 'utf8' },
    ).trim();
    expect(hits, `routes importing the sweep engine: ${hits}`).toBe('');
  });

  it('the engine never reads a client-supplied freshness value', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/youtube-retention.server.ts'), 'utf8');
    // The only writes of the provenance column come from a probe's own fetchedAt.
    expect(src).not.toMatch(/youtube_metadata_fetched_at:\s*(body|input|parsed|req)/);
  });
});

// =============================================================================
// R6 §A/§B/§C/§D — the bounded deferral and the absolute deadline
// =============================================================================
describe('R6 §A the hard transition ends indefinite deferral', () => {
  const active = (days: number | null, status = 'waiting') =>
    decideRetention(
      { id: 'q', table: 'karaoke_requests', videoId: 'GONE0000001', fetchedAt: days == null ? null : ago(days), status },
      { kind: 'HARD_UNAVAILABLE' },
      NOW,
    );

  it('the deadlines are 23 refresh / 29 BTY hard transition / 30 external maximum', () => {
    expect(REFRESH_MARGIN_DAYS).toBe(23);
    expect(HARD_TRANSITION_DAYS).toBe(29);
    expect(RETENTION_MAX_DAYS).toBe(30);
    // 29 is BTY's INTERNAL line, strictly inside the external maximum — a one-day safety buffer.
    expect(HARD_TRANSITION_DAYS).toBeLessThan(RETENTION_MAX_DAYS);
  });

  it('M-1: an active waiting row at day 23 + hard unavailable DEFERS', () => {
    expect(active(23).kind).toBe('DEFER_ACTIVE');
  });

  it('M-2: it keeps deferring right up to — but not including — day 29', () => {
    expect(active(24).kind).toBe('DEFER_ACTIVE');
    expect(active(28.99).kind).toBe('DEFER_ACTIVE');
  });

  it('M-3: at day 29 it transitions, even though the event is still LIVE', () => {
    expect(active(29).kind).toBe('MARK_UNAVAILABLE');
    expect(active(29).kind).not.toBe('DEFER_ACTIVE');
  });

  it('M-10: repeated deferral cannot push a row past the absolute deadline', () => {
    // The decision is a PURE function of the row's own fetch instant, so there is no accumulator
    // to reset. Ten consecutive passes over the same row across advancing clocks:
    let deferred = 0;
    for (let d = 23; d <= 33; d++) {
      const a = active(d);
      if (a.kind === 'DEFER_ACTIVE') deferred++;
      if (d >= HARD_TRANSITION_DAYS) expect(a.kind, `day ${d}`).toBe('MARK_UNAVAILABLE');
      // The load-bearing assertion: NOTHING is ever deferred at or beyond the external maximum.
      if (d >= RETENTION_MAX_DAYS) expect(a.kind, `day ${d}`).not.toBe('DEFER_ACTIVE');
    }
    expect(deferred).toBe(6); // days 23..28 only
  });

  it('M-16: persisted API Data can never survive beyond the absolute deadline via deferral', () => {
    for (const d of [30, 31, 60, 365]) expect(active(d).kind, `day ${d}`).toBe('MARK_UNAVAILABLE');
  });

  it('M-11/§D: UNKNOWN provenance gets NO fresh 29-day clock', () => {
    // A NULL snapshot may ALREADY be older than the external maximum. Granting it a window would
    // be manufacturing a clock out of ignorance.
    expect(active(null).kind).toBe('MARK_UNAVAILABLE');
    expect(deferralStillPermitted(null, NOW)).toBe(false);
  });

  it('M-13: a NULL-provenance active row does not defer forever', () => {
    for (const status of ['waiting', 'playing']) expect(active(null, status).kind).toBe('MARK_UNAVAILABLE');
  });

  it('M-12: NULL + a successful refresh establishes a REAL T0 rather than a transition', async () => {
    const spy: Array<Date> = [];
    await sweepRetention([reqRow({ fetchedAt: null, videoId: 'VID00000001', status: 'waiting' })], {
      dryRun: false,
      now: NOW,
      fetchImpl: async () => ok([snippetItem('VID00000001')]),
      apiKey: KEY,
      writer: {
        async applyRefresh(_t, _i, _s, fetchedAt) {
          spy.push(fetchedAt);
        },
        async applyUnavailable() {
          throw new Error('a refreshable row must never be marked unavailable');
        },
        async deleteDuration() {},
      },
    });
    expect(spy).toHaveLength(1);
    expect(spy[0].toISOString()).toBe(NOW.toISOString());
  });

  it('M-14/§C: a CURRENTLY PLAYING row is deferred inside the window and cleared at the deadline', () => {
    // Traced, not assumed. Clearing is safe during playback because:
    //   - the player only calls loadVideo() when the id is VALID, so a NULL simply no-ops and the
    //     already-loaded iframe keeps playing from ephemeral state;
    //   - karaoke_end_song_v2 contains ZERO references to youtube_video_id, so settlement does
    //     not re-read it;
    //   - and a HARD_UNAVAILABLE video is one YouTube itself already refuses to serve.
    expect(active(25, 'playing').kind).toBe('DEFER_ACTIVE');
    expect(active(29, 'playing').kind).toBe('MARK_UNAVAILABLE');
    expect(active(null, 'playing').kind).toBe('MARK_UNAVAILABLE');
  });

  it('a terminal row is never deferred at any age — history has no live event to protect', () => {
    for (const d of [23, 25, 29]) {
      expect(
        decideRetention(reqRow({ status: 'completed', fetchedAt: ago(d) }), { kind: 'HARD_UNAVAILABLE' }, NOW).kind,
      ).toBe('MARK_UNAVAILABLE');
    }
  });

  it('a transient failure at day 29 still clears NOTHING', () => {
    // The deadline governs deferral of an ESTABLISHED hard-unavailable verdict. It never turns an
    // uncertain answer into a destructive one.
    const a = decideRetention(reqRow({ status: 'waiting', fetchedAt: ago(29) }), { kind: 'TRANSIENT_ERROR', reason: 'network' }, NOW);
    expect(a.kind).toBe('TRANSIENT_ERROR');
  });
});
