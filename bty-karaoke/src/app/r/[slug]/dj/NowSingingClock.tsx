'use client';

// BUILD 24 — the current-song clock. (BUILD 26U-R1 removed the external-playback lease note.)
//
// PURELY presentational. It renders a projection computed in `domain/playback-clock` from a
// server-stamped anchor and re-derives nothing. The native Host renders the same two values
// from the same anchor, so the clients cannot disagree by more than the ~1s render skew §6.5
// allows.
//
// The honesty rules this component exists to hold:
//   · a value that LOOKS live must BE live — nothing frozen is styled as a countdown;
//   · an unresolved duration shows elapsed time and says the length is unknown, never "0:00";
//   · past the song's own length it says the song should have ended, instead of pinning a
//     0:00 countdown that reads as "still going".
//
// BUILD 26U-R1 (R1-G) — THE LEASE NOTE IS REMOVED. It read "⏱ 외부 재생 시간 N 남음 ·
// YouTube에 허용된 재생 시간이에요" — a countdown of purchased YouTube playback time, which is
// precisely the meaning the Premium Room boundary retires. It was already unreachable: E1
// (20260817120000) stopped minting leases, so `lease.state` has been permanently 'none'.
// The elapsed/remaining SONG clock stays — that is a fact about the media, not a price on it.

import { formatClock, type SongClock, type LeaseWindow } from '@/domain/playback-clock';

export default function NowSingingClock({ song, lease }: { song: SongClock; lease: LeaseWindow }) {
  if (song.state === 'idle') return null;

  return (
    // `data-lease-state` is retained as an inert diagnostic attribute only — it renders no
    // text and makes no claim. Nothing is priced or counted down by it.
    <div className="now-clock" data-song-state={song.state} data-lease-state={lease.state}>
      {song.state === 'playing' && (
        <span className="now-clock-time" role="timer" aria-live="off">
          <strong>{formatClock(song.elapsedSeconds)}</strong>
          <span className="now-clock-sep"> / </span>
          <span className="now-clock-total">{formatClock(song.durationSeconds)}</span>
          {song.overrun ? (
            <span className="now-clock-note"> · 곡 길이를 지났어요</span>
          ) : (
            <span className="now-clock-note"> · 남은 시간 {formatClock(song.remainingSeconds)}</span>
          )}
        </span>
      )}

      {song.state === 'unknown_duration' && (
        <span className="now-clock-time" role="timer" aria-live="off">
          <strong>{formatClock(song.elapsedSeconds)}</strong>
          <span className="now-clock-note"> · 영상 길이를 알 수 없어 남은 시간은 표시할 수 없어요</span>
        </span>
      )}
    </div>
  );
}
