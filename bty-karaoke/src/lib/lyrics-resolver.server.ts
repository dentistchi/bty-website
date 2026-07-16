// Server-only automatic lyrics resolver (V1.1). Provider: LRCLIB (lrclib.net) —
// a free, key-less, crowd-sourced lyrics database built for exactly this use.
// NEVER scrapes Genius/Google/YouTube/lyric sites. All calls are server-side.
//
// Flow when a song is playing: normalize the YouTube title/channel → derive a
// likely {song, artist} → look up a canonical-identity cache (KV) → on a miss,
// query LRCLIB once → score candidates → accept ONLY a high-confidence match →
// persist plainLyrics on the request row (so it rides the same display poll) and
// cache the result (positive OR negative) by canonical identity for reuse.
//
// Manual Admin lyrics (lyrics_source = 'admin') ALWAYS win: the resolver never
// touches such a row. Provider failure/timeout is swallowed — it can never affect
// the queue, playback, NOW SINGING, NEXT, or the QR.

import { karaokeDb } from './supabase.server';
import {
  normalizeSongForLyrics,
  pickBestLyricsCandidate,
  canonicalTrackKey,
  sanitizeLyrics,
  lyricsViewFor,
  LOW_CONFIDENCE,
  type LyricsCandidate,
  type LyricsView,
} from '@/domain/lyrics';

const LRCLIB_BASE = 'https://lrclib.net';
const LRCLIB_UA = 'btyNorebang-karaoke/1.1 (https://bty-karaoke.ywamer2022.workers.dev)';
// Runs in the background (ctx.waitUntil), so a generous budget is fine. The exact
// /api/get gets a small slice so a slow 404 can't starve the /api/search fallback.
const GET_TIMEOUT_MS = 4500;
const FETCH_TIMEOUT_MS = 14000;
const POSITIVE_TTL_SECONDS = 60 * 60 * 24 * 30; // verified lyrics: 30 days
const NEGATIVE_TTL_SECONDS = 60 * 60 * 6; // genuine "no match": 6h (short; retryable)
const NOMATCH_RETRY_MS = 10 * 60 * 1000; // per-row retry after a GENUINE no-match
const TRANSIENT_RETRY_MS = 45 * 1000; // per-row retry after a TRANSIENT provider failure
const LOADING_STALE_MS = 25 * 1000; // treat a 'loading' older than this as abandoned

/**
 * The stored/returned outcome for one request's lyrics. `transient` distinguishes a
 * provider timeout / 429 / 5xx / network error (retry soon, DO NOT negative-cache)
 * from a genuine provider-responded no-match (retry rarely, negative-cache briefly).
 */
export interface ResolvedLyrics {
  status: 'available' | 'unavailable';
  text: string | null;
  synced: string | null;
  source: 'lrclib' | null;
  sourceUrl: string | null;
  canonicalKey: string;
  score: number;
  /** true when unavailable due to a TRANSIENT failure (not a genuine no-match). */
  transient: boolean;
  reason?: string;
}

