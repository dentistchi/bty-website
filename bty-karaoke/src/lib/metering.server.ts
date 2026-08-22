// Daily FREE Karaoke Minutes — B1 shadow metering seam.
//
// The SINGLE place the app calls the atomic song-lifecycle RPCs. Every NOW-SINGING
// start and every terminal transition flows through here so the request status flip and
// its usage segment are written together in ONE server transaction (see
// DRAFT_B1_karaoke_shadow_metering.sql). There are NO app-level writes to
// 'playing'/'completed'/'skipped' anywhere else. enforcement_enabled=false in B1: the
// RPCs record segments but never block a start and never surface a countdown.

import { karaokeDb } from './supabase.server';
import { resolveVideoDuration, type DurationFailureReason } from './youtube-duration.server';
import { countSwitchCandidates } from './timed-pass.server';
import type { PlaybackAuthorityWire } from '@/domain/playback-clock';

/** karaoke_begin_song outcomes (superset; callers map to their own result types). */
export type BeginOutcome =
  | 'ok'
  /** R6 §E — the request's YouTube content was determined HARD_UNAVAILABLE and cleared. */
  | 'youtube_unavailable'
  | 'invalid_mode'
  | 'ownership_state_invalid'
  | 'not_found'
  | 'not_waiting'
  | 'event_state_invalid'
  | 'already_playing'
  | 'not_next'
  | 'not_ready'
  | 'request_state_changed'
  // ── BUILD 26U-R1: THE THREE RETIRED ADMISSION OUTCOMES ─────────────────────────────────
  //
  // All three are UNREACHABLE BY CONSTRUCTION and are retained only so the shipped clients
  // that still decode them keep compiling and keep their branches type-checked. None can be
  // produced any more:
  //
  //   upgrade_required     removed from karaoke_begin_song_v2 by E1 (20260817120000). The
  //                        FREE 900-second meter no longer authorizes or refuses a start.
  //   pass_insufficient    removed by the same migration. A pass no longer inspects a video's
  //                        length, so "the whole song must fit inside the pass" cannot arise.
  //   duration_unavailable removed from `beginSong` by 26U-R1 (below). Duration resolution is
  //                        best-effort and feeds the clock only.
  //
  // A permanent test (YT-4) asserts no served path can emit them. Do not reintroduce one.
  | 'upgrade_required'
  | 'duration_unavailable'
  | 'pass_insufficient'
  | 'shadow_metering_error';

/** karaoke_end_song outcomes. */
export type EndOutcome =
  | 'ok'
  | 'already_done'
  | 'recovered'
  | 'not_found'
  | 'not_playing'
  | 'request_state_changed'
  | 'ownership_state_invalid'
  | 'invalid_action';

export interface BeginResult {
  outcome: BeginOutcome;
  entitlement?: unknown;
  // BUILD 20M-GLOBAL-CUTOVER-R1 — authoritative admission detail, passed through VERBATIM from
  // the v2 RPC (which computes all of it inside the admission transaction). Never recomputed
  // here and never present on the v1 path. All optional: absent = the RPC did not supply it.
  /** Success: the non-shrinkable lease end actually written for this start (ISO-8601). */
  leaseEndsAt?: string | null;
  /** Trusted video duration (seconds) — the same v_dur the gate compared. */
  durationSeconds?: number | null;
  /** upgrade_required: the union charge ACTUALLY compared with remainingSeconds (≤ duration). */
  requiredChargeSeconds?: number | null;
  /** Blocked: the finite remaining seconds at the moment of the decision. */
  remainingSeconds?: number | null;
  /** pass_insufficient: the canonical pass expiry the whole video had to fit inside. */
  passExpiresAt?: string | null;
  /**
   * BUILD 26M — how many passes the Host could switch to, present ONLY on `pass_insufficient`.
   *
   * ADVISORY. It selects which sentence the block shows ("pick a shorter one" when there is no
   * alternative, "use another pass" when there is) and grants nothing: the switch RPC re-validates
   * under the account lock, and this same authority still refuses any song the newly armed pass
   * cannot cover. It is read AFTER the refusal, so it can race a concurrent switch — the worst
   * case is an offered action that then fails cleanly, never an admitted song that should not be.
   */
  switchCandidateCount?: number | null;
  // BUILD 20M-R4 — FREE Final Song Grace. Present only on the v2 success path.
  /** True when this start was admitted by the once-per-window final-song grace. */
  finalSongGraceApplied?: boolean;
  /** The seconds granted beyond the remaining balance (≤ 90). Null unless grace applied. */
  finalSongGraceSeconds?: number | null;
  /** What was actually billed to the FREE entitlement (= the remaining balance). */
  finalSongChargedSeconds?: number | null;
  /** The FREE remaining at the instant of admission (becomes 0 afterwards). */
  remainingBeforeSeconds?: number | null;
  // BUILD 21 — why `duration_unavailable` happened. Additive and optional: it is present ONLY
  // on that outcome, is never computed by the RPC, and changes no admission decision. Absent
  // means "unclassified", which callers must render as the previously shipped generic copy.
  durationFailureReason?: DurationFailureReason;
}
export interface EndResult {
  outcome: EndOutcome;
  segmentClosed?: boolean;
  shadowAnomaly?: 'none' | 'segment_missing';
  entitlement?: unknown;
}

