// BUILD 20M — YouTube video-duration resolution with a durable videoId cache.
//
// The v2 lease path needs the authorized playback duration BEFORE it opens YouTube.
// This resolves it by the canonical videoId: durable cache first (karaoke_video_durations,
// immutable per video), then a `videos?part=contentDetails` lookup with a brief retry that
// upserts the cache. FAILS CLOSED — never substitutes a fallback, and the caller must block
// the start (no lease, no handoff) whenever a trusted duration is not produced.
// Durations are validated to karaoke bounds so a malformed multi-hour value can't slip in.
//
// BUILD 21 — the failure is no longer anonymous. Every fail-closed path now reports WHY, so
// the Host is told what to actually do instead of "try again later" for a cause that will
// never resolve (a 40-minute medley, a deleted video, an exhausted daily quota). The bounds,
// the fail-closed rule, and the cache contract are unchanged — only the diagnosis is new.
//
// BUILD 22 — the cache became a RAW duration cache and policy moved AFTER retrieval.
//
// The shipped design fused two jobs: "what is this video's length" and "is that length
// admissible". Fusing them meant a 901-second answer was indistinguishable from no answer, so it
// could not be stored (the column was bounded 1..900) and every Start attempt re-bought the same
// fact from a finite daily quota. `resolveRawVideoDuration` now answers only the first question;
// `classifyDurationAdmission` answers the second. `resolveVideoDuration` is preserved EXACTLY as
// BUILD 21 shipped it — it is now a thin composition of the two, so the Host Start contract
// (fail-closed, narrow `too_long`, quota-never-retried) is unchanged by construction.

import { karaokeDb } from './supabase.server';
import { optionalEnv } from './env.server';
import {
  parseIso8601DurationSeconds,
  trustedLeaseDurationSeconds,
  MAX_LEASE_SECONDS,
} from '@/domain/playback-lease';
import { classifyDurationAdmission, type DurationAdmission } from '@/domain/duration-admission';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube `videos.list` accepts at most 50 ids per call — one quota unit regardless of count. */
export const DURATION_BATCH_MAX = 50;

/** A positively-established provider duration, or a classified reason it is unavailable. */
export type RawDurationResolution =
  | { ok: true; seconds: number }
  | { ok: false; reason: DurationFailureReason };

/**
 * Is this a duration the provider positively stated? Deliberately NOT the admission check —
 * 901 is a perfectly trustworthy length, and so is 86401.
 *
 * R1 CORRECTION: this predicate previously carried a 24-hour ceiling mirroring an earlier draft
 * of the DB constraint. That was the raw-cache defect in miniature — a value above the ceiling
 * was reported as "not a length", so it could neither be cached nor classified from cache, and
 * every resolution paid for a fresh lookup. There is now NO upper bound: any positive integer is
 * a trusted length, and `classifyDurationAdmission` alone decides whether it may be requested.
 *
 * (`duration_seconds` is a Postgres int4, so a pathological multi-century value would be rejected
 * by the column type on write. That path is harmless: the write is best-effort, the failure is
 * logged, and the verdict — too_long — is already correct without it.)
 */
