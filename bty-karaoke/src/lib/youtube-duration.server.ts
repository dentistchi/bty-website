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

import { karaokeDb } from './supabase.server';
import { optionalEnv } from './env.server';
import {
  parseIso8601DurationSeconds,
  trustedLeaseDurationSeconds,
  MAX_LEASE_SECONDS,
} from '@/domain/playback-lease';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

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
 * Resolve the trusted duration (seconds, 1..900) for a videoId, or a classified failure.
 * Cache hit → immediate. Miss → contentDetails lookup (one retry, never for quota), validate,
 * upsert cache.
 */
export async function resolveVideoDuration(videoId: string): Promise<DurationResolution> {
  if (!YOUTUBE_VIDEO_ID.test(videoId)) return failed('lookup_failed');
  const db = karaokeDb();

  // 1) durable cache (immutable per video → effectively permanent)
  try {
    const { data } = await db
      .from('karaoke_video_durations')
      .select('duration_seconds')
      .eq('video_id', videoId)
      .maybeSingle();
    const cached = data?.duration_seconds as number | null | undefined;
    if (cached != null) {
      const classified = classifyDurationSeconds(Number(cached));
      // The cache is only ever written from a trusted value, so a usable answer here is
      // authoritative. Anything else means the row itself is unusable — fall through to a
      // live lookup rather than failing the Host on a nonsense cache entry.
      if (classified.ok || classified.reason === 'too_long') return classified;
    }
  } catch {
    /* fall through to the lookup */
  }

  // 2) contentDetails lookup (fail closed on a missing key)
  const key = optionalEnv('YOUTUBE_API_KEY');
  if (!key) return failed('not_configured');
  return fetchDuration(videoId, key);
}

/**
 * One `videos?part=contentDetails` call with a single retry on a TRANSIENT failure.
 *
 * A classified quota exhaustion returns immediately: the quota is gone, not flaky, so a second
 * call would burn another unit against a dead budget and tell the Host nothing new.
 */
async function fetchDuration(videoId: string, key: string, attempts = 2): Promise<DurationResolution> {
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

      const classified = classifyDurationSeconds(parseIso8601DurationSeconds(items[0]?.contentDetails?.duration ?? null));
      if (classified.ok) await cacheDuration(videoId, classified.seconds);
      else logDurationFailure(classified.reason, res.status);
      return classified;
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
  try {
    await karaokeDb()
      .from('karaoke_video_durations')
      .upsert({ video_id: videoId, duration_seconds: seconds, source: 'youtube_contentDetails' }, { onConflict: 'video_id' });
  } catch {
    /* cache write is best-effort */
  }
}