type Row = Record<string, unknown>;
const first = (data: unknown): Row => (Array.isArray(data) ? (data[0] as Row) : (data as Row)) ?? {};

/**
 * Atomically flip a WAITING request to NOW SINGING and open its usage segment.
 * mode 'guest' requires the canonical first-waiting song; 'promote' requires the
 * canonical first-READY waiting song (event-scoped). The whole thing is one DB
 * transaction — a segment conflict rolls the flip back (fail-closed).
 */
export async function beginSong(
  roomId: string,
  requestId: string,
  mode: 'guest' | 'promote',
): Promise<BeginResult> {
  // R6 §E — THE UNAVAILABLE AUTHORITY, checked before any lifecycle or metering work.
  //
  // A request whose YouTube content was determined HARD_UNAVAILABLE must not be startable merely
  // because its historical status still says 'waiting'. The historical lifecycle facts are
  // deliberately left alone — availability is a SEPARATE axis, and rewriting history to express it
  // would make an old record lie about what happened. This is the single control point: all three
  // start paths (host Start, guest self-start, promote) route through here.
  if (await requestYoutubeUnavailable(roomId, requestId)) {
    return { outcome: 'youtube_unavailable' };
  }
  // BUILD 20M — versioned cutover. When the room owner's account is enabled for v2 lease
  // WRITES (karaoke_lease_write_enabled_for; 'off' for all ordinary traffic), resolve the
  // playback duration FIRST and fail closed if it is unavailable — never "open now, meter
  // later" — then use the non-shrinkable-lease begin_v2. Otherwise the shipped v1 path is
  // untouched. begin_v2 reads the duration from the cache resolveVideoDuration just upserted.
  const account = await roomOwnerAccountId(roomId);
  if (account && (await leaseWriteEnabled(account))) {
    const videoId = await requestVideoId(roomId, requestId);
    // BUILD 26U-R1 (R1-C / R1-D) — THE DURATION REFUSAL IS RETIRED HERE.
    //
    // BUILD 26T-R1B-R6-R1A (E1) removed every duration-caused refusal from
    // `karaoke_begin_song_v2`, including the 900-second ceiling, because a video's length must
    // never decide whether it may be watched. But E1 was a migration, and THIS pre-check lives
    // above the RPC — so the other half of the same gate survived the cutover. A video over
    // 15:00, or one whose length simply could not be resolved, still could not be started, and
    // therefore still could not be opened. That is a duration-caused refusal to view a YouTube
    // video, which is precisely what E1 set out to remove.
    //
    // The resolution itself is KEPT, because the length is still worth knowing — the live song
    // clock renders from it. It is now BEST EFFORT: a miss, a quota exhaustion, an over-length
    // video or an outright failure all leave the cache without a row, the RPC reads null, and
    // the clock honestly shows an unknown duration (`playback.clock.unknown_duration`). None of
    // them stops the song, and none of them stops YouTube.
    if (videoId) {
      try {
        await resolveVideoDuration(videoId);
      } catch {
        /* the clock degrades to unknown; admission is not this call's business */
      }
    }
    return beginSongV2(roomId, requestId, mode);
  }
  const { data, error } = await karaokeDb().rpc('karaoke_begin_song', {
    p_room_id: roomId,
    p_request_id: requestId,
    p_mode: mode,
  });
  if (error) throw error;
  const row = first(data);
  return { outcome: String(row.outcome ?? 'shadow_metering_error') as BeginOutcome, entitlement: row.entitlement };
}

