// BUILD 24 — LIVE PLAYBACK CLOCK V1. Presentation-only time projection (pure).
//
// WHAT THE FORENSICS FOUND, because it decides this file's whole shape:
//
//   1. There was NO current-song clock anywhere. `karaoke_requests.started_at` reached both
//      clients in the queue payload and was read by nobody. The "2:42" that looked frozen was
//      a STATIC song-length badge (DurationAdmission.label) doing exactly its job.
//
//   2. The FREE balance genuinely does not move during a song, and that is CORRECT. BUILD 20M
//      charges the whole union extension UP FRONT inside the admission transaction
//      (karaoke_begin_song_v2 writes lease_seconds; the entitlement sums it). Nothing accrues
//      while the song plays. So ticking the FREE number down per second would be a client-side
//      lie AND a double-count against a balance that was already debited.
//
// Hence the split this module implements. Two things genuinely elapse and are projected here;
// one thing genuinely does not and is deliberately NOT projected:
//
//   projectSongClock   ticks — how far into THIS song we are.
//   projectLeaseWindow ticks — how much longer external playback stays AUTHORIZED.
//   FREE balance       does NOT tick. See freeRemainingForDisplay() for why, in code.
//
// AUTHORITY: the server owns every number. A client only interpolates between polls, and only
// forward from a server-stamped anchor. Nothing here decides admission, consumes balance,
// persists anything, or is ever sent back to the server.
//
// CLOCK MODEL (§6.4): an anchor pairs a SERVER instant with the MONOTONIC reading taken when
// that response landed. Elapsed = (server offset at receipt) + (monotonic time since receipt).
// The device wall clock is never consulted, so changing the phone's clock cannot corrupt any
// displayed value. Every poll re-anchors, so drift is bounded by one poll interval.

/** Milliseconds. Named for clarity at call sites, where three kinds of time meet. */
type Ms = number;

/**
 * The wire shape of the server-stamped anchor (`karaoke_room_playback_authority`). All five
 * values come from ONE server instant — assembling them from separately-timed reads is what
 * turns a "live" clock into a plausible-looking lie.
 */
export interface PlaybackAuthorityWire {
  serverNow: string;
  requestId: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  /** Account-level external-playback lease end. PRIVATE — see toGuestPlaybackAuthority. */
  leaseEndsAt: string | null;
}

/**
 * What a PUBLIC guest reader may see. `leaseEndsAt` is account-level METERING state: it reveals
 * how much external playback the Host has paid for, which is nobody else's business and is the
 * kind of field that turned the BUILD 18B replay into an ownership oracle. A guest needs only
 * enough to render the same song clock as the Host.
 */
export type GuestPlaybackAuthority = Omit<PlaybackAuthorityWire, 'leaseEndsAt'>;

/**
 * Project the authority down to its guest-safe subset. Written as an explicit allowlist (not a
 * `delete`, not a spread-minus) so adding a private field to PlaybackAuthorityWire can never
 * silently widen what guests receive — a new field is simply absent until someone adds it here.
 */
export function toGuestPlaybackAuthority(a: PlaybackAuthorityWire): GuestPlaybackAuthority {
  return {
    serverNow: a.serverNow,
    requestId: a.requestId,
    startedAt: a.startedAt,
    durationSeconds: a.durationSeconds,
  };
}

/**
 * The server-stamped facts a projection needs, plus the monotonic reading taken at the moment
 * the response was received. Built by `makeAnchor` from a canonical poll response.
 */
export interface PlaybackAnchor {
  /** The canonical request on stage when the server answered. A change means a NEW song. */
  requestId: string;
  /** The server's own clock at the instant it answered. */
  serverNowMs: Ms;
  /** When the server flipped this request to `playing` (karaoke_requests.started_at). */
  startedAtMs: Ms;
  /** Trusted duration for this video, or null when it could not be resolved. */
  durationSeconds: number | null;
  /** Account-level external-playback lease end, or null when no lease is open. */
  leaseEndsAtMs: Ms | null;
  /** Monotonic reading (performance.now / uptimeNanoseconds) captured on receipt. */
  monotonicAtReceiptMs: Ms;
}

export interface AnchorInput {
  requestId: string | null | undefined;
  serverNow: string | null | undefined;
  startedAt: string | null | undefined;
  durationSeconds: number | null | undefined;
  leaseEndsAt?: string | null | undefined;
  monotonicNowMs: Ms;
}

export type SongClock =
  /** Nothing on stage — the countdown must be REMOVED, not frozen at its last value. */
  | { state: 'idle' }
  /**
   * On stage, but the duration could never be trusted. An honest unknown: elapsed is real and
   * still ticks, remaining is genuinely unknowable, and NO false countdown is invented.
   */
  | { state: 'unknown_duration'; requestId: string; elapsedSeconds: number }
  | {
      state: 'playing';
      requestId: string;
      /** Clamped to [0, durationSeconds]. Never negative. */
      elapsedSeconds: number;
      /** Clamped to [0, durationSeconds]. Never negative. */
      remainingSeconds: number;
      durationSeconds: number;
      /**
       * The song's own length has been exceeded while the server still reports it on stage
       * (the Host has not pressed Finish). The clock is pinned at 0:00 rather than running
       * negative, and the UI says so instead of pretending a countdown is still running.
       */
      overrun: boolean;
    };

export type LeaseWindow =
  | { state: 'none' }
  | { state: 'open'; remainingSeconds: number }
  /** The authorized window has elapsed. Metering has stopped extending; nothing is owed. */
  | { state: 'elapsed' };