/** Minimal KV surface (matches the YouTube search cache binding). */
export interface LyricsKv {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** The normalized query handed to the provider fetch. */
export interface LyricsQuery {
  song: string;
  artist: string | null;
}

/** Injectable side effects so the core is unit-testable without network/KV. */
export interface ResolverDeps {
  fetchCandidates: (query: LyricsQuery, signal: AbortSignal) => Promise<LyricsCandidate[]>;
  kv: LyricsKv | null;
  /** Override the provider timeout (tests use a small value to stay fast). */
  timeoutMs?: number;
}

interface CachedHit {
  text: string;
  synced: string | null;
  sourceUrl: string | null;
}

function cacheKey(canonical: string): string {
  return `lrc:v1:${canonical}`;
}

/**
 * Parse an LRCLIB /api/search response into scoreable candidates. Exported for
 * tests. Tolerant of a non-array / malformed body (returns []).
 */
export function parseLrclibResults(body: unknown): LyricsCandidate[] {
  if (!Array.isArray(body)) return [];
  return body
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((x) => ({
      trackName: (x.trackName as string) ?? null,
      artistName: (x.artistName as string) ?? null,
      albumName: (x.albumName as string) ?? null,
      duration: (x.duration as number) ?? null,
      instrumental: (x.instrumental as boolean) ?? null,
      plainLyrics: (x.plainLyrics as string) ?? null,
      syncedLyrics: (x.syncedLyrics as string) ?? null,
    }));
}

const LRCLIB_HEADERS = { 'User-Agent': LRCLIB_UA, accept: 'application/json' } as const;

/**
 * Real LRCLIB fetch. Tries the precise, indexed /api/get (track + artist) first —
 * an exact hit needs no scoring and is the fastest path — then falls back to the
 * fuzzy /api/search. Shares the caller's AbortSignal so the hard timeout bounds
 * BOTH calls together. Throws only when it cannot get any usable response.
 */
export async function fetchLrclibCandidates(query: LyricsQuery, signal: AbortSignal): Promise<LyricsCandidate[]> {
  if (query.artist) {
    // Exact /api/get on its OWN short timeout so a slow 404 can't eat the whole
    // budget and starve the /api/search fallback (the real failure mode observed).
    const getCtl = new AbortController();
    const onAbort = () => getCtl.abort();
    signal.addEventListener('abort', onAbort);
    const getTimer = setTimeout(() => getCtl.abort(), GET_TIMEOUT_MS);
    try {
      const get = new URL(`${LRCLIB_BASE}/api/get`);
      get.searchParams.set('track_name', query.song);
      get.searchParams.set('artist_name', query.artist);
      const res = await fetch(get, { headers: LRCLIB_HEADERS, signal: getCtl.signal });
      if (res.ok) {
        const cands = parseLrclibResults([await res.json()]);
        if (cands[0]?.plainLyrics || cands[0]?.syncedLyrics) return cands;
      }
    } catch (e) {
      if (signal.aborted) throw e; // the OUTER budget expired — surface as transient
      // else the get's own short timeout fired (or a 4xx) → fall through to search
    } finally {
      clearTimeout(getTimer);
      signal.removeEventListener('abort', onAbort);
    }
  }
  const search = new URL(`${LRCLIB_BASE}/api/search`);
  search.searchParams.set('q', query.artist ? `${query.song} ${query.artist}` : query.song);
  const res = await fetch(search, { headers: LRCLIB_HEADERS, signal });
  if (!res.ok) throw new Error(`lrclib_${res.status}`);
  return parseLrclibResults(await res.json());
}

/**
 * Pure-ish resolver core: normalize → cache → provider → score. No DB writes.
 * Returns a decided ResolvedLyrics (available or unavailable + reason). Any
 * provider error surfaces as unavailable (reason 'provider-error'|'timeout') and
 * is NOT negatively cached (a transient failure must not suppress future tries).
 */
export async function resolveLyricsFor(
  inputs: { youtubeTitle?: string | null; channelTitle?: string | null; searchQuery?: string | null },
  deps: ResolverDeps,
): Promise<ResolvedLyrics> {
  const norm = normalizeSongForLyrics({
    youtubeTitle: inputs.youtubeTitle,
    channelTitle: inputs.channelTitle,
    searchQuery: inputs.searchQuery,
  });
  const canonicalKey = canonicalTrackKey(norm.song, norm.artist);

  const miss = (reason: string, transient: boolean): ResolvedLyrics => ({
    status: 'unavailable', text: null, synced: null, source: null, sourceUrl: null,
    canonicalKey, score: 0, transient, reason,
  });

  // Never search on a low-confidence normalization — a wrong query yields wrong
  // lyrics. Honest 'unavailable' instead. (Also negatively cached: the identity
  // key is meaningless here, so we skip caching and just return.)
  if (!norm.song || norm.confidence < LOW_CONFIDENCE) {
    return miss(norm.reason ? `normalize:${norm.reason}` : 'low-confidence', false);
  }

  // 1) Canonical-identity cache — reuse a verified (or verified-absent) result.
  if (deps.kv) {
    try {
      const cached = (await deps.kv.get(cacheKey(canonicalKey), 'json')) as
        | (CachedHit & { miss?: boolean })
        | null;
      if (cached?.miss) return miss('cache-negative', false);
      if (cached?.text) {
        return { status: 'available', text: cached.text, synced: cached.synced ?? null,
          source: 'lrclib', sourceUrl: cached.sourceUrl ?? LRCLIB_BASE, canonicalKey, score: 1, transient: false, reason: 'cache-hit' };
      }
    } catch {
      /* cache read failure is non-fatal — fall through to the provider */
    }
  }

  // 2) Provider lookup (get-then-search) with a single hard timeout over both.
  let candidates: LyricsCandidate[];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    candidates = await deps.fetchCandidates({ song: norm.song, artist: norm.artist }, controller.signal);
  } catch (e) {
    // Timeout / 429 / 5xx / network error → TRANSIENT. Never negative-cache; the
    // caller retries soon. Conflating this with a real no-match was the V1.1 bug.
    const reason = controller.signal.aborted ? 'timeout' : 'provider-error';
    return miss(reason, true);
  } finally {
    clearTimeout(timer);
  }