/** v2 begin — the non-shrinkable-lease start (duration already cached by the caller). */
async function beginSongV2(roomId: string, requestId: string, mode: 'guest' | 'promote'): Promise<BeginResult> {
  const { data, error } = await karaokeDb().rpc('karaoke_begin_song_v2', {
    p_room_id: roomId,
    p_request_id: requestId,
    p_mode: mode,
  });
  if (error) throw error;
  const row = first(data);
  const outcome = String(row.outcome ?? 'shadow_metering_error') as BeginOutcome;
  // BUILD 26M — on a pass refusal ONLY, ask how many passes the Host could switch to, so the
  // notice can offer the real remedy instead of "pick a shorter one" while usable passes sit
  // idle. Read on the refusal path only: it costs nothing on a successful start, and admission
  // has already been decided above, so this can never influence it.
  let switchCandidateCount: number | undefined;
  if (outcome === 'pass_insufficient') {
    const account = await roomOwnerAccountId(roomId);
    if (account) switchCandidateCount = await countSwitchCandidates(account);
  }
  // R1 — carry the RPC's authoritative admission detail through unchanged. `num`/`iso` only
  // narrow the type; they never substitute a value, so a field the RPC omitted stays undefined
  // (the client then falls back to its generic copy rather than showing a fabricated number).
  return {
    outcome,
    ...(switchCandidateCount === undefined ? {} : { switchCandidateCount }),
    entitlement: row.entitlement,
    leaseEndsAt: iso(row.leaseEndsAt),
    durationSeconds: num(row.durationSeconds),
    requiredChargeSeconds: num(row.requiredChargeSeconds),
    remainingSeconds: num(row.remainingSeconds),
    passExpiresAt: iso(row.passExpiresAt),
    // R4 — grace metadata, again passed through verbatim. `finalSongGraceApplied` is a real
    // boolean on every v2 success (false when grace was not used), so it is narrowed separately
    // from the nullable numbers.
    finalSongGraceApplied: row.finalSongGraceApplied === true,
    finalSongGraceSeconds: num(row.finalSongGraceSeconds),
    finalSongChargedSeconds: num(row.finalSongChargedSeconds),
    remainingBeforeSeconds: num(row.remainingBeforeSeconds),
  };
}

/** Narrow an RPC value to a finite integer, or undefined. Never coerces a missing value to 0. */
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : undefined;
}
/** Narrow an RPC value to a non-empty timestamp string, or undefined. */
function iso(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Whether this account may ISSUE new v2 leases now (karaoke_lease_write_enabled_for). */
export async function leaseWriteEnabled(accountId: string): Promise<boolean> {
  const { data, error } = await karaokeDb().rpc('karaoke_lease_write_enabled_for', { p_account_id: accountId });
  if (error) throw error;
  return data === true;
}

/**
 * Whether READS for this account must use the v2 entitlement: it is write-enabled OR it
 * already has an issued lease row. Once a lease exists, reads NEVER return to v1 accounting
 * (a rollback of lease_write_mode does not un-count issued leases).
 */
export async function shouldReadV2(accountId: string): Promise<boolean> {
  if (await leaseWriteEnabled(accountId)) return true;
  const { data, error } = await karaokeDb()
    .from('karaoke_event_usage_segments')
    .select('id')
    .eq('account_id', accountId)
    .not('lease_seconds', 'is', null)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

/** The request's canonical youtube_video_id (for duration resolution). */
async function requestVideoId(roomId: string, requestId: string): Promise<string | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('youtube_video_id')
    .eq('id', requestId)
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data?.youtube_video_id as string | null) ?? null;
}

/**
 * Atomically move a PLAYING request out of NOW SINGING and close its usage segment.
 * action derives status + close_reason in the DB ('complete'→completed, 'skip'→skipped,
 * 'pass'→skipped/passed, 'replace'→skipped/replaced). Pass-turn wires to 'complete'.
 */
