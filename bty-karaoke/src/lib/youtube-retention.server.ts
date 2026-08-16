// BUILD 26T-R1B-R6-R1B-R5 — the retention decision engine.
//
// YouTube API Data may not be kept indefinitely. This decides, per stored row, whether its
// metadata is still fresh, must be refreshed from the authoritative API, or must be cleared —
// and it does so from FACTUAL provenance only.
//
// THE ONE RULE THAT SHAPES EVERYTHING: a row is cleared only on positive authority. Every
// uncertainty — a timeout, a 429, a 5xx, a parse failure, a state we cannot name — leaves the data
// exactly where it is. Deleting a customer's history because the network hiccuped is a far worse
// outcome than holding stale metadata for one more sweep, and the sweep runs again tomorrow.

import { karaokeDb } from './supabase.server';
import { optionalEnv } from './env.server';

// ---------------------------------------------------------------------------
// §A — the freshness window
// ---------------------------------------------------------------------------

/** The maximum a YouTube API Data snapshot may be retained. */
export const RETENTION_MAX_DAYS = 30;
/** Refresh starts here, leaving 7 days of margin for transient failures and retries. */
export const REFRESH_MARGIN_DAYS = 23;
/**
 * BTY's INTERNAL hard-transition deadline (R6 §A). At this age a HARD_UNAVAILABLE row stops being
 * deferrable, even while its event is still live. This is BTY's own safety line, one day inside
 * the external maximum — it is NOT a claim that YouTube publishes a 29-day rule.
 */
export const HARD_TRANSITION_DAYS = 29;

const DAY_MS = 86_400_000;

export type FreshnessClass = 'FRESH' | 'REFRESH_CANDIDATE' | 'UNKNOWN_PROVENANCE';

/**
 * Classify one row from its FACTUAL provenance instant.
 *
 * `null` is UNKNOWN_PROVENANCE and is never FRESH. It means the snapshot predates provenance, or
 * arrived from a client that could not prove when it was fetched — in both cases we do not know
 * the age, and "we don't know" must never be spent as "it's fine".
 *
 * `created_at` / `updated_at` / request time / save time are deliberately NOT accepted here. They
 * record when BTY touched the row, not when YouTube was asked, and substituting one for the other
 * would silently renew a stale snapshot every time a row was written.
 */
export function classifyFreshness(fetchedAt: Date | null | undefined, now: Date): FreshnessClass {
  if (fetchedAt == null) return 'UNKNOWN_PROVENANCE';
  const ageDays = (now.getTime() - fetchedAt.getTime()) / DAY_MS;
  return ageDays >= REFRESH_MARGIN_DAYS ? 'REFRESH_CANDIDATE' : 'FRESH';
}

/** True only for a snapshot that has already outlived the retention maximum. */
export function isOverRetentionMax(fetchedAt: Date | null | undefined, now: Date): boolean {
  if (fetchedAt == null) return false; // unknown age is not a measured breach
  return (now.getTime() - fetchedAt.getTime()) / DAY_MS >= RETENTION_MAX_DAYS;
}

// ---------------------------------------------------------------------------
// §B/§C — the measured API contract, and the taxonomy it supports
// ---------------------------------------------------------------------------

/**
 * MEASURED, not assumed. The refresh endpoint is the same one BUILD 21/22 already use for
 * duration: `GET https://www.googleapis.com/youtube/v3/videos`.
 *
 *   part=snippet         → title, channelTitle, thumbnails   (metadata refresh)
 *   part=contentDetails  → duration                          (the existing duration path)
 *   id=a,b,c             → up to 50 ids, ONE quota unit regardless of count
 *
 * THE AUTHORITATIVE ABSENCE SIGNAL. `videos.list` does NOT 404 for a missing video. It returns
 * HTTP 200 with that id simply ABSENT from `items` — which is exactly how
 * `youtube-duration.server.ts` has always detected `video_unavailable`. So HARD_UNAVAILABLE is
 * defined as: a 200 response, successfully parsed, in which the requested id is absent. Inventing
 * "404 means deleted" would have been wrong for this API.
 *
 * WHAT THIS CANNOT DISTINGUISH. Deleted, private, and some region restrictions all present as the
 * same absence. The API gives no field separating them here, so no such claim is made or stored —
 * the ratified contract only requires "cannot currently be represented as a usable YouTube item",
 * which the absence does support.
 */
