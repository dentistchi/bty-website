'use client';

import { useCallback, useEffect, useState } from 'react';

// PRO Pilot Requests — the Manager approval surface (BUILD 16). Rendered ONLY inside
// the authenticated Host Plans console, so the bty_mgr cookie is already present.
//
// Approve/Decline are confirm-gated, mint ONE idempotency key per attempt (reused for
// retries), guard against double-submit (button disabled while busy), and refetch the
// canonical list after every response — the UI never optimistically flips a status or
// a plan. Approve moves the account to PRO via the existing canonical plan authority
// (server side); this component only calls the operator endpoints.

type Status = 'PENDING' | 'APPROVED' | 'DECLINED';

interface Req {
  requestId: string;
  accountId: string;
  accountRef: string;
  hostLabel: string;
  roomLabel: string | null;
  currentPlan: 'FREE' | 'PRO';
  status: Status;
  requestedAt: string;
  decidedAt: string | null;
}
interface ListResult {
  totals: { total: number; pending: number; approved: number; declined: number; uniqueAccounts: number };
  requests: Req[];
}

type Filter = 'PENDING' | 'ALL';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export default function ProPilotRequestsSection({ onUnauthorized }: { onUnauthorized?: () => void }) {
  const [data, setData] = useState<ListResult | null>(null);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [error, setError] = useState<string | null>(null);

  // The confirm flow, keyed to the one request being decided.
  const [confirm, setConfirm] = useState<{ req: Req; decision: 'approve' | 'decline' } | null>(null);
  const [reason, setReason] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [result, setResult] = useState<{ decision: 'approve' | 'decline'; label: string } | null>(null);

  const load = useCallback(
    async (f: Filter): Promise<'ok' | 'unauth' | 'err'> => {
      try {
        const sp = new URLSearchParams();
        if (f === 'PENDING') sp.set('status', 'PENDING');
        const res = await fetch(`/api/manager/pro-pilot-requests?${sp.toString()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (res.status === 401) return 'unauth';
        if (!res.ok) return 'err';
        setData((await res.json()) as ListResult);
        return 'ok';
      } catch {
        return 'err';
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const r = await load(filter);
      if (r === 'unauth') onUnauthorized?.();
      else if (r === 'err') setError('Couldn’t load pilot requests.');
      else setError(null);
    })();
  }, [filter, load, onUnauthorized]);

  function begin(req: Req, decision: 'approve' | 'decline') {
    setConfirmError(null);
    setResult(null);
    setReason('');
    setKey(crypto.randomUUID()); // ONE fresh idempotency key per attempt
    setConfirm({ req, decision });
  }
  function cancel() {
    setConfirm(null);
    setReason('');
    setKey(null);
    setBusy(false);
    setConfirmError(null);
  }

  async function submit() {
    if (!confirm || busy) return; // double-submit guard
    const { req, decision } = confirm;
    const idempotencyKey = key ?? crypto.randomUUID();
    if (!key) setKey(idempotencyKey);
    setBusy(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/manager/pro-pilot-requests/${encodeURIComponent(req.requestId)}/${decision}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ idempotencyKey, reason: reason.trim() || undefined }),
      });
      if (res.status === 401) {
        cancel();
        onUnauthorized?.();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || body.ok !== true) {
        if (res.status === 404) setConfirmError('That request no longer exists. Refreshing…');
        else if (res.status === 409) setConfirmError('This request was already decided. Refreshing…');
        else setConfirmError('The decision could not be completed. Try again.');
        void load(filter); // reflect canonical state
        return; // key retained → retry is idempotent
      }
      // Success — never trust local state; refetch canonical list.
      await load(filter);
      setConfirm(null);
      setResult({
        decision,
        label: decision === 'approve' ? `${req.hostLabel} → PRO` : `${req.hostLabel} · declined`,
      });
    } catch {
      setConfirmError('Network error. The decision was not applied. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const totals = data?.totals ?? { total: 0, pending: 0, approved: 0, declined: 0, uniqueAccounts: 0 };
  const requests = data?.requests ?? [];

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="d-name">PRO Pilot Requests · PRO 파일럿 신청</div>
        <div className="row" style={{ gap: 6 }}>
          {(['PENDING', 'ALL'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'primary' : 'ghost'} onClick={() => setFilter(f)} aria-pressed={filter === f}>
              {f === 'PENDING' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="d-meta" style={{ marginTop: 6 }}>
        {totals.pending} pending · {totals.approved} approved · {totals.declined} declined · {totals.uniqueAccounts} accounts
      </div>

      {error && (
        <div className="banner error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {result && (
        <div className="banner success" style={{ marginTop: 8 }} role="status">
          <strong>{result.decision === 'approve' ? 'Approved' : 'Declined'}</strong>
          <div style={{ marginTop: 4 }}>{result.label}</div>
        </div>
      )}

      {requests.length === 0 ? (
        <p className="muted" style={{ marginTop: 10 }}>
          {filter === 'PENDING' ? 'No pending requests.' : 'No pilot requests yet.'}
        </p>
      ) : (
        <div className="stack" style={{ marginTop: 10 }}>
          {requests.map((r) => (
            <div key={r.requestId} className="event-row" style={{ cursor: 'default' }}>
              <div className="row between" style={{ gap: 8 }}>
                <strong className="d-name">{r.hostLabel}</strong>
                <span className={`pill ${r.status === 'PENDING' ? '' : r.status === 'APPROVED' ? 'live' : ''}`}>{r.status}</span>
              </div>
              <div className="d-meta">
                {r.roomLabel ? `${r.roomLabel} · ` : ''}Current plan: {r.currentPlan} · Requested {fmtDate(r.requestedAt)}
                {r.decidedAt ? ` · Decided ${fmtDate(r.decidedAt)}` : ''}
              </div>

              {r.status === 'PENDING' && (!confirm || confirm.req.requestId !== r.requestId) && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="primary" onClick={() => begin(r, 'approve')}>
                    Approve · 승인
                  </button>
                  <button className="ghost" onClick={() => begin(r, 'decline')}>
                    Decline · 거절
                  </button>
                </div>
              )}

              {confirm && confirm.req.requestId === r.requestId && (
                <div style={{ marginTop: 10 }}>
                  <div className="d-meta">
                    {confirm.decision === 'approve'
                      ? '이 Host 계정을 PRO로 변경하시겠습니까?'
                      : '이 신청을 거절하시겠습니까?'}
                  </div>
                  {confirmError && (
                    <div className="banner error" style={{ marginTop: 8 }} role="alert">
                      {confirmError}
                    </div>
                  )}
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={confirm.decision === 'approve' ? 'Reason (optional) · 사유' : 'Reason (optional) · 사유'}
                    rows={2}
                    disabled={busy}
                    maxLength={300}
                    aria-label="Decision reason"
                    style={{ width: '100%', resize: 'vertical', marginTop: 8 }}
                  />
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <button className="ghost" onClick={cancel} disabled={busy}>
                      Cancel · 취소
                    </button>
                    <button
                      className="primary"
                      onClick={submit}
                      disabled={busy}
                      aria-label={confirm.decision === 'approve' ? 'Confirm approve' : 'Confirm decline'}
                    >
                      {busy
                        ? 'Applying…'
                        : confirm.decision === 'approve'
                          ? 'Confirm PRO · PRO 승인'
                          : 'Confirm decline · 거절 확정'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
        <span className="muted">Approving moves the account to PRO via the canonical plan authority. Room/Event are never affected.</span>
      </div>
    </div>
  );
}
