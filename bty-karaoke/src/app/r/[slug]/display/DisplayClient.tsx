'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayState } from '@/domain/display';
import { badgeForKind } from '@/domain/video-kind';

interface Props {
  slug: string;
  roomName: string;
}

const POLL_MS = 2000; // iPad Display refreshes faster than the guest phones.

// Read-only "song board" by the microphone. Big type, high contrast — readable
// from across the room. It is NOT a video player: the karaoke video and lyrics
// live on the TV (via the singer's YouTube handoff). Many karaoke uploads block
// external embedding, so an on-Display iframe would show "Video unavailable" —
// V3.1 removes it entirely. The board shows only QR + NOW SINGING + NEXT, which
// never fail. No credential, no mutation, no DJ controls.
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

  // Guest-join QR (public link) — fetched once; stable for the night.
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
  }, [slug]);

  // Best-effort keep-awake so the board doesn't sleep mid-song. Re-acquired when
  // the tab returns to the foreground (the lock drops when hidden).
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
  const playingBadge = playing ? badgeForKind(playing.videoKind) : null;

  return (
    <div className="kd">
      {/* Top bar: brand + QR + fullscreen (no video, so no mute control) */}
      <header className="kd-top">
        <div className="kd-brand">
          <span className="brand">btyNorebang</span>
          <span className="kd-room">{roomName}</span>
        </div>
        <div className="kd-top-right">
          <div className="kd-controls">
            <button type="button" className="kd-ctl" onClick={enterFullscreen}>
              ⛶ 전체화면
            </button>
          </div>
          {qr && (
            <div className="kd-qr" aria-label="참여 QR">
              <div className="kd-qr-svg" dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
              <div className="kd-qr-cap">Scan to join</div>
            </div>
          )}
        </div>
      </header>

      {playing ? (
        <section className="kd-stage board" aria-label="지금 부르는 중">
          <div className="kd-nowbar hero">
            <div className="kd-now-label">
              <span className="live-dot" aria-hidden /> NOW SINGING
            </div>
            <div className="kd-now-singer">{playing.guestName}</div>
            <div className="kd-now-song">
              {playing.title}
              {playingBadge && (
                <span className={`vk-badge vk-${playingBadge.tone} kd-badge`}>
                  {playingBadge.emoji} {playingBadge.label}
                </span>
              )}
            </div>
            {playing.artist && <div className="kd-now-artist">{playing.artist}</div>}
            {next && (
              <div className="kd-next">
                <span className="kd-next-label">NEXT</span> {next.guestName} · {next.title}
              </div>
            )}
            <p className="kd-tv-note">영상과 가사는 TV에서 확인하세요.</p>
          </div>
        </section>
      ) : (
        <section className="kd-empty" aria-label="대기 중">
          {qr ? (
            <div className="kd-empty-qr" dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
          ) : (
            <div className="kd-video-ph big" aria-hidden>
              🎤
            </div>
          )}
          <div className="kd-empty-title">Scan to join</div>
          <div className="kd-empty-sub">
            {state && state.waitingCount > 0
              ? `${state.waitingCount}곡 대기 중 — 휴대폰으로 스캔해 노래를 신청하세요.`
              : '휴대폰으로 스캔해 노래를 신청하세요.'}
          </div>
          {next && (
            <div className="kd-next standalone">
              <span className="kd-next-label">UP NEXT</span> {next.guestName} · {next.title}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