export const YOUTUBE_VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
/** `videos.list` accepts at most 50 ids per call, at one quota unit per call. */
export const REFRESH_BATCH_MAX = 50;

export type RefreshClass =
  | 'REFRESHED'
  | 'HARD_UNAVAILABLE'
  | 'TRANSIENT_ERROR'
  | 'DEFER_ACTIVE'
  | 'ERROR';

export interface RefreshedSnapshot {
  videoId: string;
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
}

export type RefreshOutcome =
  | { kind: 'REFRESHED'; snapshot: RefreshedSnapshot; fetchedAt: Date }
  | { kind: 'HARD_UNAVAILABLE' }
  | { kind: 'TRANSIENT_ERROR'; reason: string }
  | { kind: 'ERROR'; reason: string };

/** A batch probe result keyed by video id, plus the batch-level failure if there was one. */
export interface BatchProbe {
  outcomes: Map<string, RefreshOutcome>;
  apiCallsAttempted: number;
  apiCallsSucceeded: number;
}

function transient(reason: string): RefreshOutcome {
  return { kind: 'TRANSIENT_ERROR', reason };
}

/**
 * Quota exhaustion and rate limiting are TRANSIENT, never HARD_UNAVAILABLE. The same
 * classification `youtube-duration.server.ts` already uses, so both paths agree about what a
 * spent quota means.
 */
function isTransientStatus(status: number, reason: string): boolean {
  if (status === 429 || status >= 500) return true;
  return /ratelimitexceeded|quotaexceeded|dailylimitexceeded|resource_exhausted|backenderror|internalerror/i.test(
    reason,
  );
}

async function upstreamReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { status?: string; errors?: Array<{ reason?: string }> } };
    return body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '';
  } catch {
    return '';
  }
}

/** Injected so tests drive the taxonomy against real response shapes without real network calls. */
export type FetchLike = (url: string) => Promise<Response>;

/**
 * ONE batched `videos?part=snippet` probe. Every id in `videoIds` gets exactly one outcome.
 *
 * `nowMs` is the caller's clock reading for the instant the response was received — the factual
 * fetch time that becomes the new provenance. It is not read from the response, because the API
 * does not report one.
 */
export async function probeVideoSnapshots(
  videoIds: readonly string[],
  opts: { fetchImpl?: FetchLike; apiKey?: string | null; nowMs: number },
): Promise<BatchProbe> {
  const outcomes = new Map<string, RefreshOutcome>();
  const ids = [...new Set(videoIds)];
  if (!ids.length) return { outcomes, apiCallsAttempted: 0, apiCallsSucceeded: 0 };

  // `?? ` would be wrong here: an EXPLICIT null means "unconfigured" and must not fall through to
  // the ambient env key — that is how a test meant to exercise the unconfigured path made a real
  // network call instead. Only an ABSENT field consults the environment.
  const key = (opts.apiKey !== undefined ? opts.apiKey : optionalEnv('YOUTUBE_API_KEY')) ?? null;
  if (!key) {
    // Unconfigured is an operator problem, not evidence about any video.
    for (const id of ids) outcomes.set(id, { kind: 'ERROR', reason: 'not_configured' });
    return { outcomes, apiCallsAttempted: 0, apiCallsSucceeded: 0 };
  }
  const doFetch: FetchLike = opts.fetchImpl ?? ((u) => fetch(u, { headers: { accept: 'application/json' } }));

  let attempted = 0;
  let succeeded = 0;

  for (let i = 0; i < ids.length; i += REFRESH_BATCH_MAX) {
    const chunk = ids.slice(i, i + REFRESH_BATCH_MAX);
    const url = new URL(YOUTUBE_VIDEOS_ENDPOINT);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', key);

    attempted++;
    let res: Response;
    try {
      res = await doFetch(url.toString());
    } catch {
      // Network / DNS / timeout — says nothing about the videos.
      for (const id of chunk) outcomes.set(id, transient('network'));
      continue;
    }

    if (!res.ok) {
      const reason = await upstreamReason(res);
      const cls: RefreshOutcome = isTransientStatus(res.status, reason)
        ? transient(reason || `http_${res.status}`)
        : { kind: 'ERROR', reason: reason || `http_${res.status}` };
      // A non-2xx NEVER classifies a video as unavailable, whatever the status.
      for (const id of chunk) outcomes.set(id, cls);
      continue;
    }

    let data: { items?: Array<{ id?: string; snippet?: Record<string, unknown> }> };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      // A 200 we cannot parse is NOT an absence. Absence is only meaningful in a response we
      // actually understood.
      for (const id of chunk) outcomes.set(id, transient('malformed_response'));
      continue;
    }
    if (!Array.isArray(data.items)) {
      for (const id of chunk) outcomes.set(id, transient('malformed_response'));
      continue;
    }

    succeeded++;
    const present = new Set<string>();
    for (const item of data.items) {
      const id = typeof item?.id === 'string' ? item.id : null;
      if (!id || !chunk.includes(id)) continue;
      const sn = item.snippet ?? {};
      const thumbs = (sn.thumbnails ?? {}) as Record<string, { url?: unknown }>;
      const thumbnailUrl =
        typeof thumbs.high?.url === 'string'
          ? thumbs.high.url
          : typeof thumbs.medium?.url === 'string'
            ? thumbs.medium.url
            : typeof thumbs.default?.url === 'string'
              ? thumbs.default.url
              : null;
      present.add(id);
      outcomes.set(id, {
        kind: 'REFRESHED',
        snapshot: {
          videoId: id,
          title: typeof sn.title === 'string' ? sn.title : null,
          channelTitle: typeof sn.channelTitle === 'string' ? sn.channelTitle : null,
          thumbnailUrl,
        },
        fetchedAt: new Date(opts.nowMs),
      });
    }
    // THE AUTHORITATIVE SIGNAL: understood 200, id absent from items.
    for (const id of chunk) if (!present.has(id)) outcomes.set(id, { kind: 'HARD_UNAVAILABLE' });
  }

  return { outcomes, apiCallsAttempted: attempted, apiCallsSucceeded: succeeded };
}

