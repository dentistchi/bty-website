'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayState, DisplayRequest } from '@/domain/display';

interface Props {
  slug: string;
  roomName: string;
}

const POLL_MS = 2000; // iPad Display refreshes faster than the guest phones.
const CELEBRATE_MS = 2600; // brief "그 사람의 무대였습니다" applause on song completion.

// Two approved warm closing lines, rotated deterministically (never AI-generated).
const CELEBRATE_LINES = ['함께해 주셔서 고마워요', '오늘도 멋진 무대였어요'] as const;

// A stable artwork URL from the request's video id (hqdefault always exists). Used
// as a CSS background so a 404 degrades to the ambient gradient — never a broken
// image icon. Falls back to the stored thumbnail, then null (pure gradient stage).
function artUrl(r: DisplayRequest): string | null {
  if (r.videoId) return `https://i.ytimg.com/vi/${encodeURIComponent(r.videoId)}/hqdefault.jpg`;
  return r.thumbnailUrl ?? null;
}

// LIVING JOY STAGE (V1.4) — the iPad by the microphone is NOT a lyrics screen (the
// TV shows lyrics via the YouTube handoff). It is a warm, BTY-ARENA-quality stage
// that makes the room FEEL the moment: anticipation before a song, presence while
// someone sings, shared joy when they finish. Singer-first; artwork is ambient, not
// a card. Read-only, credential-free, no video, no lyrics surface.
export default function DisplayClient({ slug, roomName }: Props) {
  const [state, setState] = useState<DisplayState | null>(null);
  const [qr, setQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const seq = useRef(0);

  const poll = useCallback(async () => {
    const n = ++seq.current;
    try {
      // No `?lyrics=1`: the Display renders no lyrics (V1.4), so it triggers no
      // provider resolution. Automatic lyrics remain an internal, default-off backend.
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display`, { cache: 'no-store' });
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
  const celebrateCount = useRef(0);
  const [celebrating, setCelebrating] = useState<{ name: string; line: string } | null>(null);
  const playingId = playing?.id ?? null;
  useEffect(() => {
    const cur = playing ? { id: playing.id, name: playing.guestName } : null;
    const prev = prevPlaying.current;
    if (prev && (!cur || cur.id !== prev.id)) {
      const line = CELEBRATE_LINES[celebrateCount.current % CELEBRATE_LINES.length];
      celebrateCount.current += 1;
      setCelebrating({ name: prev.name, line });
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

      {/* Completion celebration — a brief, restrained applause with a warm light lift.
          Non-blocking: it fades over the next state, never a splash that stalls the
          room. No score, no ranking, no judgment. */}
      {celebrating && (
        <div className="js-celebrate" role="status" aria-live="polite">
          <div className="js-celebrate-inner">
            <div className="js-celebrate-symbol" aria-hidden>👏</div>
            <div className="js-celebrate-line">{celebrating.name}의 무대였습니다</div>
            <div className="js-celebrate-sub">{celebrating.line}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Singing: the Living Visual Stage — ambient artwork · singer-first · compact NEXT ──
function SingingStage({ playing, next }: { playing: DisplayRequest; next: DisplayRequest | null }) {
  const art = artUrl(playing);
  return (
    <section className="js-stage js-vstage" aria-label="지금 부르는 중">
      {/* Full-bleed ambient from the artwork (blurred, low opacity, navy + warm veil).
          Keyed by the request id so a song change swaps the scene atomically and the
          slow zoom restarts once — never re-animating on a 2s poll. CSS background →
          a 404 simply shows the gradient veil (no broken-image icon, never black). */}
      <div
        className={`js-vstage-ambient${art ? '' : ' no-art'}`}
        key={playing.id}
        style={art ? { backgroundImage: `url("${art}")` } : undefined}
        aria-hidden
      />
      <div className="js-vstage-veil" aria-hidden />
      {/* One warm bloom as the song begins (keyed → fires once). */}
      <div className="js-bloom" key={`bloom-${playing.id}`} aria-hidden />

      <div className="js-vstage-content" key={`c-${playing.id}`}>
        <div className="js-now-eyebrow">
          <span className="live-dot" aria-hidden /> NOW SINGING
        </div>
        {art && (
          <div className="js-art-medallion" style={{ backgroundImage: `url("${art}")` }} aria-hidden />
        )}
        <div className="js-now-stage">{playing.guestName}의 무대</div>
        <div className="js-now-song">{playing.songTitle}</div>
        {playing.songArtist && <div className="js-now-artist">{playing.songArtist}</div>}
        <div className="js-moment">이 순간을 함께 즐겨주세요</div>
      </div>

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
          <div className="js-invite-qr-cap">카메라로 스캔해 노래를 신청하세요</div>
        </div>
      )}
    </section>
  );
}