function ms(iso: string | null | undefined): Ms | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}
function finite(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Build an anchor from a canonical poll response, or null when there is nothing on stage or
 * the server did not supply the timestamps this projection requires. Null is the honest answer
 * — callers render `idle`/no clock rather than guessing from a partial payload.
 */
export function makeAnchor(input: AnchorInput): PlaybackAnchor | null {
  const requestId = typeof input.requestId === 'string' && input.requestId.length > 0 ? input.requestId : null;
  const serverNowMs = ms(input.serverNow);
  const startedAtMs = ms(input.startedAt);
  if (requestId === null || serverNowMs === null || startedAtMs === null) return null;
  const dur = finite(input.durationSeconds);
  return {
    requestId,
    serverNowMs,
    startedAtMs,
    // A non-positive or absurd duration is treated as unresolved rather than shown as a clock.
    // MAX matches MAX_LEASE_SECONDS — nothing longer can ever have been admitted.
    durationSeconds: dur !== null && dur >= 1 && dur <= 900 ? Math.floor(dur) : null,
    leaseEndsAtMs: ms(input.leaseEndsAt),
    monotonicAtReceiptMs: input.monotonicNowMs,
  };
}

/**
 * Whether `next` may replace `current`.
 *
 * A DIFFERENT request always wins — a song change must reset the clock immediately, even if
 * the response is otherwise unremarkable. For the SAME request, a response whose serverNow is
 * not newer is STALE (an out-of-order poll) and must not drag the clock backwards. This is the
 * "stale response cannot overwrite newer request state" rule.
 */
export function shouldReplaceAnchor(current: PlaybackAnchor | null, next: PlaybackAnchor): boolean {
  if (current === null) return true;
  if (current.requestId !== next.requestId) return true;
  return next.serverNowMs > current.serverNowMs;
}

/** Monotonic milliseconds elapsed since the anchor was received. Never negative. */
function sinceReceipt(anchor: PlaybackAnchor, monotonicNowMs: Ms): Ms {
  const d = monotonicNowMs - anchor.monotonicAtReceiptMs;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Project the current-song clock. `monotonicNowMs` is injected so every case is testable with a
 * fake clock and no real-time sleeps.
 *
 * `isPlaying` is the SERVER's answer to "is a song on stage" — the projection never decides it.
 * When the server says no, the clock is `idle` immediately, which is what makes finish, skip,
 * auto-advance refusal, and event end all converge without special-casing any of them.
 */
export function projectSongClock(
  anchor: PlaybackAnchor | null,
  isPlaying: boolean,
  monotonicNowMs: Ms,
): SongClock {
  if (!anchor || !isPlaying) return { state: 'idle' };

  // Server offset frozen at receipt, plus monotonic time since. Both halves are non-negative:
  // started_at is written by the same clock that stamps serverNow, so a negative offset can
  // only come from clock skew in a fixture — clamp it rather than render a negative elapsed.
  const offsetAtReceiptMs = Math.max(0, anchor.serverNowMs - anchor.startedAtMs);
  const rawElapsedSeconds = Math.floor((offsetAtReceiptMs + sinceReceipt(anchor, monotonicNowMs)) / 1000);

  if (anchor.durationSeconds === null) {
    return { state: 'unknown_duration', requestId: anchor.requestId, elapsedSeconds: Math.max(0, rawElapsedSeconds) };
  }
  const duration = anchor.durationSeconds;
  const elapsedSeconds = Math.min(duration, Math.max(0, rawElapsedSeconds));
  return {
    state: 'playing',
    requestId: anchor.requestId,
    elapsedSeconds,
    remainingSeconds: duration - elapsedSeconds,
    durationSeconds: duration,
    overrun: rawElapsedSeconds > duration,
  };
}

/**
 * Project how much longer external playback stays AUTHORIZED. This is the value that genuinely
 * elapses in the BUILD 20M model, and it is the honest live counterpart to a FREE balance that
 * (correctly) does not move: the seconds were already paid for at admission, and this is what
 * they bought. It outlives the song — a lease deliberately survives Finish (non-shrinkable), so
 * this can be `open` while nothing is on stage.
 */
export function projectLeaseWindow(anchor: PlaybackAnchor | null, monotonicNowMs: Ms): LeaseWindow {
  if (!anchor || anchor.leaseEndsAtMs === null) return { state: 'none' };
  const projectedServerNowMs = anchor.serverNowMs + sinceReceipt(anchor, monotonicNowMs);
  const remainingMs = anchor.leaseEndsAtMs - projectedServerNowMs;
  if (remainingMs <= 0) return { state: 'elapsed' };
  return { state: 'open', remainingSeconds: Math.ceil(remainingMs / 1000) };
}

/**
 * The FREE balance to display — DELIBERATELY the persisted server value, unprojected.
 *
 * This function exists so the decision is explicit, reviewable, and covered by tests rather
 * than being an absence of code someone "fixes" later. BUILD 24 §6.3 permits subtracting the
 * elapsed portion of an active lease ONLY if that matches the BUILD 20M accounting contract.
 * It does not: `karaoke_begin_song_v2` already debited the entire union extension inside the
 * admission transaction, so the persisted balance ALREADY excludes the song being played.
 * Subtracting it again would double-charge the display, and every poll would yank the number
 * back up — the exact sawtooth a naive "make it tick" fix produces.
 *
 * The remaining clamp is the server's; this only refuses to invent a number of its own.
 */
export function freeRemainingForDisplay(persistedRemainingSeconds: number | null): number | null {
  if (persistedRemainingSeconds === null) return null; // PRO — no FREE countdown at all
  return Math.max(0, Math.floor(persistedRemainingSeconds));
}

/**
 * mm:ss for a non-negative second count; h:mm:ss past an hour. The ONE formatter both the song
 * clock and the lease window render through, so the two can never disagree on shape.
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}