// ---------------------------------------------------------------------------
// §G — active dependency
// ---------------------------------------------------------------------------

/**
 * A request is materially referenced by a LIVE queue when it has not reached a terminal state.
 * `waiting` and `playing` are the two statuses the DJ console and the guest queue operate on;
 * `completed`, `skipped` and `removed` are history.
 */
export const ACTIVE_REQUEST_STATUSES = ['waiting', 'playing'] as const;
export function isActiveRequestStatus(status: string | null | undefined): boolean {
  return (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(String(status));
}

// ---------------------------------------------------------------------------
// §L/§M — the write port. Dry-run cannot reach persistence, structurally.
// ---------------------------------------------------------------------------

export class RetentionWriteViolation extends Error {
  constructor(op: string) {
    super(`dry-run attempted a persistence write: ${op}`);
    this.name = 'RetentionWriteViolation';
  }
}

/**
 * Every persistence effect the sweeper can have, behind one interface.
 *
 * This is what makes dry-run structurally incapable of writing rather than merely careful: the
 * dry-run sweep is handed a writer that THROWS on contact, so a future edit that adds a write to a
 * shared code path fails the harness instead of quietly persisting. A boolean flag checked at each
 * call site would only be as good as the next person's memory.
 */
export interface RetentionWriter {
  applyRefresh(table: RetentionTable, rowId: string, snapshot: RefreshedSnapshot, fetchedAt: Date): Promise<void>;
  applyUnavailable(table: RetentionTable, rowId: string, at: Date): Promise<void>;
  deleteDuration(videoId: string): Promise<void>;
}

export type RetentionTable = 'karaoke_requests' | 'karaoke_user_saved_songs';

/** The dry-run writer. Reaching any method at all is a defect, so every method reports one. */
export const PROHIBITED_WRITER: RetentionWriter = {
  async applyRefresh() {
    throw new RetentionWriteViolation('applyRefresh');
  },
  async applyUnavailable() {
    throw new RetentionWriteViolation('applyUnavailable');
  },
  async deleteDuration() {
    throw new RetentionWriteViolation('deleteDuration');
  },
};

/** The live writer. Service-role only — `karaokeDb()` is the server-side client. */
export function liveWriter(): RetentionWriter {
  return {
    async applyRefresh(table, rowId, snapshot, fetchedAt) {
      const patch =
        table === 'karaoke_requests'
          ? {
              youtube_video_id: snapshot.videoId,
              youtube_title: snapshot.title,
              youtube_channel_title: snapshot.channelTitle,
              youtube_thumbnail_url: snapshot.thumbnailUrl,
              youtube_metadata_fetched_at: fetchedAt.toISOString(),
              // A successful refresh RETRACTS any earlier unavailable determination — the DB
              // coherence CHECK would reject the row otherwise, which is the point.
              youtube_metadata_unavailable_at: null,
            }
          : {
              video_id: snapshot.videoId,
              title_snapshot: snapshot.title,
              artist_snapshot: snapshot.channelTitle,
              thumbnail_url_snapshot: snapshot.thumbnailUrl,
              youtube_metadata_fetched_at: fetchedAt.toISOString(),
              youtube_metadata_unavailable_at: null,
            };
      const { error } = await karaokeDb().from(table).update(patch).eq('id', rowId);
      if (error) throw new Error(`refresh write failed: ${error.message}`);
    },

    async applyUnavailable(table, rowId, at) {
      // Clears the API Data and records the determination. BTY-independent facts — the row UUID,
      // account/event provenance, guest identity, status, timestamps, resolution and lifecycle
      // columns — are untouched because they are not in this patch.
      const patch =
        table === 'karaoke_requests'
          ? {
              youtube_video_id: null,
              youtube_title: null,
              youtube_channel_title: null,
              youtube_thumbnail_url: null,
              youtube_metadata_fetched_at: null,
              youtube_metadata_unavailable_at: at.toISOString(),
            }
          : {
              video_id: null,
              title_snapshot: null,
              artist_snapshot: null,
              thumbnail_url_snapshot: null,
              youtube_metadata_fetched_at: null,
              youtube_metadata_unavailable_at: at.toISOString(),
            };
      const { error } = await karaokeDb().from(table).update(patch).eq('id', rowId);
      if (error) throw new Error(`unavailable write failed: ${error.message}`);
    },

    async deleteDuration(videoId) {
      const { error } = await karaokeDb().from('karaoke_video_durations').delete().eq('video_id', videoId);
      if (error) throw new Error(`duration delete failed: ${error.message}`);
    },
  };
}

// ---------------------------------------------------------------------------
// The decision, as a pure function of the facts
// ---------------------------------------------------------------------------

export interface RetentionRow {
  id: string;
  table: RetentionTable;
  videoId: string | null;
  fetchedAt: Date | null;
  /** Requests only. Saved songs are never part of a live queue. */
  status?: string | null;
}

export type RetentionAction =
  | { kind: 'NONE'; freshness: 'FRESH' }
  | { kind: 'REFRESH'; snapshot: RefreshedSnapshot; fetchedAt: Date }
  | { kind: 'MARK_UNAVAILABLE' }
  | { kind: 'DEFER_ACTIVE' }
  | { kind: 'TRANSIENT_ERROR'; reason: string }
  | { kind: 'ERROR'; reason: string };

/**
 * May an ACTIVE row still be deferred?
 *
 * UNKNOWN provenance (NULL) gets NO grace at all (§D). We do not know when that snapshot was
 * fetched, so it may ALREADY be past the external maximum — granting it a fresh 29-day window
 * would be manufacturing a clock out of ignorance, which is exactly the move the whole provenance
 * chain exists to prevent.
 */
export function deferralStillPermitted(fetchedAt: Date | null | undefined, now: Date): boolean {
  if (fetchedAt == null) return false;
  const ageDays = (now.getTime() - fetchedAt.getTime()) / DAY_MS;
  return ageDays < HARD_TRANSITION_DAYS;
}

/**
 * Turn one row plus its probe outcome into exactly one action. No I/O, so the whole taxonomy is
 * testable without a network or a database.
 *
 * DEFER_ACTIVE exists for one case only: the row is still in a live queue AND the video is gone.
 * Clearing it there would break the event in progress in front of real people, so the pass makes
 * no destructive change and reports the row for a bounded recheck. A successful refresh on an
 * active row is safe and proceeds normally — the metadata simply becomes current.
 */
export function decideRetention(
  row: RetentionRow,
  outcome: RefreshOutcome | undefined,
  now: Date,
): RetentionAction {
  if (!outcome) return { kind: 'ERROR', reason: 'no_probe_outcome' };

  switch (outcome.kind) {
    case 'REFRESHED':
      // Safe whether or not the row is active: the queue keeps a playable, now-current item.
      return { kind: 'REFRESH', snapshot: outcome.snapshot, fetchedAt: outcome.fetchedAt };

    case 'HARD_UNAVAILABLE':
      if (row.table === 'karaoke_requests' && isActiveRequestStatus(row.status)) {
        // R6 §A/§B — DEFER_ACTIVE is TEMPORARY operational protection, never an exemption. It is
        // available only while the row is still inside BTY's internal hard-transition deadline.
        //
        // Because the decision is a pure function of the row's own fetch instant, repeatedly
        // deferring cannot extend it: every pass recomputes the same age from the same T0, so
        // there is no accumulator a caller could keep resetting (§M-10).
        if (deferralStillPermitted(row.fetchedAt, now)) return { kind: 'DEFER_ACTIVE' };
        return { kind: 'MARK_UNAVAILABLE' };
      }
      return { kind: 'MARK_UNAVAILABLE' };

    case 'TRANSIENT_ERROR':
      // Data stays exactly as it is, and provenance stays exactly as it was — including NULL.
      return { kind: 'TRANSIENT_ERROR', reason: outcome.reason };

    case 'ERROR':
      return { kind: 'ERROR', reason: outcome.reason };
  }
}

// ---------------------------------------------------------------------------
// §K/§L — the sweeper
// ---------------------------------------------------------------------------

export interface SweepReport {
  dryRun: boolean;
  rowsExamined: number;
  apiCallsAttempted: number;
  apiCallsSucceeded: number;
  dbWrites: number;
  /** Counts only. No titles, no guest names, no video ids, no account ids. */
  buckets: Record<
    | 'REFRESHED'
    | 'WOULD_REFRESH'
    | 'MARKED_UNAVAILABLE'
    | 'WOULD_MARK_UNAVAILABLE'
    | 'WOULD_CLEAR_API_DATA'
    | 'DEFER_ACTIVE'
    | 'TRANSIENT_ERROR'
    | 'UNKNOWN_PROVENANCE'
    | 'FRESH'
    | 'ERROR',
    number
  >;
}

function emptyBuckets(): SweepReport['buckets'] {
  return {
    REFRESHED: 0,
    WOULD_REFRESH: 0,
    MARKED_UNAVAILABLE: 0,
    WOULD_MARK_UNAVAILABLE: 0,
    WOULD_CLEAR_API_DATA: 0,
    DEFER_ACTIVE: 0,
    TRANSIENT_ERROR: 0,
    UNKNOWN_PROVENANCE: 0,
    FRESH: 0,
    ERROR: 0,
  };
}

export interface SweepOptions {
  dryRun: boolean;
  now: Date;
  /** Bounded batch. The sweep is safe to rerun, so a small bound is a feature. */
  limit?: number;
  fetchImpl?: FetchLike;
  apiKey?: string | null;
  /** Injected for tests; defaults to the service-role writer (or the prohibiting one in dry-run). */
  writer?: RetentionWriter;
}

/**
 * Sweep one bounded, deterministically ordered batch.
 *
 * Idempotent and safe to rerun: a refreshed row moves out of the selection window, a row marked
 * unavailable is excluded by the partial index, and a transient failure simply reappears next time.
 */
export async function sweepRetention(rows: readonly RetentionRow[], opts: SweepOptions): Promise<SweepReport> {
  const buckets = emptyBuckets();
  const report: SweepReport = {
    dryRun: opts.dryRun,
    rowsExamined: 0,
    apiCallsAttempted: 0,
    apiCallsSucceeded: 0,
    dbWrites: 0,
    buckets,
  };

  // In dry-run the writer is the prohibiting one unless a test explicitly supplies another to
  // PROVE the harness detects a write (§M).
  const writer = opts.writer ?? (opts.dryRun ? PROHIBITED_WRITER : liveWriter());

  const limit = opts.limit ?? 200;
  const batch = rows.slice(0, limit);
  report.rowsExamined = batch.length;

  // FRESH rows need no API call at all — that is the whole point of the margin.
  const due: RetentionRow[] = [];
  for (const row of batch) {
    const fresh = classifyFreshness(row.fetchedAt, opts.now);
    if (fresh === 'FRESH') {
      buckets.FRESH++;
      continue;
    }
    if (fresh === 'UNKNOWN_PROVENANCE') buckets.UNKNOWN_PROVENANCE++;
    due.push(row);
  }

  const probe = await probeVideoSnapshots(
    due.map((r) => r.videoId).filter((v): v is string => !!v),
    { fetchImpl: opts.fetchImpl, apiKey: opts.apiKey, nowMs: opts.now.getTime() },
  );
  report.apiCallsAttempted = probe.apiCallsAttempted;
  report.apiCallsSucceeded = probe.apiCallsSucceeded;

  for (const row of due) {
    const action = decideRetention(
      row,
      row.videoId ? probe.outcomes.get(row.videoId) : { kind: 'ERROR', reason: 'no_video_id' },
      opts.now,
    );
    switch (action.kind) {
      case 'REFRESH':
        if (opts.dryRun) {
          buckets.WOULD_REFRESH++;
        } else {
          await writer.applyRefresh(row.table, row.id, action.snapshot, action.fetchedAt);
          report.dbWrites++;
          buckets.REFRESHED++;
        }
        break;
      case 'MARK_UNAVAILABLE':
        if (opts.dryRun) {
          buckets.WOULD_MARK_UNAVAILABLE++;
          // The same row is also what WOULD be cleared — one transition, reported on both axes
          // because §L asks for both and they are not independent.
          buckets.WOULD_CLEAR_API_DATA++;
        } else {
          await writer.applyUnavailable(row.table, row.id, opts.now);
          report.dbWrites++;
          buckets.MARKED_UNAVAILABLE++;
        }
        break;
      case 'DEFER_ACTIVE':
        // ZERO destructive change, in dry-run and live alike.
        buckets.DEFER_ACTIVE++;
        break;
      case 'TRANSIENT_ERROR':
        buckets.TRANSIENT_ERROR++;
        break;
      case 'ERROR':
        buckets.ERROR++;
        break;
      case 'NONE':
        buckets.FRESH++;
        break;
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// §K — the maintenance entry point
// ---------------------------------------------------------------------------
//
// NO NEW SCHEDULER. The project has no cron/worker scheduling machinery, and §K forbids inventing
// a second one. So this is an operator-invoked server function with NO HTTP surface at all: there
// is no route, so there is no client-accessible sweep to secure. The only reachable path runs
// under the service-role key, which never leaves the server.

/**
 * Read one bounded, deterministically ordered batch of due rows from the shared selection views.
 *
 * The predicate lives in `karaoke_retention_due_*` (see the R5 migration), NOT here — one
 * definition, so the SQL validation matrix and this sweeper cannot drift apart.
 */
export async function selectDueRows(limit = 200): Promise<RetentionRow[]> {
  const db = karaokeDb();
  const out: RetentionRow[] = [];

  const { data: reqs, error: reqErr } = await db
    .from('karaoke_retention_due_requests')
    .select('id, youtube_video_id, youtube_metadata_fetched_at, status')
    // UNKNOWN provenance first: an age we cannot bound is remediated before one we can measure.
    .order('youtube_metadata_fetched_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (reqErr) throw new Error(`retention selection failed: ${reqErr.message}`);
  for (const r of (reqs ?? []) as Array<Record<string, unknown>>) {
    out.push({
      id: String(r.id),
      table: 'karaoke_requests',
      videoId: (r.youtube_video_id as string) ?? null,
      fetchedAt: r.youtube_metadata_fetched_at ? new Date(String(r.youtube_metadata_fetched_at)) : null,
      status: (r.status as string) ?? null,
    });
  }

  const { data: saved, error: savedErr } = await db
    .from('karaoke_retention_due_saved_songs')
    .select('id, video_id, youtube_metadata_fetched_at')
    .order('youtube_metadata_fetched_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (savedErr) throw new Error(`retention selection failed: ${savedErr.message}`);
  for (const s of (saved ?? []) as Array<Record<string, unknown>>) {
    out.push({
      id: String(s.id),
      table: 'karaoke_user_saved_songs',
      videoId: (s.video_id as string) ?? null,
      fetchedAt: s.youtube_metadata_fetched_at ? new Date(String(s.youtube_metadata_fetched_at)) : null,
    });
  }

  return out.slice(0, limit);
}

/** Operator entry: select, then sweep. Dry-run is the default — live requires an explicit false. */
export async function runRetentionSweep(opts: { dryRun?: boolean; limit?: number; now?: Date } = {}) {
  const dryRun = opts.dryRun !== false;
  const rows = await selectDueRows(opts.limit ?? 200);
  return sweepRetention(rows, { dryRun, now: opts.now ?? new Date(), limit: opts.limit });
}