  // 3) Score — accept ONLY a high-confidence match. Reaching here means the provider
  // genuinely RESPONDED (200), so a no-match is real and may be negative-cached.
  const best = pickBestLyricsCandidate({ song: norm.song, artist: norm.artist }, candidates);
  if (!best) {
    if (deps.kv) {
      try {
        await deps.kv.put(cacheKey(canonicalKey), JSON.stringify({ miss: true }), { expirationTtl: NEGATIVE_TTL_SECONDS });
      } catch { /* non-fatal */ }
    }
    return miss('no-match', false);
  }

  const clean = sanitizeLyrics(best.candidate.plainLyrics);
  if (!clean.text) {
    // The best match had only synced/empty plain text — keep synced but if there's
    // truly no renderable text, treat as unavailable for V1.1 (plain render).
    if (!best.candidate.syncedLyrics?.trim()) return miss('empty-lyrics', false);
  }
  const result: ResolvedLyrics = {
    status: 'available',
    text: clean.text,
    synced: best.candidate.syncedLyrics ?? null,
    source: 'lrclib',
    sourceUrl: LRCLIB_BASE,
    canonicalKey,
    score: best.score,
    transient: false,
  };
  if (deps.kv && result.text) {
    try {
      await deps.kv.put(
        cacheKey(canonicalKey),
        JSON.stringify({ text: result.text, synced: result.synced, sourceUrl: result.sourceUrl }),
        { expirationTtl: POSITIVE_TTL_SECONDS },
      );
    } catch { /* non-fatal */ }
  }
  return result;
}

/** Resolve the Karaoke KV binding, or null (e.g. local dev / no binding). */
async function resolveKv(): Promise<LyricsKv | null> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const env = mod.getCloudflareContext().env as Record<string, unknown>;
    return (env?.KARAOKE_SEARCH_KV as LyricsKv) ?? null;
  } catch {
    return null;
  }
}

interface ClaimRow {
  youtube_title: string | null;
  youtube_channel_title: string | null;
  search_query: string | null;
  lyrics_source: string | null;
  lyrics_status: string | null;
  lyrics_resolved_at: string | null;
}

/**
 * Auto-resolve the currently playing request's lyrics and persist them, returning
 * the fresh Display view (or null when nothing changed / not eligible). Best-effort
 * and fully guarded: ANY failure returns null and leaves playback untouched.
 *
 * Eligibility (claim exactly once per row, then honor a retry window):
 *   - the row is still `playing`
 *   - it is NOT a manual override (lyrics_source !== 'admin')
 *   - it is not already `available`
 *   - it is not freshly `loading` (a concurrent poll owns it)
 *   - it was never auto-attempted, or the retry window has elapsed
 */
