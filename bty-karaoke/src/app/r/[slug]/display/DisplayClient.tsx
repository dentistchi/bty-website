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
  const waiting = state?.waiting ?? [];
  const comingUp = waiting.slice(1, 5); // songs after the first (the big central QR is only shown when the queue is truly empty)
  const stats = state?.stats ?? null;
  const ended = state?.event?.status === 'ended' || state?.event?.status === 'archived';
  const playingBadge = playing ? badgeForKind(playing.videoKind) : null;

  return (
    <div className="kd">
      {/* Honest ended state — the one canonical event closed. History is kept. */}
      {ended && (
        <div className="kd-ended" role="status">
          이벤트가 종료되었어요 · 오늘의 기록은 그대로 보존됩니다
        </div>
      )}
      {/* Top bar: brand + LIVE panel + QR + fullscreen (no video, no mute) */}
      <header className="kd-top">
        <div className="kd-brand">
          <span className="brand">btyNorebang</span>
          <span className="kd-room">{roomName}</span>
        </div>

        {/* LIVE panel — information only (no click). Numbers pop on real change. */}
        {stats && (
          <div className="kd-live" role="status" aria-label="라이브 현황">
            <span className="kd-live-tag">
              <span className="live-dot" aria-hidden /> LIVE
            </span>
            <LiveStat icon="👥" value={stats.singers} label="singers" />
            <LiveStat icon="🎵" value={stats.requests} label="requests" />
            <LiveStat icon="✅" value={stats.completed} label="done" />
            <LiveStat icon="⏳" value={stats.waiting} label="waiting" />
          </div>
        )}

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
          {/* Keyed by the singing request id: the hero fades in ONLY when the
              singer actually changes, never on a routine 2s poll re-render. */}
          <div className="kd-nowbar hero kd-fade" key={playing.id}>
            <div className="kd-now-label">
              <span className="live-dot" aria-hidden /> NOW SINGING
            </div>
            <div className="kd-now-singer">{playing.guestName}</div>
            <div className="kd-now-song">{playing.title}</div>
            {playingBadge && (
              <div className="kd-now-badge">
                <span className={`vk-badge vk-${playingBadge.tone} kd-badge`}>
                  {playingBadge.emoji} {playingBadge.label}
                </span>
              </div>
            )}
            {playing.artist && <div className="kd-now-artist">{playing.artist}</div>}
            <p className="kd-tv-note">영상과 가사는 TV에서 확인하세요.</p>
          </div>

          {/* NEXT — big and unmistakable; slides in only when it changes. */}
          {next ? (
            <div className="kd-next-hero kd-slide" key={next.id}>
              <span className="kd-next-label">NEXT{next.ready ? ' · READY' : ''}</span>
              <span className="kd-next-singer">{next.guestName}</span>
              <span className="kd-next-song">{next.title}</span>
            </div>
          ) : (
            <div className="kd-next-hero empty">
              <span className="kd-next-label">NEXT</span>
              <span className="kd-next-song muted">휴대폰으로 다음 곡을 신청하세요</span>
            </div>
          )}
        </section>
      ) : next ? (
        /* No one singing but songs ARE waiting — show the queue, NOT a big QR. */
        <section className="kd-stage board" aria-label="다음 순서">
          <div className="kd-nowbar hero kd-fade" key={next.id}>
            <div className="kd-now-label">
              {next.ready ? '✅ READY TO PLAY' : 'UP NEXT'}
            </div>
            <div className="kd-now-singer">{next.guestName}</div>
            <div className="kd-now-song">{next.title}</div>
            {(() => {
              const badge = badgeForKind(next.videoKind);
              return badge ? (
                <div className="kd-now-badge">
                  <span className={`vk-badge vk-${badge.tone} kd-badge`}>
                    {badge.emoji} {badge.label}
                  </span>
                </div>
              ) : null;
            })()}
            {next.artist && <div className="kd-now-artist">{next.artist}</div>}
          </div>

          {comingUp.length > 0 && (
            <div className="kd-comingup">
              <div className="kd-comingup-label">COMING UP</div>
              <ol className="kd-comingup-list">
                {comingUp.map((r) => (
                  <li key={r.id} className="kd-comingup-row">
                    <span className="kd-cu-singer">{r.guestName}</span>
                    <span className="kd-cu-song">{r.title}</span>
                    {r.ready && <span className="kd-cu-ready">READY</span>}
                  </li>
                ))}
              </ol>
              {waiting.length > 5 && (
                <div className="kd-comingup-more">+ {waiting.length - 5} more songs</div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="kd-empty" aria-label="대기 중">
          <div className="kd-empty-mic" aria-hidden>🎤</div>
          <div className="kd-empty-eyebrow">오늘의 노래</div>
          {qr ? (
            <div className="kd-empty-qr" dangerouslySetInnerHTML={{ __html: qr.qrSvg }} />
          ) : (
            <div className="kd-video-ph big" aria-hidden>🎤</div>
          )}
          <div className="kd-empty-title">휴대폰으로 노래를 신청하세요</div>
          <div className="kd-empty-sub">첫 번째 신청자가 오늘의 무대를 시작합니다.</div>
        </section>
      )}
    </div>
  );
}

// One LIVE number. Keyed by its value so it re-mounts (and pops) ONLY when the
// count actually changes — a routine poll with the same numbers is silent.
function LiveStat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <span className="kd-live-stat" title={label}>
      <span className="kd-live-ico" aria-hidden>{icon}</span>
      <span className="kd-live-num" key={value}>{value}</span>
    </span>
  );
}
