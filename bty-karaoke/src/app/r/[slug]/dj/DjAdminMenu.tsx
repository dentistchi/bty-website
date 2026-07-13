'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DjDevice } from '@/lib/devices.server';
import { pairingSecondsRemaining, formatCountdown } from '@/domain/pairing';

interface Props {
  slug: string;
  displayName: string;
  /** Admin-capable bearer (admin device token or master credential). */
  cred: string;
  onShowGuestQr: () => void;
  onClose: () => void;
  onSessionEnded?: () => void;
}

type View = 'menu' | 'pair' | 'devices' | 'end' | 'rotate';

// Restrained Admin menu shown ONLY to an authenticated Admin inside the DJ
// Console — it never replaces the live karaoke surface. Reuses the existing admin
// routes (pair / devices / rotate / session); every action is server-authorized.
export default function DjAdminMenu({ slug, displayName, cred, onShowGuestQr, onClose, onSessionEnded }: Props) {
  const [view, setView] = useState<View>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ qrSvg: string; expiresAt: string } | null>(null);
  const [pairedLabel, setPairedLabel] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [devices, setDevices] = useState<DjDevice[]>([]);
  const [confirmRevoke, setConfirmRevoke] = useState<DjDevice | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  const api = (p: string) => `/api/rooms/${encodeURIComponent(slug)}${p}`;
  const H = useCallback(
    (extra?: Record<string, string>) => ({ authorization: `Bearer ${cred}`, ...(extra ?? {}) }),
    [cred],
  );

  useEffect(() => {
    openerRef.current = document.activeElement;
    sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => (openerRef.current as HTMLElement | null)?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
    );
    if (!f || f.length === 0) return;
    const list = Array.from(f);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const loadDevices = useCallback(async (): Promise<DjDevice[]> => {
    const res = await fetch(api('/admin/devices'), { headers: H(), cache: 'no-store' });
    if (!res.ok) return [];
    const d = await res.json();
    setDevices(d.devices ?? []);
    return d.devices ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, H]);

  // Countdown ticks only while the pairing QR is shown.
  useEffect(() => {
    if (view !== 'pair' || !pairing) return;
    setNowMs(Date.now());
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [view, pairing]);

  // While pairing, poll devices to detect the iPad connecting.
  useEffect(() => {
    if (view !== 'pair' || !pairing || pairedLabel) return;
    const before = new Set(devices.filter((d) => d.role === 'dj' && d.status === 'active').map((d) => d.id));
    const t = window.setInterval(async () => {
      const list = await loadDevices();
      const fresh = list.find((d) => d.role === 'dj' && d.status === 'active' && !before.has(d.id));
      if (fresh) setPairedLabel(fresh.label);
    }, 2500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pairing, pairedLabel, loadDevices]);

  async function openPair() {
    setView('pair');
    setError(null);
    setPairedLabel(null);
    setPairing(null);
    setBusy(true);
    try {
      await loadDevices();
      const res = await fetch(api('/admin/pair'), {
        method: 'POST',
        headers: H({ 'content-type': 'application/json' }),
        body: '{}',
      });
      if (res.ok) {
        const d = await res.json();
        setPairing({ qrSvg: d.qrSvg, expiresAt: d.expiresAt });
      } else {
        setError('QR을 만들지 못했어요.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function revokeDevice(dev: DjDevice) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api(`/admin/devices/${encodeURIComponent(dev.id)}`), {
        method: 'DELETE',
        headers: H(),
      });
      if (res.ok) {
        setConfirmRevoke(null);
        await loadDevices();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? '기기를 해제하지 못했어요.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function endNight() {
    setBusy(true);
    try {
      const res = await fetch(api('/admin/session'), { method: 'DELETE', headers: H() });
      if (res.ok) {
        onSessionEnded?.();
        onClose();
      } else {
        setError('종료하지 못했어요.');
        setView('menu');
      }
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    try {
      const res = await fetch(api('/admin/rotate'), { method: 'POST', headers: H() });
      if (res.ok) {
        await loadDevices();
        setView('devices');
      } else {
        setError('초기화하지 못했어요.');
        setView('menu');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="action-sheet admin-menu"
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} 관리자 메뉴`}
        ref={sheetRef}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {error && <div className="banner error">{error}</div>}

        {view === 'menu' && (
          <>
            <div className="sheet-eyebrow">Admin · {displayName}</div>
            <div className="admin-group">
              <button type="button" className="admin-item" onClick={openPair}>
                DJ iPad 연결
              </button>
              <button
                type="button"
                className="admin-item"
                onClick={() => {
                  onShowGuestQr();
                  onClose();
                }}
              >
                손님 초대 QR
              </button>
            </div>
            <div className="admin-group-label">방 관리</div>
            <div className="admin-group">
              <button type="button" className="admin-item" onClick={() => setView('devices')}>
                DJ 기기 관리
              </button>
              <button type="button" className="admin-item" onClick={() => setView('end')}>
                오늘 밤 종료
              </button>
            </div>
            <div className="admin-group-label">보안</div>
            <div className="admin-group">
              <button type="button" className="admin-item danger-item" onClick={() => setView('rotate')}>
                DJ 연결 초기화
              </button>
            </div>
            <button type="button" className="sheet-close linkish" onClick={onClose}>
              닫기
            </button>
          </>
        )}

        {view === 'pair' && (
          <div style={{ textAlign: 'center' }}>
            <div className="sheet-eyebrow">DJ iPad 연결</div>
            {pairedLabel ? (
              <div className="bloom">
                <span className="pill ok">✓ 연결됨</span>
                <div className="display-sm" style={{ margin: '12px 0' }}>
                  {pairedLabel} 준비 완료
                </div>
              </div>
            ) : pairing ? (
              (() => {
                const secs = pairingSecondsRemaining(pairing.expiresAt, nowMs || Date.now());
                if (secs <= 0) {
                  return (
                    <div className="card" style={{ maxWidth: 320, margin: '0 auto' }}>
                      <p className="lead">코드가 만료됐어요.</p>
                      <button className="primary block" disabled={busy} onClick={openPair}>
                        새 코드
                      </button>
                    </div>
                  );
                }
                return (
                  <>
                    <div className="display-sm" style={{ margin: '4px 0 12px' }}>
                      iPad로 스캔하세요
                    </div>
                    <div className="qr-surface" dangerouslySetInnerHTML={{ __html: pairing.qrSvg }} />
                    <div className="qr-caption">
                      {displayName} · <span className="countdown">{formatCountdown(secs)}</span> 후 만료
                    </div>
                    <p className="muted">한 번만 사용할 수 있어요.</p>
                  </>
                );
              })()
            ) : (
              <p className="lead">코드를 만드는 중…</p>
            )}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button className="ghost" disabled={busy} onClick={openPair}>
                새 코드
              </button>
              <button className="linkish" onClick={() => setView('menu')}>
                뒤로
              </button>
            </div>
          </div>
        )}

        {view === 'devices' && (
          <>
            <div className="sheet-eyebrow">DJ 기기 관리</div>
            {devices.length === 0 ? (
              <p className="lead">연결된 기기가 없어요.</p>
            ) : (
              devices.map((d) => (
                <div className={`device-row${d.status === 'revoked' ? ' revoked' : ''}`} key={d.id}>
                  <span className={`status-dot ${d.status === 'active' ? 'ok' : ''}`} aria-hidden />
                  <div className="grow">
                    <div className="d-name">
                      {d.label}
                      {d.role === 'admin' ? ' · 관리자(이 기기)' : ''}
                    </div>
                    <div className="d-meta">
                      {d.status === 'revoked' ? '해제됨' : '연결됨'} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {d.status === 'active' && d.role === 'dj' && (
                    confirmRevoke?.id === d.id ? (
                      <div className="confirm-row">
                        <button className="linkish" onClick={() => setConfirmRevoke(null)}>
                          취소
                        </button>
                        <button className="cancel-commit" disabled={busy} onClick={() => revokeDevice(d)}>
                          해제
                        </button>
                      </div>
                    ) : (
                      <button className="danger" onClick={() => setConfirmRevoke(d)}>
                        연결 해제
                      </button>
                    )
                  )}
                </div>
              ))
            )}
            <button type="button" className="sheet-close linkish" onClick={() => setView('menu')}>
              뒤로
            </button>
          </>
        )}

        {view === 'end' && (
          <div className="sheet-confirm">
            <div className="sheet-singer" style={{ fontSize: '1.4rem' }}>
              오늘 노래방을 종료할까요?
            </div>
            <p className="sheet-confirm-q" style={{ fontWeight: 400, color: 'var(--muted)' }}>
              새로운 신청은 더 이상 받지 않지만, 오늘의 기록은 그대로 남습니다.
            </p>
            <div className="sheet-actions two">
              <button type="button" className="sheet-btn ghost" onClick={() => setView('menu')}>
                계속 진행
              </button>
              <button type="button" className="sheet-btn coral" disabled={busy} onClick={endNight}>
                오늘 밤 종료
              </button>
            </div>
          </div>
        )}

        {view === 'rotate' && (
          <div className="sheet-confirm">
            <div className="sheet-singer" style={{ fontSize: '1.4rem' }}>
              DJ 연결을 새로 시작할까요?
            </div>
            <p className="sheet-confirm-q" style={{ fontWeight: 400, color: 'var(--muted)' }}>
              현재 연결된 DJ 기기는 모두 해제되고, 새 QR로 다시 연결해야 합니다.
            </p>
            <div className="sheet-actions two">
              <button type="button" className="sheet-btn ghost" onClick={() => setView('menu')}>
                돌아가기
              </button>
              <button type="button" className="sheet-btn coral" disabled={busy} onClick={rotate}>
                DJ 연결 초기화
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
