'use client';

// Timed Access Pass — Manager account-detail section (BUILD 17). Renders inside the Host
// plan detail sheet. Shows the account's effective entitlement + current pass state, lets a
// Manager ISSUE a fixed-duration pass (1h/4h/24h) with a reason, REVOKE an unused pass, and
// read the append-only audit history. Issuing/revoking NEVER changes the FREE/PRO plan — the
// section renders server truth only and refetches after every mutation.

import { useCallback, useEffect, useState } from 'react';

type PassType = 'ONE_HOUR' | 'FOUR_HOURS' | 'TWENTY_FOUR_HOURS';
type PassStatus = 'AVAILABLE' | 'SELECTED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

interface GrantView {
  id: string;
  passType: PassType;
  durationSeconds: number;
  status: PassStatus;
  issueReason: string | null;
  selectedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  expiredAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
}
interface AuditView {
  action: string;
  actorType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}
interface StateView {
  basePlan: 'FREE' | 'PRO';
  effectiveEntitlement: 'PRO' | 'TIMED_ACCESS' | 'FREE';
  activePass: { passType: PassType; expiresAt: string; remainingSeconds: number } | null;
  selectedPass: { passType: PassType } | null;
}
interface InventoryResult {
  ok: boolean;
  state: StateView | null;
  passes: GrantView[];
  audit: AuditView[];
}

