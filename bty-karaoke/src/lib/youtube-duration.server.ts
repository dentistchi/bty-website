// BUILD 20M — YouTube video-duration resolution with a durable videoId cache.
//
// The v2 lease path needs the authorized playback duration BEFORE it opens YouTube.
// This resolves it by the canonical videoId: durable cache first (karaoke_video_durations,
// immutable per video), then a `videos?part=contentDetails` lookup with a brief retry that
// upserts the cache. FAILS CLOSED — returns null when the duration cannot be trusted, and
// the caller must then block the start (no lease, no handoff). NEVER substitutes a fallback.
// Durations are validated to karaoke bounds so a malformed multi-hour value can't slip in.

import { karaokeDb } from './supabase.server';
import { optionalEnv } from './env.server';
import { parseIso8601DurationSeconds, trustedLeaseDurationSeconds } from '@/domain/playback-lease';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Resolve the trusted duration (seconds, 1..900) for a videoId, or null → fail closed.
 * Cache hit → immediate. Miss → contentDetails lookup (retry once), validate, upsert cache.
 */
export async function resolveVideoDuration(videoId: string): Promise<number | null> {
  if (!YOUTUBE_VIDEO_ID.test(videoId)) return null;
  const db = karaokeDb();

  // 1) durable cache (immutable per video → effectively permanent)
  try {
    const { data } = await db
      .from('karaoke_video_durations')
      .select('duration_seconds')
      .eq('video_id', videoId)
      .maybeSingle();
    if (data?.duration_seconds != null) return trustedLeaseDurationSeconds(data.duration_seconds as number);
  } catch {
    /* fall through to the lookup */
  }

  // 2) contentDetails lookup (fail closed on a missing key)
  const key = optionalEnv('YOUTUBE_API_KEY');
  if (!key) return null;
  const raw = await fetchDurationSeconds(videoId, key);
  const trusted = trustedLeaseDurationSeconds(raw);
  if (trusted == null) return null;

  // 3) upsert the cache (best-effort — a write failure never blocks the resolved duration)
  try {
    await db
      .from('karaoke_video_durations')
      .upsert({ video_id: videoId, duration_seconds: trusted, source: 'youtube_contentDetails' }, { onConflict: 'video_id' });
  } catch {
    /* cache write is best-effort */
  }
  return trusted;
}

/** One `videos?part=contentDetails` call with a single retry on a transient failure. */
async function fetchDurationSeconds(videoId: string, key: string, attempts = 2): Promise<number | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'contentDetails');
      url.searchParams.set('id', videoId);
      url.searchParams.set('key', key);
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        if (i + 1 < attempts) continue; // transient → one retry
        return null;
      }
      const data = (await res.json()) as { items?: Array<{ contentDetails?: { duration?: string } }> };
      const iso = data.items?.[0]?.contentDetails?.duration ?? null;
      return parseIso8601DurationSeconds(iso); // well-formed-empty → null (no pointless retry)
    } catch {
      if (i + 1 < attempts) continue;
      return null;
    }
  }
  return null;
}