function trustedRawSeconds(parsed: number | null): number | null {
  if (parsed == null || !Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed < 1 ? null : parsed;
}

/**
 * Why a duration could not be turned into a trusted lease length.
 *
 * The distinction that matters to the operator is PERMANENT vs TRANSIENT:
 *   too_long / video_unavailable → this song will never start; pick another
 *   quota_exceeded               → will recover, but not "in a moment"
 *   lookup_failed                → genuinely retryable now
 *   not_configured               → an operator/config fault, not a song fault
 */
export type DurationFailureReason =
  | 'too_long'
  | 'video_unavailable'
  | 'quota_exceeded'
  | 'lookup_failed'
  | 'not_configured';

export type DurationResolution =
  | { ok: true; seconds: number }
  | { ok: false; reason: DurationFailureReason };

const failed = (reason: DurationFailureReason): DurationResolution => ({ ok: false, reason });

/**
 * Classify an already-parsed duration.
 *
 * `too_long` is deliberately NARROW: it requires a finite value that genuinely exceeds the
 * bound. A missing, malformed, zero, or negative duration is NOT length information and must
 * never be reported to the Host as "this video is over 15 minutes" — it degrades to
 * `lookup_failed`. Success is defined by `trustedLeaseDurationSeconds` alone; this function
 * adds no acceptance range of its own and does not change the bound.
 */
function classifyDurationSeconds(parsed: number | null): DurationResolution {
  if (parsed == null || !Number.isFinite(parsed)) return failed('lookup_failed');
  if (parsed > MAX_LEASE_SECONDS) return failed('too_long');
  const trusted = trustedLeaseDurationSeconds(parsed);
  return trusted == null ? failed('lookup_failed') : { ok: true, seconds: trusted };
}

/**
 * True iff the upstream failure is quota exhaustion. Mirrors `isQuotaExhausted` in
 * youtube.server.ts:66-86 (the search path) — the SAME classification, kept in step with it.
 * Duplicated rather than imported so this module stays independent of the search module;
 * if one predicate changes, change both.
 */
function isQuotaExhausted(status: number | undefined, reason: string): boolean {
  if (status === 429) return true;
  return /ratelimitexceeded|quotaexceeded|dailylimitexceeded|resource_exhausted/i.test(reason);
}

/** Google's error classification, WITHOUT letting the raw payload past this boundary. */
async function upstreamReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { status?: string; errors?: Array<{ reason?: string }> } };
    return body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '';
  } catch {
    return ''; // non-JSON error body — the status alone still classifies 429
  }
}

/** Server-side observability, mirroring `logSearchFailure`. Logs ONLY a normalized marker,
 *  the classified reason, and the upstream status — never the API key, videoId, or body. */
function logDurationFailure(reason: DurationFailureReason, upstreamStatus?: number): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ event: 'youtube_duration_unresolved', reason, upstreamStatus: upstreamStatus ?? null }));
  } catch {
    /* logging must never throw */
  }
}

/**
 * BUILD 22 — resolve the RAW provider duration for a videoId, with NO admission policy applied.
 *
 * Cache hit → immediate, zero quota, whatever the length. Miss → contentDetails lookup (one
 * retry, never for quota), then the raw value is persisted even when it exceeds the playback
 * bound. That last part is the whole point: a too-long verdict becomes durable, so the second
 * and every later resolution of the same medley costs nothing.
 */
export async function resolveRawVideoDuration(videoId: string): Promise<RawDurationResolution> {
  if (!YOUTUBE_VIDEO_ID.test(videoId)) return failed('lookup_failed');

  // 1) durable cache (immutable per video → effectively permanent)
  try {
    const { data } = await karaokeDb()
      .from('karaoke_video_durations')
      .select('duration_seconds')
      .eq('video_id', videoId)
      .maybeSingle();
    const cached = trustedRawSeconds(Number(data?.duration_seconds));
    // A usable cached row is authoritative regardless of length. A nonsense row (0, negative,
    // absurd) is NOT treated as an answer — fall through to a live lookup rather than failing.
    if (cached != null) return { ok: true, seconds: cached };
  } catch {
    /* fall through to the lookup */
  }

  // 2) contentDetails lookup (fail closed on a missing key)
  const key = optionalEnv('YOUTUBE_API_KEY');
  if (!key) return failed('not_configured');
  return fetchDuration(videoId, key);
}

/**
 * Resolve the trusted duration (seconds, 1..900) for a videoId, or a classified failure.
 *
 * BUILD 21 CONTRACT — UNCHANGED. This is now raw resolution followed by the same narrow
 * classification, which yields identical results for every input the shipped version handled:
 * a cached or fetched 901+ becomes `too_long`, and a zero/malformed/missing value stays
 * `lookup_failed` (it never becomes a length claim). Callers on the Host Start path see no
 * behavioural difference; only the number of upstream calls went down.
 */
export async function resolveVideoDuration(videoId: string): Promise<DurationResolution> {
  const raw = await resolveRawVideoDuration(videoId);
  return raw.ok ? classifyDurationSeconds(raw.seconds) : raw;
}

/**
 * One `videos?part=contentDetails` call with a single retry on a TRANSIENT failure.
 *
 * A classified quota exhaustion returns immediately: the quota is gone, not flaky, so a second
 * call would burn another unit against a dead budget and tell the Host nothing new.
 */