const PASS_LABEL: Record<PassType, string> = {
  ONE_HOUR: '1시간',
  FOUR_HOURS: '4시간',
  TWENTY_FOUR_HOURS: '24시간',
};
const STATUS_LABEL: Record<PassStatus, string> = {
  AVAILABLE: '사용 가능',
  SELECTED: '선택됨 · 첫 곡 대기',
  ACTIVE: '사용 중',
  EXPIRED: '종료됨',
  REVOKED: '취소됨',
};
const EFFECTIVE_LABEL: Record<StateView['effectiveEntitlement'], string> = {
  PRO: 'PRO (무제한)',
  TIMED_ACCESS: '이용권 사용 중',
  FREE: 'FREE',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
function fmtRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default function TimedAccessPassSection({
  accountId,
  basePlan,
  onUnauthorized,
}: {
  accountId: string;
  basePlan: 'FREE' | 'PRO';
  onUnauthorized?: () => void;
}) {
  const [data, setData] = useState<InventoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<'ok' | 'unauth' | 'err'> => {
    try {
      const res = await fetch(`/api/manager/timed-passes/${encodeURIComponent(accountId)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (res.status === 401) return 'unauth';
      const body = (await res.json().catch(() => ({}))) as InventoryResult;
      if (!res.ok || body.ok !== true) return 'err';
      setData(body);
      return 'ok';
    } catch {
      return 'err';
    }
  }, [accountId]);

  useEffect(() => {
    (async () => {
      const r = await load();
      if (r === 'unauth') onUnauthorized?.();
      else if (r === 'err') setError('이용권 정보를 불러오지 못했습니다.');
    })();
  }, [load, onUnauthorized]);

  async function issue(passType: PassType) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const idempotencyKey = crypto.randomUUID(); // ONE fresh key per attempt
    try {
      const res = await fetch('/api/manager/timed-passes/issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ accountId, passType, reason: reason.trim() || undefined, idempotencyKey }),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        if (res.status === 409 && body.error === 'account_is_pro')
          setError('PRO 계정은 이용권을 사용할 수 없어 발급이 차단됩니다.');
        else setError('이용권 발급에 실패했습니다.');
        return;
      }
      setReason('');
      setNotice(`${PASS_LABEL[passType]} 이용권을 발급했습니다.`);
      await load();
    } catch {
      setError('네트워크 오류로 발급되지 않았습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(grant: GrantView) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch(`/api/manager/timed-passes/grants/${encodeURIComponent(grant.id)}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ reason: reason.trim() || undefined, idempotencyKey }),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || body.ok !== true) {
        setError(res.status === 409 ? '사용 중이거나 이미 종료된 이용권은 취소할 수 없습니다.' : '취소에 실패했습니다.');
        void load();
        return;
      }
      setNotice('이용권을 취소했습니다.');
      await load();
    } catch {
      setError('네트워크 오류로 취소되지 않았습니다.');
    } finally {
      setBusy(false);
    }
  }

  const state = data?.state;
  const passes = data?.passes ?? [];
  const audit = data?.audit ?? [];

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="d-name">Timed Access Pass · 이용권</div>

      {/* Current effective state (server truth) */}
      <div className="d-meta" style={{ marginTop: 6 }}>
        현재 권한:{' '}
        <span className={`pill ${state?.effectiveEntitlement !== 'FREE' ? 'live' : ''}`}>
          {state ? EFFECTIVE_LABEL[state.effectiveEntitlement] : '…'}
        </span>
        {state?.activePass && (
          <>
            {' '}
            · {PASS_LABEL[state.activePass.passType]} · 남은 시간 {fmtRemaining(state.activePass.remainingSeconds)} · 만료{' '}
            {fmtDate(state.activePass.expiresAt)}
          </>
        )}
        {state?.selectedPass && !state.activePass && <> · 선택됨: {PASS_LABEL[state.selectedPass.passType]} (첫 곡 시작 대기)</>}
      </div>

      {basePlan === 'PRO' ? (
        <p className="muted" style={{ marginTop: 8 }}>
          이 계정은 이미 PRO(무제한)입니다. 이용권은 발급되지 않습니다.
        </p>
      ) : (
        <>
          {/* Issue */}
          <div style={{ marginTop: 10 }}>
            <label className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>
              발급 이유 (선택)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="예: Gate A 발급 테스트"
              style={{ width: '100%', marginTop: 4 }}
            />
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(['ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS'] as PassType[]).map((t) => (
                <button key={t} className="primary" disabled={busy} onClick={() => issue(t)}>
                  {PASS_LABEL[t]} 발급
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {notice && (
        <p className="muted" style={{ marginTop: 8 }}>
          {notice}
        </p>
      )}
      {error && (
        <p className="muted" style={{ marginTop: 8, color: 'var(--danger, #c0392b)' }}>
          {error}
        </p>
      )}

      {/* Inventory */}
      <div style={{ marginTop: 12 }}>
        <div className="d-name" style={{ fontSize: '0.9rem' }}>
          발급 내역 ({passes.length})
        </div>
        {passes.length === 0 ? (
          <p className="muted" style={{ marginTop: 6 }}>
            발급된 이용권이 없습니다.
          </p>
        ) : (
          <div className="stack" style={{ marginTop: 8 }}>
            {passes.map((p) => (
              <div key={p.id} className="d-meta">
                <span className={`pill ${p.status === 'ACTIVE' ? 'live' : ''}`} style={{ marginRight: 6 }}>
                  {PASS_LABEL[p.passType]}
                </span>
                {STATUS_LABEL[p.status]} · 발급 {fmtDate(p.createdAt)}
                {p.selectedAt ? ` · 선택 ${fmtDate(p.selectedAt)}` : ''}
                {p.activatedAt ? ` · 활성화 ${fmtDate(p.activatedAt)}` : ''}
                {p.expiresAt ? ` · 만료 ${fmtDate(p.expiresAt)}` : ''}
                {p.issueReason ? ` · 이유: ${p.issueReason}` : ''}
                {(p.status === 'AVAILABLE' || p.status === 'SELECTED') && (
                  <>
                    {' '}
                    <button className="ghost" disabled={busy} onClick={() => revoke(p)} style={{ marginLeft: 6 }}>
                      취소
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit history */}
      {audit.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="d-name" style={{ fontSize: '0.9rem' }}>
            이용권 이력
          </div>
          <div className="stack" style={{ marginTop: 8 }}>
            {audit.map((a, i) => (
              <div key={i} className="d-meta">
                <strong>{a.action}</strong>
                {a.fromStatus || a.toStatus ? ` · ${a.fromStatus ?? '—'} → ${a.toStatus ?? '—'}` : ''} · {a.actorType} ·{' '}
                {fmtDate(a.createdAt)}
                {a.reason ? ` · ${a.reason}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
