'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayState, DisplayRequest } from '@/domain/display';
import { createStageSound, type StageSound } from './stage-sound';

interface Props {
  slug: string;
  roomName: string;
}

const POLL_MS = 2000; // iPad Display refreshes faster than the guest phones.
const CELEBRATE_MS = 2600; // full celebration when no song immediately follows.
const CELEBRATE_SHORT_MS = 1500; // shortened when a new song has already started.
const JOY_PULSE_MS = 1500;
const SOUND_KEY = 'bty-stage-sound'; // localStorage: remember the sound preference.

// Two approved warm closing lines, rotated deterministically (never AI-generated).
const CELEBRATE_LINES = ['오늘도 함께해 주셔서 고마워요', '오늘도 멋진 무대였어요'] as const;

// A stable artwork URL from the request's video id (hqdefault always exists). Used
// as a CSS background so a 404 degrades to the ambient gradient — never a broken
// image icon. Falls back to the stored thumbnail, then null (pure gradient stage).
function artUrl(r: DisplayRequest): string | null {
  if (r.videoId) return `https://i.ytimg.com/vi/${encodeURIComponent(r.videoId)}/hqdefault.jpg`;
  return r.thumbnailUrl ?? null;
}

// LIVING STAGE (V1.5) — the iPad by the microphone is an emotional stage that reacts
// to the singer's moment: the stage OPENS when a song starts, breathes quietly while
// they sing, and CELEBRATES them when they finish. The TV shows video + lyrics; this
// screen shows people, atmosphere, the next stage, and joy. Read-only, no lyrics.
export default function DisplayClient({ slug, roomName }: Props) {
  const [state, setState] = useState<DisplayState | null>(null);
  const [qr, setQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const seq = useRef(0);

  const poll = useCallback(async () => {
    const n = ++seq.current;
    try {
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

  // Keep-awake so the stage doesn't sleep mid-song.
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

  // Celebration sound — default OFF. The toggle tap is the user gesture that unlocks
  // audio (iOS Safari), and the preference is remembered. Synthesized applause only.
  const soundRef = useRef<StageSound | null>(null);
  if (soundRef.current === null) soundRef.current = createStageSound();
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === '1') {
      soundRef.current?.enable();
      setSoundOn(true);
    }
  }, []);
  const toggleSound = () => {
    const s = soundRef.current;
    if (!s) return;
    if (s.enabled) {
      s.disable();
      setSoundOn(false);
      try { window.localStorage.setItem(SOUND_KEY, '0'); } catch { /* ignore */ }
    } else {
      s.enable(); // user gesture → unlock AudioContext
      setSoundOn(true);
      try { window.localStorage.setItem(SOUND_KEY, '1'); } catch { /* ignore */ }
    }
  };

  const playing = state?.playing ?? null;
  const next = state?.next ?? null;
  const ended = state?.event?.status === 'ended' || state?.event?.status === 'archived';
  const stats = state?.stats ?? null;

  // Completion transition — when the playing song's id changes (a performance just
  // finished), celebrate THAT singer. Reliable: the server moved the song out of
  // `playing`. Client-only, no engine change; auto-dismisses; a rapid new song
  // shortens (never covers) the celebration.
  const completedRef = useRef(0);
  if (stats) completedRef.current = stats.completed;
  const prevPlaying = useRef<{ id: string; name: string; song: string } | null>(null);
  const celebrateTimer = useRef<number | null>(null);
  const celebrateCount = useRef(0);
  const [celebrating, setCelebrating] = useState<{ name: string; song: string; line: string; tier: 1 | 2 } | null>(null);
  const playingId = playing?.id ?? null;
  useEffect(() => {
    const cur = playing ? { id: playing.id, name: playing.guestName, song: playing.songTitle } : null;
    const prev = prevPlaying.current;
    prevPlaying.current = cur;
    if (!prev || (cur && cur.id === prev.id)) return;
    // A performance just ended. Milestone (Tier 2) uses existing event stats only:
    // the first completed song, or every tenth — no new schema/analytics.
    const completed = completedRef.current;
    const tier: 1 | 2 = completed === 1 || (completed > 0 && completed % 10 === 0) ? 2 : 1;
    const line = CELEBRATE_LINES[celebrateCount.current % CELEBRATE_LINES.length];
    celebrateCount.current += 1;
    setCelebrating({ name: prev.name, song: prev.song, line, tier });
    soundRef.current?.applause();
    if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
    celebrateTimer.current = window.setTimeout(() => setCelebrating(null), cur ? CELEBRATE_SHORT_MS : CELEBRATE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);
  useEffect(() => () => { if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current); }, []);

  // Joy Pulse — a quiet corner note when a NEW song is requested (the request count
  // rises). Guards the initial mount so the existing queue is never mistaken for new.
  const prevRequests = useRef<number | null>(null);
  const joyTimer = useRef<number | null>(null);
  const [joyPulse, setJoyPulse] = useState(false);
  const requests = stats?.requests ?? null;
  useEffect(() => {
    if (requests == null) return;
    const prev = prevRequests.current;
    prevRequests.current = requests;
    if (prev != null && requests > prev) {
      setJoyPulse(true);
      if (joyTimer.current) window.clearTimeout(joyTimer.current);
      joyTimer.current = window.setTimeout(() => setJoyPulse(false), JOY_PULSE_MS);
    }
  }, [requests]);
  useEffect(() => () => { if (joyTimer.current) window.clearTimeout(joyTimer.current); }, []);

  const mode = playing ? 'singing' : ended ? 'ended' : next ? 'upnext' : 'waiting';

  return (
    <div className={`js js-${mode}`}>
      {/* Slow breathing glow + edge bokeh — the room, quietly alive. CSS-only. */}
      <div className="js-aura" aria-hidden />
      <div className="js-bokeh" aria-hidden>
        <span className="js-bokeh-a" /><span className="js-bokeh-b" /><span className="js-bokeh-c" />
      </div>

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
          <button
            type="button"
            className="js-ctl"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? '축하 사운드 끄기' : '축하 사운드 켜기'}
            title={soundOn ? 'Celebration sound on' : 'Celebration sound off'}
          >
            {soundOn ? '🔔' : '🔕'}
          </button>
          <button type="button" className="js-ctl" onClick={enterFullscreen} aria-label="전체화면">
            ⛶
          </button>
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
        <EndedStage stats={stats} />
      ) : next ? (
        <UpNextStage next={next} />
      ) : (
        <WaitingStage qrSvg={qr?.qrSvg ?? null} />
      )}

      {/* Joy Pulse — a small, single corner note; never covers the singer. */}
      {joyPulse && (
        <div className="js-joypulse" role="status" aria-live="polite">
          ✨ 새로운 무대가 준비되었어요
        </div>
      )}

      {/* Completion celebration — warm light lift + soft applause + a few gold sparks.
          Non-blocking, once, bounded. No score, no ranking, no judgment. */}
      {celebrating && (
        <div className={`js-celebrate tier-${celebrating.tier}`} role="status" aria-live="polite">
          <Sparks count={celebrating.tier === 2 ? 18 : 10} milestone={celebrating.tier === 2} />
          <div className="js-celebrate-inner">
            <div className="js-celebrate-symbol" aria-hidden>👏</div>
            <div className="js-celebrate-line">{celebrating.name}의 무대였습니다</div>
            {celebrating.song && <div className="js-celebrate-song">{celebrating.song}</div>}
            <div className="js-celebrate-sub">{celebrating.line}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// A bounded set of CSS gold sparks around the edges — never over the centre text.
// Deterministic positions (index-based) so the overlay renders once and cleans up
// with its unmount; no rAF, no growing DOM.
function Sparks({ count, milestone }: { count: number; milestone: boolean }) {
  const items = Array.from({ length: count }, (_, i) => {
    const left = 4 + ((i * 92) / Math.max(1, count - 1)); // spread 4%..96%
    const delay = (i % 6) * 0.12;
    const dur = 1.4 + (i % 4) * 0.2;
    const drift = ((i % 5) - 2) * 8;
    return (
      <span
        key={i}
        className="js-spark"
        style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s`, ['--drift' as string]: `${drift}px` }}
      />
    );
  });
  return <div className={`js-sparks${milestone ? ' milestone' : ''}`} aria-hidden>{items}</div>;
}

// ── Singing: the Living Visual Stage — ambient artwork · singer-first · compact NEXT ──
function SingingStage({ playing, next }: { playing: DisplayRequest; next: DisplayRequest | null }) {
  const art = artUrl(playing);
  return (
    <section className="js-stage js-vstage" aria-label="지금 부르는 중">
      {/* Full-bleed ambient from the artwork. Keyed by the request id so a song change
          swaps the scene atomically (no old/new mix) and the slow drift restarts once
          — never on a 2s poll. CSS background → a 404 shows the gradient, never black. */}
      <div
        className={`js-vstage-ambient${art ? '' : ' no-art'}`}
        key={playing.id}
        style={art ? { backgroundImage: `url("${art}")` } : undefined}
        aria-hidden
      />
      <div className="js-vstage-veil" aria-hidden />
      {/* Stage opening: a one-shot curtain darken + warm gold bloom as the song begins. */}
      <div className="js-curtain" key={`cur-${playing.id}`} aria-hidden />
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