async function fetchDuration(videoId: string, key: string, attempts = 2): Promise<RawDurationResolution> {
  for (let i = 0; i < attempts; i++) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'contentDetails');
      url.searchParams.set('id', videoId);
      url.searchParams.set('key', key);
      const res = await fetch(url, { headers: { accept: 'application/json' } });

      if (!res.ok) {
        const reason = await upstreamReason(res);
        if (isQuotaExhausted(res.status, reason)) {
          logDurationFailure('quota_exceeded', res.status);
          return failed('quota_exceeded'); // never retried
        }
        if (i + 1 < attempts) continue; // transient → one retry
        logDurationFailure('lookup_failed', res.status);
        return failed('lookup_failed');
      }

      const data = (await res.json()) as { items?: Array<{ contentDetails?: { duration?: string } }> };
      const items = data.items ?? [];
      // A 200 with no item means the video does not exist for us (deleted / private / bad id).
      // That is permanent and is NOT a lookup failure — retrying it would never succeed.
      if (items.length === 0) {
        logDurationFailure('video_unavailable', res.status);
        return failed('video_unavailable');
      }

      // BUILD 22: persist the RAW length, including an over-limit one. A 901 is a fact, not a
      // failure, and storing it is what stops the next resolution from buying it again.
      const raw = trustedRawSeconds(parseIso8601DurationSeconds(items[0]?.contentDetails?.duration ?? null));
      if (raw == null) {
        logDurationFailure('lookup_failed', res.status);
        return failed('lookup_failed');
      }
      await cacheDuration(videoId, raw);
      return { ok: true, seconds: raw };
    } catch {
      if (i + 1 < attempts) continue;
      logDurationFailure('lookup_failed');
      return failed('lookup_failed');
    }
  }
  return failed('lookup_failed');
}

/** Best-effort cache write — a failure never blocks the resolved duration. */
async function cacheDuration(videoId: string, seconds: number): Promise<void> {
  await cacheDurations([{ videoId, seconds }]);
}

/**
 * Best-effort BULK cache write. A failure here must NEVER downgrade an already-resolved duration
 * to unknown: the caller has the provider's answer in hand and is entitled to use it for this
 * request. The only cost of a failed write is that the next resolution pays for the lookup again.
 */
async function cacheDurations(rows: readonly { videoId: string; seconds: number }[]): Promise<void> {
  if (!rows.length) return;
  // ONE write for the whole batch on the happy path.
  if (await upsertDurations(rows)) return;

  // The batch was rejected. A multi-row upsert is a single statement, so ONE unwritable row
  // discards every other row with it — and the most likely cause is precisely an over-limit
  // duration meeting a database whose BUILD 22 constraint has not been applied yet. Retry the
  // rows individually so the admissible ones are still cached: the feature then degrades to
  // "no memoisation for over-limit videos" (exactly the pre-BUILD-22 cost) instead of silently
  // disabling the duration cache for every search result that shares a page with a long video.
  if (rows.length > 1) {
    for (const row of rows) await upsertDurations([row]);
  }
}

/** One upsert attempt. Returns false on ANY failure — thrown or returned. */
async function upsertDurations(rows: readonly { videoId: string; seconds: number }[]): Promise<boolean> {
  try {
    // supabase-js RETURNS `{ error }` for a constraint violation rather than throwing, so a bare
    // try/catch would report a rejected write as a success and hide the degradation completely.
    const { error } = await karaokeDb()
      .from('karaoke_video_durations')
      .upsert(
        rows.map((r) => ({
          video_id: r.videoId,
          duration_seconds: r.seconds,
          source: 'youtube_contentDetails',
        })),
        { onConflict: 'video_id' },
      );
    if (error) {
      logCacheWriteFailure(rows.length);
      return false;
    }
    return true;
  } catch {
    logCacheWriteFailure(rows.length);
    return false; // never rethrown: the resolved duration stands regardless
  }
}

/** Observability for a rejected cache write. Row COUNT only — never a videoId or a DB message. */
function logCacheWriteFailure(rowCount: number): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ event: 'youtube_duration_cache_write_failed', rowCount }));
  } catch {
    /* logging must never throw */
  }
}

/**
 * BUILD 22 — resolve RAW durations for many videoIds using at most ONE upstream call.
 *
 * A search page shows up to SEARCH_MAX_RESULTS videos. Resolving them one at a time would turn a
 * single 100-unit `search.list` into N additional calls and make the feature the most expensive
 * thing in the product. Instead: one bounded DB read for the whole id set, then ONE
 * `videos.list?id=a,b,c` for the misses — `videos.list` costs one unit regardless of how many ids
 * it carries — then one bulk upsert.
 *
 * Never throws and never partially fails the caller: ids it could not resolve are simply absent
 * from the returned map, which the caller renders as `unknown` (selectable). Enrichment failure
 * must not turn a successful search into an outage.
 */