export async function resolvePlayingLyrics(
  roomId: string,
  requestId: string,
  deps?: Partial<ResolverDeps>,
): Promise<LyricsView | null> {
  try {
    const db = karaokeDb();
    const { data: row } = await db
      .from('karaoke_requests')
      .select('youtube_title, youtube_channel_title, search_query, lyrics_source, lyrics_status, lyrics_resolved_at')
      .eq('id', requestId)
      .eq('room_id', roomId)
      .eq('status', 'playing')
      .maybeSingle();
    if (!row) return null;
    const r = row as ClaimRow;

    if (r.lyrics_source === 'admin') return null; // manual override wins
    if (r.lyrics_status === 'available') return null;

    const now = Date.now();
    const resolvedAtMs = r.lyrics_resolved_at ? Date.parse(r.lyrics_resolved_at) : NaN;
    const sinceAttempt = Number.isFinite(resolvedAtMs) ? now - resolvedAtMs : Infinity;

    if (r.lyrics_status === 'loading' && sinceAttempt < LOADING_STALE_MS) {
      return { status: 'loading', text: null, source: null }; // another resolve owns it
    }
    // Retry policy — bounded, and different by failure kind (never conflated):
    //   'failed'      = TRANSIENT provider failure → retry soon (TRANSIENT_RETRY_MS)
    //   'unavailable' = GENUINE no-match           → retry rarely (NOMATCH_RETRY_MS)
    // A song only plays for a few minutes, so this never retries indefinitely.
    if (r.lyrics_status === 'failed' && sinceAttempt < TRANSIENT_RETRY_MS) return null;
    if (r.lyrics_status === 'unavailable' && r.lyrics_resolved_at != null && sinceAttempt < NOMATCH_RETRY_MS) return null;

    // Claim: mark loading + stamp the attempt. Guard on the previous resolved_at so
    // only one poll proceeds (optimistic concurrency).
    const nowIso = new Date().toISOString();
    let claim = db.from('karaoke_requests').update({ lyrics_status: 'loading', lyrics_resolved_at: nowIso })
      .eq('id', requestId).eq('room_id', roomId).eq('status', 'playing');
    claim = r.lyrics_resolved_at == null ? claim.is('lyrics_resolved_at', null) : claim.eq('lyrics_resolved_at', r.lyrics_resolved_at);
    const { data: claimed } = await claim.select('id').maybeSingle();
    if (!claimed) return { status: 'loading', text: null, source: null }; // lost the race

    const resolved = await resolveLyricsFor(
      { youtubeTitle: r.youtube_title, channelTitle: r.youtube_channel_title, searchQuery: r.search_query },
      { fetchCandidates: deps?.fetchCandidates ?? fetchLrclibCandidates, kv: deps?.kv ?? (await resolveKv()) },
    );

    // Persist over OUR claim only: guard on lyrics_status = 'loading' (the state we
    // just set). If a manual Admin override landed mid-flight, setRequestLyrics moved
    // the status to available/unavailable, so this write no-ops and the override wins.
    // (Guarding on lyrics_source != 'admin' would wrongly skip the normal NULL-source
    // row, since SQL NULL <> 'admin' is never true.)
    // A transient failure is stored as 'failed' (retry soon), a genuine no-match as
    // 'unavailable' (retry rarely) — the two must NOT be conflated.
    const storedStatus = resolved.status === 'available'
      ? 'available'
      : resolved.transient ? 'failed' : 'unavailable';
    const update = resolved.status === 'available'
      ? { lyrics_text: resolved.text, lyrics_synced: resolved.synced, lyrics_source: 'lrclib',
          lyrics_source_url: resolved.sourceUrl, lyrics_status: 'available', lyrics_updated_at: nowIso }
      : { lyrics_status: storedStatus, lyrics_updated_at: nowIso };
    await db.from('karaoke_requests').update(update)
      .eq('id', requestId).eq('room_id', roomId).eq('status', 'playing').eq('lyrics_status', 'loading');

    return lyricsViewFor({
      lyrics_text: resolved.status === 'available' ? resolved.text : null,
      lyrics_status: storedStatus,
      lyrics_source: resolved.source,
    });
  } catch {
    return null; // provider/DB failure never affects the display response
  }
}

/**
 * Fire the auto-resolve in the BACKGROUND, independent of any client. Called right
 * after a request becomes `playing` (the start / pass-turn / play routes) so lyrics
 * resolve server-side — a stale iPad Display that never sends ?lyrics=1 still gets
 * them, because the resolved lyrics ride the base display response. Uses Cloudflare's
 * ctx.waitUntil so the HTTP response returns immediately (no latency on the Admin's
 * Start button); falls back to a detached promise off the Worker runtime.
 */
export async function scheduleLyricsResolve(roomId: string, requestId: string): Promise<void> {
  const run = () => resolvePlayingLyrics(roomId, requestId).catch(() => undefined);
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = mod.getCloudflareContext().ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    if (ctx?.waitUntil) {
      ctx.waitUntil(run());
      return;
    }
  } catch {
    /* not on the Workers runtime — fall through */
  }
  void run(); // dev / no ctx: detached best-effort
}