export async function endSong(
  roomId: string,
  requestId: string,
  action: 'complete' | 'skip' | 'pass' | 'replace',
): Promise<EndResult> {
  // BUILD 20M — an account with any v2 lease (or write-enabled) finishes through end_v2 so
  // the returned entitlement is v2. NEITHER v1 nor v2 end touches lease_ends_at, so Finish
  // never shrinks the lease on either path — the branch only selects the entitlement model.
  const account = await roomOwnerAccountId(roomId);
  const rpc = account && (await shouldReadV2(account)) ? 'karaoke_end_song_v2' : 'karaoke_end_song';
  const { data, error } = await karaokeDb().rpc(rpc, {
    p_room_id: roomId,
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw error;
  const row = first(data);
  return {
    outcome: String(row.outcome ?? 'request_state_changed') as EndOutcome,
    segmentClosed: row.segmentClosed as boolean | undefined,
    shadowAnomaly: row.shadowAnomaly as EndResult['shadowAnomaly'],
    entitlement: row.entitlement,
  };
}

/** Canonical entitlement snapshot for an account (real-time wrapper). B2: read by the
 *  usage projection endpoint and returned on a blocked start. Never mutates. */
export async function readEntitlement(accountId: string): Promise<Record<string, unknown> | null> {
  // BUILD 20M — read v2 (SUM(lease_seconds) + legacy fallback) once the account has a lease
  // or is write-enabled; v2 counts legacy rows identically, so this is safe and never
  // reverts to v1 after a lease exists. Ordinary accounts keep the v1 read.
  if (await shouldReadV2(accountId)) {
    const { data, error } = await karaokeDb().rpc('karaoke_free_minutes_entitlement_at_v2', {
      p_account_id: accountId,
      p_as_of: new Date().toISOString(), // day-granular window → worker clock is fine
    });
    if (error) throw error;
    return (first(data) as Record<string, unknown>) ?? null;
  }
  const { data, error } = await karaokeDb().rpc('karaoke_free_minutes_entitlement', { p_account_id: accountId });
  if (error) throw error;
  return (first(data) as Record<string, unknown>) ?? null;
}

/**
 * Resolve the single active owner account for a room (or null when ownership is
 * ambiguous/absent — exactly the same rule the atomic RPCs lock on). Read-only.
 * Used by the usage projection endpoint to scope account-level entitlement from a
 * room-scoped DJ credential.
 */
export async function roomOwnerAccountId(roomId: string): Promise<string | null> {
  const { data, error } = await karaokeDb().rpc('karaoke_room_owner_account', { p_room_id: roomId });
  if (error) throw error;
  const v = Array.isArray(data) ? data[0] : data;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Canonical usage snapshot for the OWNER of a room. Convenience wrapper the room-
 * scoped usage endpoint uses: room → owner account → entitlement. Returns null when
 * the room has no unambiguous active owner.
 */
export async function readRoomEntitlement(roomId: string): Promise<Record<string, unknown> | null> {
  const accountId = await roomOwnerAccountId(roomId);
  if (!accountId) return null;
  return readEntitlement(accountId);
}

/**
 * BUILD 24 — the server-authoritative anchor a client's live playback clock projects from.
 *
 * The whole point is that these five values come from ONE server instant. Assembling them from
 * separate reads would let `serverNow` drift away from `startedAt`, which is precisely the kind
 * of seam that turns a "live" clock into a plausible-looking lie. Read-only: it starts nothing,
 * charges nothing, and opens no segment.
 *
 * `durationSeconds: null` means the duration was never trusted — clients MUST render an honest
 * unknown-duration state, never a countdown from 0.
 *
 * The shape itself lives in `domain/playback-clock`, because both the projection that consumes
 * it and the guest-safe narrowing of it are pure and unit-tested there.
 */
export type PlaybackAuthority = PlaybackAuthorityWire;

/**
 * Read the playback authority for a room. Never throws into the queue read: a hiccup degrades
 * to "no anchor" (the client then shows no clock) rather than failing the whole poll, because a
 * missing clock is recoverable on the next tick and a failed queue read is not.
 */
export async function readPlaybackAuthority(roomId: string): Promise<PlaybackAuthority> {
  const fallback: PlaybackAuthority = {
    serverNow: new Date().toISOString(),
    requestId: null,
    startedAt: null,
    durationSeconds: null,
    leaseEndsAt: null,
  };
  try {
    const { data, error } = await karaokeDb().rpc('karaoke_room_playback_authority', {
      p_room_id: roomId,
      p_as_of: fallback.serverNow,
    });
    if (error) return fallback;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row) return fallback;
    return {
      serverNow: iso(row.serverNow) ?? fallback.serverNow,
      requestId: iso(row.requestId) ?? null,
      startedAt: iso(row.startedAt) ?? null,
      durationSeconds: num(row.durationSeconds) ?? null,
      leaseEndsAt: iso(row.leaseEndsAt) ?? null,
    };
  } catch {
    return fallback;
  }
}

/** One-time browser timezone capture (atomic; eligible only while source='default' + zero usage). */
export async function captureAccountTimezone(accountId: string, timezone: string): Promise<{ outcome: string }> {
  const { data, error } = await karaokeDb().rpc('capture_karaoke_account_timezone', {
    p_account_id: accountId,
    p_timezone: timezone,
  });
  if (error) throw error;
  return { outcome: String(first(data).outcome ?? 'account_not_found') };
}


/**
 * R6 §E — has this request's YouTube content been determined HARD_UNAVAILABLE?
 *
 * Reads the EXPLICIT marker, not a NULL test: `youtube_video_id IS NULL` alone would also be true
 * for a legacy or incomplete row, and refusing to start those would be a different (and wrong)
 * rule. Fails OPEN on a read error, because a database blip must not block an otherwise legitimate
 * start — the row is still protected by every other gate.
 */
async function requestYoutubeUnavailable(roomId: string, requestId: string): Promise<boolean> {
  try {
    const { data } = await karaokeDb()
      .from('karaoke_requests')
      .select('youtube_metadata_unavailable_at')
      .eq('id', requestId)
      .eq('room_id', roomId)
      .maybeSingle();
    return (data as { youtube_metadata_unavailable_at: string | null } | null)?.youtube_metadata_unavailable_at != null;
  } catch {
    return false;
  }
}