export async function resolveRawVideoDurations(
  videoIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  // Canonical ids only, de-duplicated, order-independent (the caller re-associates by id).
  const ids = [...new Set(videoIds.filter((v) => YOUTUBE_VIDEO_ID.test(v)))];
  if (!ids.length) return out;

  // 1) ONE durable-cache read for every id.
  try {
    const { data } = await karaokeDb()
      .from('karaoke_video_durations')
      .select('video_id, duration_seconds')
      .in('video_id', ids);
    for (const row of (data ?? []) as Array<{ video_id: string; duration_seconds: number }>) {
      const secs = trustedRawSeconds(Number(row.duration_seconds));
      if (secs != null) out.set(row.video_id, secs);
    }
  } catch {
    /* cache read failure → everything is a miss; the batch lookup below still runs */
  }

  const misses = ids.filter((id) => !out.has(id));
  if (!misses.length) return out; // full cache hit → ZERO upstream calls

  const key = optionalEnv('YOUTUBE_API_KEY');
  if (!key) return out; // unconfigured → the misses stay unknown; search still succeeds

  // 2) ONE batched contentDetails call per chunk (chunking only matters above the API's own
  //    50-id ceiling; a search page never reaches it).
  const resolved: Array<{ videoId: string; seconds: number }> = [];
  for (let i = 0; i < misses.length; i += DURATION_BATCH_MAX) {
    const chunk = misses.slice(i, i + DURATION_BATCH_MAX);
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'contentDetails');
      url.searchParams.set('id', chunk.join(','));
      url.searchParams.set('key', key);
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        const reason = await upstreamReason(res);
        // Classified for observability only — enrichment NEVER retries and never fails the
        // search. An unresolved id is `unknown`, which stays selectable for the Guest.
        logDurationFailure(isQuotaExhausted(res.status, reason) ? 'quota_exceeded' : 'lookup_failed', res.status);
        continue;
      }
      const data = (await res.json()) as {
        items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
      };
      for (const item of data.items ?? []) {
        const id = item?.id;
        if (!id || !YOUTUBE_VIDEO_ID.test(id)) continue;
        const secs = trustedRawSeconds(parseIso8601DurationSeconds(item?.contentDetails?.duration ?? null));
        if (secs == null) continue; // no length fact → leave it unknown
        out.set(id, secs);
        resolved.push({ videoId: id, seconds: secs });
      }
      // An id absent from `items` is deleted/private — deliberately NOT recorded. BUILD 22 V1
      // blocks only a positively-established over-limit duration; availability stays the Start
      // gate's job, and a transient absence must never become a durable verdict.
    } catch {
      logDurationFailure('lookup_failed');
      /* this chunk stays unknown */
    }
  }

  await cacheDurations(resolved);
  return out;
}

/**
 * BUILD 22 — attach the duration verdict to a list of search results.
 *
 * Runs AFTER the KV search cache read (not before it): a cached result set from an older build
 * carries no durations, and enriching post-read means a KV hit still gets an accurate verdict
 * while the cached payload shape stays exactly as it was.
 *
 * Order and identity are preserved exactly — this maps over the input, re-associating by
 * videoId; it never sorts, filters, or de-duplicates. An unresolved id becomes
 * `{ durationSeconds: null, durationAdmission: 'unknown' }`, which every client keeps selectable.
 */
export async function enrichItemsWithDuration<T extends { videoId: string }>(
  items: readonly T[],
): Promise<Array<T & { durationSeconds: number | null; durationAdmission: DurationAdmission }>> {
  if (!items.length) return [];
  let durations = new Map<string, number>();
  try {
    durations = await resolveRawVideoDurations(items.map((i) => i.videoId));
  } catch {
    // Enrichment is strictly additive: a total failure yields an all-unknown, fully usable list
    // rather than converting a successful search into an error.
  }
  return items.map((item) => {
    const seconds = durations.get(item.videoId) ?? null;
    return { ...item, durationSeconds: seconds, durationAdmission: classifyDurationAdmission(seconds) };
  });
}
