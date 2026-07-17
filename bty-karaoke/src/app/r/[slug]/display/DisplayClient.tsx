'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayState, DisplayRequest } from '@/domain/display';
import type { LyricsView } from '@/domain/lyrics';

interface Props {
  slug: string;
  roomName: string;
}

const POLL_MS = 2000; // iPad Display refreshes faster than the guest phones.
const CELEBRATE_MS = 2600; // brief "그 사람의 무대였습니다" applause on song completion.

// JOY STAGE (V1.3) — a warm, BTY-ARENA-quality living stage by the microphone. The
// singer is the protagonist; YouTube metadata is secondary and normalized. Read-only,
// credential-free, no video: automatic lyrics are the dominant surface, with a
// graceful artwork fallback when none are found. Not a dashboard, not karaoke neon.
export default function DisplayClient({ slug, roomName }: Props) {
  const [state, setState] = useState<DisplayState | null>(null);
  const [qr, setQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const seq = useRef(0);

  const poll = useCallback(async () => {
    const n = ++seq.current;
    try {
      // `?lyrics=1` opts THIS Display into automatic server-side lyrics resolution
      // for the playing song (guest polls omit it and stay lean).
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display?lyrics=1`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as DisplayState;
      if (n !== seq.current) return;
      setState(data);
    } catch {
      /* transient — keep last good state */
    }
  }, [slug]);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => {
      if (!document.hidden) void poll();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  // Guest-join QR (public link). Re-fetched whenever the canonical event id changes
  // so a rotation swaps in the NEW event's QR. Stable within a single event.
  const eventId = state?.event?.id ?? null;
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/guest-qr`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (alive) setQr({ qrSvg: d.qrSvg, url: d.url });
      } catch {
        /* QR is best-effort */
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, eventId]);

  // Best-effort keep-awake so the stage doesn't sleep mid-song.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen');
      } catch {
        /* wake lock unavailable / denied — harmless */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const enterFullscreen = () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (el.requestFullscreen) void el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch {
      /* fullscreen may be blocked — never forced */
    }
  };

  const playing = state?.playing ?? null;
  const next = state?.next ?? null;
  const ended = state?.event?.status === 'ended' || state?.event?.status === 'archived';

  // Completion transition — when the playing song's id changes (a performance just
  // finished), briefly celebrate THAT singer. Reliable: the server moved the song out
  // of `playing`. Client-only, no engine change; auto-dismisses (never blocks).
  const prevPlaying = useRef<{ id: string; name: string } | null>(null);
  const celebrateTimer = useRef<number | null>(null);
  const [celebrating, setCelebrating] = useState<{ name: string } | null>(null);
  const playingId = playing?.id ?? null;
  useEffect(() => {
    const cur = playing ? { id: playing.id, name: playing.guestName } : null;
    const prev = prevPlaying.current;
    if (prev && (!cur || cur.id !== prev.id)) {
      setCelebrating({ name: prev.name });
      if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
      celebrateTimer.current = window.setTimeout(() => setCelebrating(null), CELEBRATE_MS);
    }
    prevPlaying.current = cur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);
  useEffect(() => () => { if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current); }, []);

  const mode = playing ? 'singing' : ended ? 'ended' : next ? 'upnext' : 'waiting';

  return (
    <div className={`js js-${mode}`}>
      {/* Slow, subtle breathing glow — the living stage. CSS-only, low motion. */}
      <div className="js-aura" aria-hidden />

      {ended && (
        <div className="js-ribbon" role="status">
          이벤트가 종료되었어요 · 오늘의 기록은 그대로 보존됩니다
        </div>
      )}

      <header className="js-top">
        <div className="js-brand">
          <span className="brand">btyNorebang</span>
          <span className="js-room">{roomName}</span>
        </div>
        <div className="js-top-right">
          <button type="button" className="js-ctl" onClick={enterFullscreen} aria-label="전체화면">
            ⛶
          </button>
          {/* Top-right QR during singing/up-next (compact, "함께 노래해요"). In the
              waiting state the QR becomes a prominent central invitation instead. */}
          {qr && !ended && mode !== 'waiting' && (
            <div className={`js-qr${playing ? ' compact' : ''}`} aria-label="참여 QR">
              <div className="js-qr-svg" dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
              <div className="js-qr-cap">함께 노래해요</div>
            </div>
          )}
        </div>
      </header>

      {playing ? (
        <SingingStage playing={playing} next={next} />
      ) : ended ? (
        <EndedStage stats={state?.stats ?? null} />
      ) : next ? (
        <UpNextStage next={next} />
      ) : (
        <WaitingStage qrSvg={qr?.qrSvg ?? null} />
      )}

      {/* Completion celebration — a brief, restrained applause overlay. Non-blocking:
          it fades over the next state, never a splash that stalls the room. */}
      {celebrating && (
        <div className="js-celebrate" role="status" aria-live="polite">
          <div className="js-celebrate-inner">
            <div className="js-celebrate-symbol" aria-hidden>👏</div>
            <div className="js-celebrate-line">{celebrating.name}의 무대였습니다</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Singing: human-first NOW header · dominant lyrics (or artwork) · NEXT STAGE ──
function SingingStage({ playing, next }: { playing: DisplayRequest; next: DisplayRequest | null }) {
  return (
    <section className="js-stage" aria-label="지금 부르는 중">
      {/* Human-first header — the singer is the protagonist. Keyed by the request id
          so the gentle staged reveal runs ONCE per song, never on a 2s poll. */}
      <div className="js-now" key={playing.id}>
        <div className="js-now-eyebrow">
          <span className="live-dot" aria-hidden /> NOW SINGING
        </div>
        <div className="js-now-stage">{playing.guestName}의 무대</div>
        <div className="js-now-song">{playing.songTitle}</div>
        {playing.songArtist && <div className="js-now-artist">{playing.songArtist}</div>}
      </div>

      {/* Lyrics keyed by the request id: same song → stable key → React keeps the
          element and the reader's scroll position across polls; a new song remounts →
          resets to the top. Never carries the previous song's words. */}
      <LyricsStage key={`lyr-${playing.id}`} playing={playing} />

      <div className="js-next">
        <span className="js-next-tag">NEXT STAGE</span>
        {next ? (
          <span className="js-next-body">
            잠시 후, <strong>{next.guestName}</strong>의 무대가 시작됩니다
            <span className="js-next-song"> · {next.songTitle}</span>
          </span>
        ) : (
          <span className="js-next-body muted">함께 부르고 싶은 노래를 신청해 주세요</span>
        )}
      </div>
    </section>
  );
}

// The dominant reading surface OR the graceful artwork fallback when there are no
// lyrics. Never a big "unavailable" message as the emotional centerpiece.
function LyricsStage({ playing }: { playing: DisplayRequest }) {
  const lyrics: LyricsView | undefined = playing.lyrics;
  const status = lyrics?.status ?? 'unavailable';

  if (status === 'available' && lyrics?.text) {
    return (
      <div className="js-lyrics-scroll" aria-label="가사">
        <p className="js-lyrics-body">{lyrics.text}</p>
      </div>
    );
  }

  // Loading: a calm ambient stage (never a spinner), with the song identity present.
  // Unavailable / failed: the SAME warm visual stage — artwork + a human message, with
  // only a small honest note that automatic lyrics weren't found.
  const loading = status === 'loading';
  return (
    <div
      className={`js-artwork${playing.thumbnailUrl ? '' : ' no-art'}`}
      aria-label={loading ? '가사 불러오는 중' : '가사 없음'}
      aria-busy={loading || undefined}
    >
      {playing.thumbnailUrl && (
        <div className="js-artwork-bg" style={{ backgroundImage: `url("${playing.thumbnailUrl}")` }} aria-hidden />
      )}
      <div className="js-artwork-veil" aria-hidden />
      <div className="js-artwork-body">
        <div className="js-art-song">{playing.songTitle}</div>
        {playing.songArtist && <div className="js-art-artist">{playing.songArtist}</div>}
        <div className="js-art-message">
          {loading ? '무대가 시작됐어요' : '이 순간을 함께 즐겨주세요'}
        </div>
        <div className="js-art-note">
          {loading ? '가사를 준비하고 있어요…' : '자동 가사를 찾지 못했어요 · 영상은 TV에서 확인하세요'}
        </div>
      </div>
    </div>
  );
}

// ── Up next: warm anticipation before a song starts ──
function UpNextStage({ next }: { next: DisplayRequest }) {
  return (
    <section className="js-stage js-center" aria-label="다음 순서">
      <div className="js-anticipate" key={next.id}>
        <div className="js-now-eyebrow up">{next.ready ? '✨ 곧 시작합니다' : 'UP NEXT'}</div>
        <div className="js-anticipate-stage">
          잠시 후, <strong>{next.guestName}</strong>의 무대가 시작됩니다
        </div>
        <div className="js-now-song big">{next.songTitle}</div>
        {next.songArtist && <div className="js-now-artist">{next.songArtist}</div>}
      </div>
    </section>
  );
}

// ── Ended: the night is over, warmly ──
function EndedStage({ stats }: { stats: DisplayState['stats'] | null }) {
  return (
    <section className="js-stage js-center" aria-label="이벤트 종료">
      <div className="js-empty-symbol" aria-hidden>🎬</div>
      <div className="js-empty-eyebrow">오늘의 무대</div>
      <div className="js-empty-title">오늘의 무대가 끝났어요</div>
      <div className="js-empty-sub">
        {stats
          ? `${stats.singers}명이 함께했어요 · ${stats.completed}곡 완창 · 기록은 그대로 보존됩니다`
          : '함께해 주셔서 고맙습니다 · 기록은 그대로 보존됩니다'}
      </div>
    </section>
  );
}

// ── Waiting: a warm ambient stage inviting the room to sing (not a dashboard) ──
function WaitingStage({ qrSvg }: { qrSvg: string | null }) {
  return (
    <section className="js-stage js-center js-waiting-stage" aria-label="대기 중">
      <div className="js-empty-symbol" aria-hidden>🎤</div>
      <div className="js-empty-eyebrow">오늘의 무대</div>
      <div className="js-empty-title">오늘의 무대가 곧 시작됩니다</div>
      <div className="js-empty-sub">함께 부르고 싶은 노래를 신청해 주세요</div>
      {qrSvg && (
        <div className="js-invite-qr">
          <div className="js-invite-qr-svg" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="js-invite-qr-cap">휴대폰으로 스캔하고 첫 곡을 신청하세요</div>
        </div>
      )}
    </section>
  );
}
